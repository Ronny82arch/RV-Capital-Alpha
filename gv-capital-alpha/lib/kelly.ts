// ─── KELLY CRITERION ─────────────────────────────────────────────────────────
export interface KellyResult {
  kellyFraction: number;
  halfKelly: number;
  expectedValue: number;
  recommendedFraction: number; // capped, safe version
}

export function calculateKelly(winProbability: number, rewardRiskRatio: number): KellyResult {
  const p = Math.max(0.01, Math.min(0.99, winProbability));
  const b = Math.max(0.1, rewardRiskRatio);
  const q = 1 - p;

  // Kelly formula: f* = (bp - q) / b
  const kellyFraction = (b * p - q) / b;
  const halfKelly = kellyFraction / 2;
  const expectedValue = b * p - q;

  // Safety cap: max 20% of available capital per trade, use half-Kelly
  const recommendedFraction = Math.max(0, Math.min(0.20, halfKelly));

  return {
    kellyFraction: Math.max(0, kellyFraction),
    halfKelly: Math.max(0, halfKelly),
    expectedValue,
    recommendedFraction,
  };
}

// ─── TECHNICAL INDICATORS ─────────────────────────────────────────────────────
export function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;

  const changes = prices.slice(1).map((p, i) => p - prices[i]);
  const gains = changes.map(c => (c > 0 ? c : 0));
  const losses = changes.map(c => (c < 0 ? -c : 0));

  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round(100 - 100 / (1 + rs));
}

export function calculateSMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export function calculateMomentum(prices: number[], period = 20): number {
  if (prices.length < period) return 0;
  const current = prices[prices.length - 1];
  const past = prices[prices.length - period];
  if (past === 0) return 0;
  return (current - past) / past;
}

export function calculateVolatility(prices: number[], period = 20): number {
  if (prices.length < period) return 0;
  const slice = prices.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  const variance = slice.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / slice.length;
  return Math.sqrt(variance) / mean; // coefficient of variation
}

// ─── WIN PROBABILITY ESTIMATOR ────────────────────────────────────────────────
export interface TechnicalScore {
  winProbability: number;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  score: number; // raw composite score
}

export function estimateWinProbability(
  rsi: number,
  momentum: number,
  priceVsSMA20: number, // positive = price above SMA20
  priceVsSMA50: number,
  volatility: number
): TechnicalScore {
  let score = 0;

  // RSI signals
  if (rsi < 30) score += 25;       // strongly oversold = buy opportunity
  else if (rsi < 40) score += 15;
  else if (rsi < 50) score += 5;
  else if (rsi > 70) score -= 20;  // overbought = avoid
  else if (rsi > 60) score -= 8;

  // Momentum (20-day price change)
  if (momentum > 0.08) score += 20;
  else if (momentum > 0.04) score += 12;
  else if (momentum > 0.01) score += 5;
  else if (momentum < -0.08) score -= 20;
  else if (momentum < -0.04) score -= 12;
  else if (momentum < -0.01) score -= 5;

  // Price vs moving averages
  if (priceVsSMA20 > 0 && priceVsSMA50 > 0) score += 15;   // above both = strong trend
  else if (priceVsSMA20 > 0 && priceVsSMA50 < 0) score += 5; // above 20, below 50 = recovering
  else if (priceVsSMA20 < 0 && priceVsSMA50 < 0) score -= 15; // below both = downtrend
  else if (priceVsSMA20 < 0 && priceVsSMA50 > 0) score -= 8;  // breakdown signal

  // Volatility penalty (high vol = less predictable)
  if (volatility > 0.04) score -= 10;
  else if (volatility < 0.015) score += 5;

  // Normalize to probability (0.35 to 0.72 range)
  const normalized = 0.35 + (score + 50) / 100 * 0.37;
  const winProbability = Math.max(0.35, Math.min(0.72, normalized));

  const trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' =
    score > 15 ? 'BULLISH' : score < -15 ? 'BEARISH' : 'NEUTRAL';

  return { winProbability, trend, score };
}

// ─── POSITION SIZING ──────────────────────────────────────────────────────────
export function calculatePositionSize(
  capitalAvailable: number,
  kellyFraction: number,
  price: number,
  stopLossPrice: number
): { capitalToAllocate: number; quantity: number; riskAmount: number } {
  const capitalToAllocate = Math.floor(capitalAvailable * kellyFraction / 10) * 10; // round to €10
  const quantity = Math.floor(capitalToAllocate / price);
  const actualCapital = quantity * price;
  const riskAmount = quantity * (price - stopLossPrice);

  return {
    capitalToAllocate: Math.max(100, actualCapital),
    quantity: Math.max(1, quantity),
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
  const daysInYear = 365;
  const daysRemaining = daysInYear - daysPassed;
  const pnlNeeded = targetAnnualPnl - currentPnl;

  if (pnlNeeded <= 0) return 0;
  if (daysPassed === 0) return daysInYear;

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

export function getAggression(
  currentPnlPercent: number,
  targetAnnualPercent: number,
  startDate: string
): 'CONSERVATIVE' | 'NORMAL' | 'AGGRESSIVE' {
  const daysPassed = Math.max(1, Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000));
  const proRataTarget = (targetAnnualPercent / 365) * daysPassed;
  const ratio = currentPnlPercent / proRataTarget;

  if (ratio > 1.3) return 'CONSERVATIVE'; // well ahead = protect gains
  if (ratio < 0.6) return 'AGGRESSIVE';   // behind = push harder
  return 'NORMAL';
}
