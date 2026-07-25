// ─── KELLY CRITERION ─────────────────────────────────────────────────────────
export interface KellyResult {
  kellyFraction: number;
  halfKelly: number;
  expectedValue: number;
  recommendedFraction: number;
}

export function calculateKelly(
  winProbability: number,
  rewardRiskRatio: number,
  volatility: number = 0,
  targetAnnualReturn: number = 0.25,
  momentumScore: number = 0 // Nuova parametrizzazione Momentum
): KellyResult {
  const p = Math.max(0.01, Math.min(0.99, winProbability));
  const b = Math.max(0.1, rewardRiskRatio);
  const q = 1 - p;

  const kellyFraction = (b * p - q) / b;
  const halfKelly = kellyFraction / 2;
  const expectedValue = b * p - q;

  // Inverse Volatility Scaling (Risk Parity)
  const BASELINE_VOL = 0.015;
  const volatilityPenalty = volatility > 0 ? Math.min(1.0, BASELINE_VOL / volatility) : 1.0;

  // Dynamic Target Adaptation
  const targetMultiplier = Math.max(0.25, Math.min(1.0, Math.sqrt(targetAnnualReturn)));

  // Fractional Kelly (gamma factor): typically 0.20 - 0.50 to reduce volatility
  const gamma = 0.20 + (targetMultiplier - 0.25) * (0.30 / 0.75); 
  
  // Limite massimo rigido (Cap): 5% di base. Con forte momentum (score > 1), si alza fino al 10% (Kelly Momentum)
  const baseCap = 0.05;
  const momentumBoost = Math.max(0, Math.min(0.05, momentumScore * 0.025)); // +2.5% ogni +1 di score
  const maxCap = baseCap + momentumBoost; 

  const dynamicKelly = kellyFraction * gamma;
  
  const recommendedFraction = Math.max(0, Math.min(maxCap, dynamicKelly * volatilityPenalty));

  return {
    kellyFraction: Math.max(0, kellyFraction),
    halfKelly: Math.max(0, halfKelly),
    expectedValue,
    recommendedFraction,
  };
}

// ─── INDICATORI TECNICI ───────────────────────────────────────────────────────
export function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  const changes = prices.slice(1).map((p, i) => p - prices[i]);
  const gains = changes.map(c => (c > 0 ? c : 0));
  const losses = changes.map(c => (c < 0 ? -c : 0));
  // First avgGain/avgLoss as simple moving average
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  // Wilder's smoothing
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }
  
  if (avgLoss === 0) return 100;
  return Math.round(100 - 100 / (1 + avgGain / avgLoss));
}

export function calculateSMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export function calculateEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

export function calculateMomentum(prices: number[], period = 20): number {
  if (prices.length < period) return 0;
  const current = prices[prices.length - 1];
  const past = prices[prices.length - period];
  return past === 0 ? 0 : (current - past) / past;
}

export function calculateVolatility(prices: number[], period = 20): number {
  if (prices.length < period) return 0;
  const slice = prices.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  if (mean === 0) return 0;
  const variance = slice.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / slice.length;
  return Math.sqrt(variance) / mean;
}

export function calculateATR(
  history: { high?: number; low?: number; close: number }[],
  period = 14
): number {
  if (history.length < 2) return 0;
  const trueRanges: number[] = [];
  
  for (let i = 1; i < history.length; i++) {
    const current = history[i];
    const prevClose = history[i - 1].close;
    const high = current.high ?? current.close;
    const low = current.low ?? current.close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }
  
  if (trueRanges.length === 0) return 0;
  
  // Wilder's Smoothing for ATR
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }
  return atr;
}

// ─── WIN PROBABILITY — FALLBACK NEUTRO ───────────────────────────────────────
// USATO SOLO se la tabella di calibrazione storica (lib/backtest.ts) non è
// ancora disponibile (primo deploy, prima che /api/cron/calibrate giri).
// Non genera numeri arbitrari: rimane al 50% (prior neutro, nessun edge assunto).
// La probabilità reale viene da lookupCalibratedProbability() in lib/backtest.ts.
export interface TechnicalScore {
  winProbability: number;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  score: number;
}

export function estimateFallbackWinProbability(
  rsi: number,
  momentum: number,
  priceVsSMA20: number,
  priceVsSMA50: number
): TechnicalScore {
  // Pure moving average trend definition
  const trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 
    (priceVsSMA20 > 0 && priceVsSMA50 > 0) ? 'BULLISH' : 
    (priceVsSMA20 < 0 && priceVsSMA50 < 0) ? 'BEARISH' : 'NEUTRAL';

  // Maximum Entropy Principle: senza calibrazione storica non assumiamo nessun edge
  return { winProbability: 0.5, trend, score: 0 };
}

// ─── POSITION SIZING ──────────────────────────────────────────────────────────
export function calculatePositionSize(
  capitalAvailable: number,
  kellyFraction: number,
  price: number,
  stopLossPrice: number
): { capitalToAllocate: number; quantity: number; riskAmount: number } {
  const capitalToAllocate = Math.floor(capitalAvailable * kellyFraction / 10) * 10;
  if (price === 0) return { capitalToAllocate: 0, quantity: 0, riskAmount: 0 };
  const quantity = Math.floor(capitalToAllocate / price);
  const actualCapital = quantity * price;

  // Bug 7: se il capitale effettivo scende sotto il limite minimo, azzera la size invece di gonfiarla
  if (actualCapital < 100) {
    return { capitalToAllocate: 0, quantity: 0, riskAmount: 0 };
  }

  const clampedQty = Math.max(1, quantity);
  const riskAmount = clampedQty * Math.abs(price - stopLossPrice);
  return {
    capitalToAllocate: actualCapital,
    quantity: clampedQty,
    riskAmount,
  };
}

// ─── PORTFOLIO MATH ───────────────────────────────────────────────────────────
export function calculateDaysToTarget(
  currentPnl: number,
  targetAnnualPnl: number,
  startDate: string
): number {
  const daysPassed = Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000);
  const daysRemaining = 365 - daysPassed;
  const pnlNeeded = targetAnnualPnl - currentPnl;
  if (pnlNeeded <= 0) return 0;
  if (daysPassed === 0) return 365;
  const dailyRate = currentPnl / daysPassed;
  if (dailyRate <= 0) return daysRemaining;
  return Math.min(daysRemaining, Math.ceil(pnlNeeded / dailyRate));
}

export function isAheadOfTarget(
  currentPnlPercent: number,
  targetAnnualPercent: number,
  startDate: string
): boolean {
  const daysPassed = Math.max(1, Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000));
  const proRataTarget = (targetAnnualPercent / 365) * daysPassed;
  return currentPnlPercent >= proRataTarget;
}

// ─── DRAWDOWN RISK MULTIPLIER (Continuous Anti-Martingale) ───────────────────
// RIDUCE il Kelly in modo lineare proporzionalmente al drawdown dal picco.
// Fissa il limite di "Rovina" al 20%. Se drawdown >= 20%, rischio = 0.
export function getDrawdownRiskMultiplier(
  performanceHistory: { date: string; totalValue: number }[],
  currentTotalValue: number
): { multiplier: number; drawdownPercent: number } {
  const peak = Math.max(currentTotalValue, ...performanceHistory.map(p => p.totalValue), 1);
  const drawdown = (peak - currentTotalValue) / peak;

  const MAX_DRAWDOWN = 0.20;
  const multiplier = Math.max(0, 1 - (drawdown / MAX_DRAWDOWN));

  return { multiplier, drawdownPercent: drawdown * 100 };
}
