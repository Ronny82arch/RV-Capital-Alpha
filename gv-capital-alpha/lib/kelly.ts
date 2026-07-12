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
  volatility: number = 0
): KellyResult {
  const p = Math.max(0.01, Math.min(0.99, winProbability));
  const b = Math.max(0.1, rewardRiskRatio);
  const q = 1 - p;

  const kellyFraction = (b * p - q) / b;
  const halfKelly = kellyFraction / 2;
  const expectedValue = b * p - q;

  // Penalità volatilità: riduce (mai amplifica) la size in contesti ad alta volatilità
  let volatilityPenalty = 1;
  if (volatility > 0.05) volatilityPenalty = 0.5;
  else if (volatility > 0.03) volatilityPenalty = 0.75;

  const recommendedFraction = Math.max(0, Math.min(0.20, halfKelly * volatilityPenalty));

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
  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
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
  let score = 0;
  if (rsi < 30) score += 1;
  else if (rsi > 70) score -= 1;
  if (momentum > 0.04) score += 1;
  else if (momentum < -0.04) score -= 1;
  if (priceVsSMA20 > 0 && priceVsSMA50 > 0) score += 1;
  else if (priceVsSMA20 < 0 && priceVsSMA50 < 0) score -= 1;

  const trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' =
    score >= 2 ? 'BULLISH' : score <= -2 ? 'BEARISH' : 'NEUTRAL';

  // Prior neutro: senza calibrazione storica non assumiamo nessun edge
  return { winProbability: 0.5, trend, score };
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
  const riskAmount = quantity * Math.abs(price - stopLossPrice);
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

// ─── DRAWDOWN RISK MULTIPLIER (sostituisce getAggression) ────────────────────
// RIDUCE il Kelly proporzionalmente al drawdown dal picco storico.
// Non amplifica MAI la size dopo le perdite (loss-chasing rimosso).
// Logica: più siamo lontani dal picco, meno rischiamo — esattamente il
// contrario della vecchia getAggression() che faceva l'opposto.
export function getDrawdownRiskMultiplier(
  performanceHistory: { date: string; totalValue: number }[],
  currentTotalValue: number
): { multiplier: number; drawdownPercent: number } {
  const peak = Math.max(currentTotalValue, ...performanceHistory.map(p => p.totalValue), 1);
  const drawdown = (peak - currentTotalValue) / peak;

  let multiplier = 1;
  if (drawdown > 0.15) multiplier = 0.25;      // -15% dal picco: rischio al 25%
  else if (drawdown > 0.10) multiplier = 0.50; // -10%: rischio al 50%
  else if (drawdown > 0.05) multiplier = 0.75; // -5%: rischio al 75%

  return { multiplier, drawdownPercent: drawdown * 100 };
}
