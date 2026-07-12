/**
 * lib/backtest.ts — Calibrazione storica walk-forward
 *
 * Sostituisce lo score euristico di estimateWinProbability() con probabilità
 * empiricamente osservate. Zero lookahead bias: il setup al giorno T è calcolato
 * solo sui dati fino a T; l'esito (TP/SL/time-exit) è misurato sui giorni T+1..T+N.
 * Bayesian shrinkage: con pochi dati, la stima rimane vicina al prior neutro 50%.
 */

import { calculateRSI, calculateSMA, calculateMomentum, calculateVolatility, calculateATR } from './kelly';

// ─── BUCKET DEFINITIONS ───────────────────────────────────────────────────────
export type RsiBucket     = 'oversold' | 'low' | 'mid' | 'high' | 'overbought';
export type MomentumBucket = 'strong_down' | 'down' | 'flat' | 'up' | 'strong_up';
export type TrendBucket   = 'above_both' | 'above20_below50' | 'below20_above50' | 'below_both';

export function bucketRSI(rsi: number): RsiBucket {
  if (rsi < 30) return 'oversold';
  if (rsi < 45) return 'low';
  if (rsi < 55) return 'mid';
  if (rsi < 70) return 'high';
  return 'overbought';
}

export function bucketMomentum(m: number): MomentumBucket {
  if (m < -0.06) return 'strong_down';
  if (m < -0.015) return 'down';
  if (m < 0.015) return 'flat';
  if (m < 0.06) return 'up';
  return 'strong_up';
}

export function bucketTrend(priceVsSMA20: number, priceVsSMA50: number): TrendBucket {
  if (priceVsSMA20 > 0 && priceVsSMA50 > 0) return 'above_both';
  if (priceVsSMA20 > 0) return 'above20_below50';
  if (priceVsSMA50 > 0) return 'below20_above50';
  return 'below_both';
}

export function setupKey(r: RsiBucket, m: MomentumBucket, t: TrendBucket): string {
  return `${r}|${m}|${t}`;
}

// ─── BAYESIAN SHRINKAGE ───────────────────────────────────────────────────────
// Beta-Binomial prior equivalente a Beta(10,10) — "vale" 20 osservazioni
// virtuali al 50%. Con campione piccolo → 50%; con campione grande → win rate reale.
const PRIOR_WIN_RATE = 0.50;
const PRIOR_WEIGHT   = 20;

export function shrinkWinRate(wins: number, total: number): number {
  if (total <= 0) return PRIOR_WIN_RATE;
  return (wins + PRIOR_WIN_RATE * PRIOR_WEIGHT) / (total + PRIOR_WEIGHT);
}

// ─── TIPI ─────────────────────────────────────────────────────────────────────
export interface CalibrationEntry {
  setupKey: string;
  sampleSize: number;
  wins: number;
  empiricalWinRate: number;
  shrunkWinRate: number;
  avgWinReturn: number;
  avgLossReturn: number;
}

export type CalibrationTable = Record<string, CalibrationEntry>;

interface Bar { date: string; close: number; high?: number; low?: number; }

// ─── WALK-FORWARD CALIBRATION (singolo simbolo) ───────────────────────────────
// La regola SL/TP DEVE essere identica a quella usata in lib/ai.ts::analyzeAsset()
// altrimenti la probabilità calibrata si riferirebbe a un trade diverso da
// quello effettivamente eseguito.
export function calibrateSetupsForSymbol(
  history: Bar[],
  holdingDays = 10
): Map<string, { wins: number; total: number; winReturns: number[]; lossReturns: number[] }> {
  const closes = history.map(h => h.close);
  const out = new Map<string, { wins: number; total: number; winReturns: number[]; lossReturns: number[] }>();
  const minLookback = 55;

  for (let t = minLookback; t < history.length - 1; t++) {
    const w = closes.slice(0, t + 1);
    const price = w[w.length - 1];

    const rsi  = calculateRSI(w);
    const sma20 = calculateSMA(w, 20);
    const sma50 = calculateSMA(w, 50);
    const momentum = calculateMomentum(w, 20);
    const volatility = calculateVolatility(w, 20);

    const key = setupKey(
      bucketRSI(rsi),
      bucketMomentum(momentum),
      bucketTrend(price - sma20, price - sma50)
    );

    // Stessa regola di ai.ts::analyzeAsset() (ATR based)
    const atrHistory = history.slice(0, t + 1);
    const atr = calculateATR(atrHistory, 14);
    const atrPct = atr / price;
    const slPct = atrPct > 0 ? atrPct * 2.0 : 0.05;
    const tpPct = slPct * 2.0;
    const stopPrice   = price * (1 - slPct);
    const targetPrice = price * (1 + tpPct);

    let outcome: 'win' | 'loss' | null = null;
    let exitReturn = 0;
    const lastIdx = Math.min(t + holdingDays, history.length - 1);

    for (let f = t + 1; f <= lastIdx; f++) {
      const bar = history[f];
      const lo = bar.low  ?? bar.close;
      const hi = bar.high ?? bar.close;
      // Ordine conservativo: se entrambi vengono toccati nello stesso giorno → loss
      if (lo <= stopPrice)   { outcome = 'loss'; exitReturn = -slPct; break; }
      if (hi >= targetPrice) { outcome = 'win';  exitReturn = tpPct;  break; }
    }

    if (outcome === null) {
      // Time-based exit
      const exitClose = history[lastIdx].close;
      exitReturn = (exitClose - price) / price;
      outcome = exitReturn > 0 ? 'win' : 'loss';
    }

    const e = out.get(key) || { wins: 0, total: 0, winReturns: [], lossReturns: [] };
    e.total += 1;
    if (outcome === 'win') { e.wins += 1; e.winReturns.push(exitReturn); }
    else { e.lossReturns.push(exitReturn); }
    out.set(key, e);
  }

  return out;
}

// ─── TABELLA COMPLETA (tutti i simboli) ──────────────────────────────────────
export function buildCalibrationTable(
  historyBySymbol: Record<string, Bar[]>,
  holdingDays = 10
): CalibrationTable {
  const merged = new Map<string, { wins: number; total: number; winReturns: number[]; lossReturns: number[] }>();

  for (const symbol of Object.keys(historyBySymbol)) {
    const perSymbol = calibrateSetupsForSymbol(historyBySymbol[symbol], holdingDays);
    for (const [key, v] of Array.from(perSymbol.entries())) {
      const acc = merged.get(key) || { wins: 0, total: 0, winReturns: [], lossReturns: [] };
      acc.wins += v.wins;
      acc.total += v.total;
      acc.winReturns.push(...v.winReturns);
      acc.lossReturns.push(...v.lossReturns);
      merged.set(key, acc);
    }
  }

  const table: CalibrationTable = {};
  for (const [key, v] of Array.from(merged.entries())) {
    const avgWin  = v.winReturns.length  ? v.winReturns.reduce((a: number, b: number)=>a+b,0)  / v.winReturns.length  : 0;
    const avgLoss = v.lossReturns.length ? Math.abs(v.lossReturns.reduce((a: number, b: number)=>a+b,0) / v.lossReturns.length) : 0;
    table[key] = {
      setupKey: key,
      sampleSize: v.total,
      wins: v.wins,
      empiricalWinRate: v.total ? v.wins / v.total : PRIOR_WIN_RATE,
      shrunkWinRate: shrinkWinRate(v.wins, v.total),
      avgWinReturn: avgWin,
      avgLossReturn: avgLoss,
    };
  }
  return table;
}

// ─── LOOKUP LIVE ──────────────────────────────────────────────────────────────
export const MIN_TRUSTED_SAMPLE_SIZE = 30;

export function lookupCalibratedProbability(
  table: CalibrationTable,
  rsi: number,
  momentum: number,
  priceVsSMA20: number,
  priceVsSMA50: number
): { winProbability: number; sampleSize: number; trusted: boolean; setupKey: string } {
  const key = setupKey(bucketRSI(rsi), bucketMomentum(momentum), bucketTrend(priceVsSMA20, priceVsSMA50));
  const entry = table[key];
  if (!entry) return { winProbability: PRIOR_WIN_RATE, sampleSize: 0, trusted: false, setupKey: key };
  return {
    winProbability: entry.shrunkWinRate,
    sampleSize: entry.sampleSize,
    trusted: entry.sampleSize >= MIN_TRUSTED_SAMPLE_SIZE,
    setupKey: key,
  };
}
