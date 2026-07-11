interface HistoricalData {
  close: number[];
  high: number[];
  low: number[];
  volume: number[];
}

export type MarketRegime = 'GOLDILOCKS' | 'REFLATION' | 'STAGFLATION' | 'DEFLATION';

/**
 * Calcola il Chande Momentum Oscillator (CMO) su n periodi.
 * Cattura il momentum non lineare in modo molto più reattivo rispetto all'RSI classico.
 */
export function calculateCMO(close: number[], period: number = 14): number {
  if (close.length <= period) return 0;

  const clip = close.slice(-(period + 1));
  let higherCloses = 0;
  let lowerCloses = 0;

  for (let i = 1; i < clip.length; i++) {
    const diff = clip[i] - clip[i - 1];
    if (diff > 0) higherCloses += diff;
    else lowerCloses += Math.abs(diff);
  }

  const denominator = higherCloses + lowerCloses;
  if (denominator === 0) return 0;

  return ((higherCloses - lowerCloses) / denominator) * 100;
}

/**
 * Calcola l'ATR con Smoothing Esponenziale (Wilder's MA) per riflettere
 * l'impatto della volatilità recente.
 */
export function calculateAdvancedATR(
  high: number[],
  low: number[],
  close: number[],
  period: number = 14
): number {
  const trueRanges: number[] = [];
  for (let i = 1; i < close.length; i++) {
    const tr = Math.max(
      high[i] - low[i],
      Math.abs(high[i] - close[i - 1]),
      Math.abs(low[i] - close[i - 1])
    );
    trueRanges.push(tr);
  }

  if (trueRanges.length === 0) return 0;

  let atr = trueRanges[0];
  const k = 2 / (period + 1);
  for (let i = 1; i < trueRanges.length; i++) {
    atr = trueRanges[i] * k + atr * (1 - k);
  }
  return atr;
}

/**
 * MOTORE CORE: Calcola lo Smart Quant Score applicando i pesi dinamici
 * basati sul Regime Macroeconomico attivo (Allineamento Quantaste).
 */
export function calculateAdvancedQuantSystem(
  history: HistoricalData,
  regime: MarketRegime
) {
  const prices = history.close;
  const currentPrice = prices[prices.length - 1];

  // 1. COMPONENTE TREND (Medie Mobili Esponenziali)
  const ema10 = prices.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, prices.length);
  const ema50 = prices.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, prices.length);
  const trendScore =
    currentPrice > ema10 && ema10 > ema50 ? 100 : currentPrice < ema10 ? 15 : 50;

  // 2. COMPONENTE MOMENTUM (Chande Momentum Oscillator normalizzato 0–100)
  const cmoRaw = calculateCMO(prices, 14);
  const momentumScore = Math.round((cmoRaw + 100) / 2);

  // 3. COMPONENTE VALUTAZIONE STATISTICA (Z-Score su 22 periodi)
  const slice22 = prices.slice(-22);
  const mean = slice22.reduce((a, b) => a + b, 0) / slice22.length;
  const variance = slice22.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / slice22.length;
  const stdDev = Math.sqrt(variance);
  const zScore = (currentPrice - mean) / (stdDev || 1);

  let valuationScore: number;
  if (zScore > 2.25) valuationScore = 10;       // Estensione rialzista estrema (Fascia di Distribuzione)
  else if (zScore < -2.25) valuationScore = 95; // Sottoestensione ribassista (Fascia di Accumulazione)
  else valuationScore = Math.round(100 - (zScore + 2.25) * 22.2);

  // 4. MATRICE DEI PESI DINAMICI ADATTIVA (Quadranti Macroeconomici Quantaste)
  let weightTrend = 0.40;
  let weightMomentum = 0.30;
  let weightValuation = 0.30;

  switch (regime) {
    case 'GOLDILOCKS':
      // Crescita sana, inflazione controllata: Trend domina
      weightTrend = 0.60; weightMomentum = 0.25; weightValuation = 0.15;
      break;
    case 'REFLATION':
      // Ripresa ciclica: Trend + Momentum amplificati
      weightTrend = 0.50; weightMomentum = 0.35; weightValuation = 0.15;
      break;
    case 'STAGFLATION':
      // Inflazione senza crescita: Valuation diventa primaria
      weightTrend = 0.20; weightMomentum = 0.20; weightValuation = 0.60;
      break;
    case 'DEFLATION':
      // Contrazione: Valuation + Trend difensivo
      weightTrend = 0.30; weightMomentum = 0.20; weightValuation = 0.50;
      break;
  }

  const finalScore = Math.round(
    trendScore * weightTrend +
    momentumScore * weightMomentum +
    valuationScore * weightValuation
  );

  // 5. CALCOLO LIVELLI DI ATTENZIONE (Moltiplicatori ATR asimmetrici)
  const atr = calculateAdvancedATR(history.high, history.low, history.close, 14);
  const K_UPPER = 2.35; // Fascia di Distribuzione (resistenza statistica)
  const K_LOWER = 2.15; // Fascia di Accumulazione (supporto statistico)

  return {
    score: Math.min(Math.max(finalScore, 0), 100),
    zScoreRaw: Number(zScore.toFixed(2)),
    breakdown: {
      trend: trendScore,
      momentum: momentumScore,
      valuation: valuationScore,
    },
    levels: {
      lowerAttention: Math.round(mean - K_LOWER * atr),
      current: Math.round(currentPrice),
      upperAttention: Math.round(mean + K_UPPER * atr),
    },
  };
}
