/**
 * lib/quontest.ts — Smart Quant Score engine (ispirato a Quantaste)
 *
 * FIX applicati rispetto alla versione precedente:
 * - ema10/ema50 usavano slice().reduce()/n (= SMA, non EMA) → corretti con
 *   vera EMA rolling (moltiplicatore k = 2/(n+1), Wilder convention).
 * - Regime macro hardcodato 'REFLATION' → letto da NEXT_PUBLIC_MARKET_REGIME
 *   (env var in Vercel) così cambi il regime senza deploy.
 */

interface HistoricalData {
  close: number[];
  high: number[];
  low: number[];
  volume: number[];
}

export type MarketRegime = 'AUTO' | 'GOLDILOCKS' | 'REFLATION' | 'STAGFLATION' | 'DEFLATION';

// ─── EMA CORRETTA ─────────────────────────────────────────────────────────────
function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] ?? 0;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

// ─── CHANDE MOMENTUM OSCILLATOR ──────────────────────────────────────────────
export function calculateCMO(close: number[], period = 14): number {
  if (close.length <= period) return 0;
  const clip = close.slice(-(period + 1));
  let up = 0, down = 0;
  for (let i = 1; i < clip.length; i++) {
    const diff = clip[i] - clip[i - 1];
    if (diff > 0) up += diff; else down += Math.abs(diff);
  }
  const denom = up + down;
  return denom === 0 ? 0 : ((up - down) / denom) * 100;
}

// ─── ATR CON SMOOTHING WILDER ────────────────────────────────────────────────
export function calculateAdvancedATR(
  high: number[], low: number[], close: number[], period = 14
): number {
  const trs: number[] = [];
  for (let i = 1; i < close.length; i++) {
    trs.push(Math.max(
      high[i] - low[i],
      Math.abs(high[i] - close[i - 1]),
      Math.abs(low[i]  - close[i - 1])
    ));
  }
  if (trs.length === 0) return 0;
  let atr = trs[0];
  const k = 2 / (period + 1);
  for (let i = 1; i < trs.length; i++) atr = trs[i] * k + atr * (1 - k);
  return atr;
}

// ─── SMART QUANT SCORE CON PESI ADATTIVI PER REGIME ──────────────────────────
export function calculateAdvancedQuantSystem(history: HistoricalData, regime: MarketRegime) {
  const prices = history.close;
  const currentPrice = prices[prices.length - 1];

  // 1. TREND — EMA vera (non SMA mascherata da EMA)
  const ema10 = calculateEMA(prices, 10);
  const ema50 = calculateEMA(prices, 50);
  const trendScore = currentPrice > ema10 && ema10 > ema50 ? 100
    : currentPrice < ema10 ? 15 : 50;

  // 2. MOMENTUM — CMO normalizzato 0-100
  const cmoRaw = calculateCMO(prices, 14);
  const momentumScore = Math.round((cmoRaw + 100) / 2);

  // 3. VALUATION — Z-Score su 22 periodi
  const slice22 = prices.slice(-22);
  const mean = slice22.reduce((a, b) => a + b, 0) / slice22.length;
  const variance = slice22.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / slice22.length;
  const stdDev = Math.sqrt(variance);
  const zScore = (currentPrice - mean) / (stdDev || 1);

  let valuationScore: number;
  if (zScore > 2.25)       valuationScore = 10;
  else if (zScore < -2.25) valuationScore = 95;
  else valuationScore = Math.round(95 - (zScore + 2.25) * (85 / 4.5));

  // 4. PESI ADATTIVI PER REGIME MACRO
  let wTrend = 0.40, wMomentum = 0.30, wValuation = 0.30;
  switch (regime) {
    case 'GOLDILOCKS':  wTrend = 0.60; wMomentum = 0.25; wValuation = 0.15; break;
    case 'REFLATION':   wTrend = 0.50; wMomentum = 0.35; wValuation = 0.15; break;
    case 'STAGFLATION': wTrend = 0.20; wMomentum = 0.20; wValuation = 0.60; break;
    case 'DEFLATION':   wTrend = 0.30; wMomentum = 0.20; wValuation = 0.50; break;
  }

  const finalScore = Math.round(trendScore * wTrend + momentumScore * wMomentum + valuationScore * wValuation);

  // 5. LIVELLI DI ATTENZIONE (ATR asimmetrico)
  const atr = calculateAdvancedATR(history.high, history.low, history.close, 14);
  return {
    score: Math.min(Math.max(finalScore, 0), 100),
    zScoreRaw: Number(zScore.toFixed(2)),
    breakdown: { trend: trendScore, momentum: momentumScore, valuation: valuationScore },
    levels: {
      lowerAttention: Math.round(mean - 2.15 * atr),
      current: Math.round(currentPrice),
      upperAttention: Math.round(mean + 2.35 * atr),
    },
  };
}

// ─── REGIME ATTIVO (da env, non hardcodato) ───────────────────────────────────
const VALID_REGIMES: MarketRegime[] = ['AUTO', 'GOLDILOCKS', 'REFLATION', 'STAGFLATION', 'DEFLATION'];

export function getActiveRegime(override?: string | null): MarketRegime {
  const env = (process.env.NEXT_PUBLIC_MARKET_REGIME ?? '').toUpperCase();
  const candidate = (override ?? env) as MarketRegime;
  return VALID_REGIMES.includes(candidate) ? candidate : 'AUTO';
}

export async function detectMacroRegime(): Promise<{ regime: 'GOLDILOCKS' | 'REFLATION' | 'STAGFLATION' | 'DEFLATION'; growthUp: boolean; inflationUp: boolean }> {
  try {
    const fetchTickerHistory = async (symbol: string) => {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=200d`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RV-Capital-Alpha/1.0)' }, next: { revalidate: 14400 } } // Cache 4h
      );
      if (!res.ok) return null;
      const json = await res.json();
      const close = json.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
      return close?.filter((c: number | null) => c !== null) as number[] || null;
    };

    const [sp500History, goldHistory] = await Promise.all([
      fetchTickerHistory('^GSPC'),
      fetchTickerHistory('GC=F')
    ]);

    if (!sp500History || sp500History.length === 0 || !goldHistory || goldHistory.length === 0) {
      return { regime: 'REFLATION', growthUp: true, inflationUp: true }; // fallback
    }

    const currentSP = sp500History[sp500History.length - 1];
    const smaSP = sp500History.reduce((a, b) => a + b, 0) / sp500History.length;
    const growthUp = currentSP > smaSP;

    const currentGold = goldHistory[goldHistory.length - 1];
    const smaGold = goldHistory.reduce((a, b) => a + b, 0) / goldHistory.length;
    const inflationUp = currentGold > smaGold;

    let regime: 'GOLDILOCKS' | 'REFLATION' | 'STAGFLATION' | 'DEFLATION' = 'REFLATION';
    if (growthUp && inflationUp) regime = 'REFLATION';
    else if (growthUp && !inflationUp) regime = 'GOLDILOCKS';
    else if (!growthUp && inflationUp) regime = 'STAGFLATION';
    else if (!growthUp && !inflationUp) regime = 'DEFLATION';

    return { regime, growthUp, inflationUp };
  } catch (err) {
    console.error('Failed to detect macro regime:', err);
    return { regime: 'REFLATION', growthUp: true, inflationUp: true };
  }
}
