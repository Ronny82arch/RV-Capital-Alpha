// ─── KELLY CRITERION v2 — Risk-Based Sizing, No Target Chasing ──────────────

export interface KellyResult {
  kellyFraction: number;
  quarterKelly: number;
  expectedValue: number;
  recommendedFraction: number;
}

/**
 * Calcola il Fractional Kelly Criterion.
 * 
 * @param winProbability Probabilità di successo (0-1)
 * @param rewardRiskRatio Rapporto avgWin / avgLoss (b)
 * @param volatility Deviazione standard dei rendimenti giornalieri
 * @param hardCap Cap assoluto massimo (default 3% Satellite, 1% TBD)
 */
export function calculateKelly(
  winProbability: number,
  rewardRiskRatio: number,
  volatility: number = 0,
  hardCap: number = 0.03
): KellyResult {
  const p = Math.max(0.01, Math.min(0.99, winProbability));
  const b = Math.max(0.1, rewardRiskRatio);
  const q = 1 - p;

  // Kelly base
  const kellyFraction = (b * p - q) / b;
  const quarterKelly = kellyFraction * 0.25;

  // Expected value del trade
  const expectedValue = b * p - q;

  // Volatility penalty: più volatile = più piccolo
  const BASELINE_VOL = 0.015;
  const volatilityPenalty = volatility > 0 
    ? Math.min(1.0, BASELINE_VOL / volatility) 
    : 1.0;

  // Quarter-Kelly fisso, nessun adattamento al target
  const recommendedFraction = Math.max(0, Math.min(hardCap, quarterKelly * volatilityPenalty));

  return {
    kellyFraction: Math.max(0, kellyFraction),
    quarterKelly: Math.max(0, quarterKelly),
    expectedValue,
    recommendedFraction,
  };
}

// ─── INDICATORI TECNICI (invariati, ma EMA corretta) ─────────────────────────

export function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  const changes = prices.slice(1).map((p, i) => p - prices[i]);
  const gains = changes.map(c => (c > 0 ? c : 0));
  const losses = changes.map(c => (c < 0 ? -c : 0));
  
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
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
  if (prices.length < period + 1) return 0;
  const slice = prices.slice(-(period + 1));
  const returns: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    if (slice[i - 1] === 0) continue;
    returns.push((slice[i] - slice[i - 1]) / slice[i - 1]);
  }
  if (returns.length === 0) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  return Math.sqrt(variance);
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
    
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trueRanges.push(tr);
  }
  
  if (trueRanges.length === 0) return 0;
  
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }
  return atr;
}

// ─── FALLBACK NEUTRO ─────────────────────────────────────────────────────────

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
  const trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 
    (priceVsSMA20 > 0 && priceVsSMA50 > 0) ? 'BULLISH' : 
    (priceVsSMA20 < 0 && priceVsSMA50 < 0) ? 'BEARISH' : 'NEUTRAL';

  return { winProbability: 0.5, trend, score: 0 };
}

// ─── POSITION SIZING ─────────────────────────────────────────────────────────

export function calculatePositionSize(
  capitalAvailable: number,
  kellyFraction: number,
  price: number,
  stopLossPrice: number,
  allowFractional: boolean = false
): { capitalToAllocate: number; quantity: number; riskAmount: number } {
  if (price === 0) return { capitalToAllocate: 0, quantity: 0, riskAmount: 0 };
  
  const capitalToAllocate = Math.floor(capitalAvailable * kellyFraction / 10) * 10;
  if (capitalToAllocate < 100) {
    return { capitalToAllocate: 0, quantity: 0, riskAmount: 0 };
  }

  let quantity: number;
  if (allowFractional) {
    quantity = capitalToAllocate / price;
  } else {
    quantity = Math.floor(capitalToAllocate / price);
  }
  
  const actualCapital = quantity * price;
  if (actualCapital < 100) {
    return { capitalToAllocate: 0, quantity: 0, riskAmount: 0 };
  }

  const clampedQty = Math.max(allowFractional ? 0.001 : 1, quantity);
  const riskAmount = clampedQty * Math.abs(price - stopLossPrice);
  
  return {
    capitalToAllocate: actualCapital,
    quantity: clampedQty,
    riskAmount,
  };
}

// ─── PORTFOLIO MATH (invariato) ──────────────────────────────────────────────

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

// ─── DRAWDOWN MULTIPLIER — DEPRECATO, mantenuto per compatibilità ────────────
// Nel nuovo sistema il drawdown è gestito da Antigravity (allocazione bucket),
// NON dal Kelly sizing. Questa funzione resta per non rompere import esistenti.

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
