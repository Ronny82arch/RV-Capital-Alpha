/**
 * lib/backtest.ts — Calibrazione storica walk-forward v2
 * 
 * FIX per pochi dati:
 * - Bucket ridotti: 18 celle (3×3×2) invece di 100 (5×5×4)
 * - Hierarchical shrinkage: pooling per classe di asset (Crypto/Tech/ETF)
 * - Conformal prediction: intervallo di confidenza su ogni probabilità
 * - Due orizzonti: 30gg (Satellite) e 3gg (TBD)
 * - Bayesian online learning: aggiorna dopo ogni trade reale
 */

import { calculateRSI, calculateSMA, calculateMomentum, calculateVolatility, calculateATR } from './kelly';
import { jStat } from 'jstat';

// ─── BUCKET DEFINITIONS (ridotti per avere più osservazioni per cella) ───────

export type RsiBucket = 'oversold' | 'mid' | 'overbought';
export type MomentumBucket = 'negative' | 'neutral' | 'positive';
export type TrendBucket = 'above_sma50' | 'below_sma50';
export type AssetClass = 'CRYPTO' | 'TECH' | 'ETF' | 'FINANCE' | 'HEALTHCARE' | 'OTHER';

export function bucketRSI(rsi: number): RsiBucket {
  if (rsi < 35) return 'oversold';
  if (rsi > 65) return 'overbought';
  return 'mid';
}

export function bucketMomentum(m: number): MomentumBucket {
  if (m < -0.03) return 'negative';
  if (m > 0.03) return 'positive';
  return 'neutral';
}

export function bucketTrend(priceVsSMA50: number): TrendBucket {
  return priceVsSMA50 > 0 ? 'above_sma50' : 'below_sma50';
}

export function setupKey(r: RsiBucket, m: MomentumBucket, t: TrendBucket): string {
  return `${r}|${m}|${t}`;
}

export function assetClassOf(symbol: string, type: 'CRYPTO' | 'STOCK' | 'ETF'): AssetClass {
  if (type === 'CRYPTO') return 'CRYPTO';
  if (type === 'ETF') return 'ETF';
  const tech = ['NVDA','AAPL','MSFT','META','AMD','TSM','TSLA'];
  const finance = ['JPM','COIN','BAC','V','MA','GS'];
  const health = ['LLY','NVO','JNJ','UNH','MRK','PFE'];
  if (tech.includes(symbol)) return 'TECH';
  if (finance.includes(symbol)) return 'FINANCE';
  if (health.includes(symbol)) return 'HEALTHCARE';
  return 'OTHER';
}

// ─── MACRO FEATURES (opzionale, stratifica ulteriormente i dati) ─────────────

export type VixBucket = 'low' | 'mid' | 'high';
export type YieldBucket = 'normal' | 'flat' | 'inverted';

export function bucketVIX(vix: number): VixBucket {
  if (vix < 15) return 'low';
  if (vix > 25) return 'high';
  return 'mid';
}

export function bucketYieldCurve(spread10y2y: number): YieldBucket {
  if (spread10y2y > 0.8) return 'normal';
  if (spread10y2y < 0) return 'inverted';
  return 'flat';
}

// ─── TIPI ─────────────────────────────────────────────────────────────────────

export interface CalibrationEntry {
  setupKey: string;
  assetClass?: AssetClass;
  sampleSize: number;
  wins: number;
  empiricalWinRate: number;
  shrunkWinRate: number;
  /** Intervallo di confidenza 90% (Clopper-Pearson) */
  confidenceLower: number;
  confidenceUpper: number;
  avgWinReturn: number;
  avgLossReturn: number;
  timeCappedCount: number;
}

export type CalibrationTable = Record<string, CalibrationEntry>;

export interface HierarchicalStats {
  classWins: number;
  classTotal: number;
  classRate: number;
}

// ─── PRIOR BAYESIANO ──────────────────────────────────────────────────────────

const PRIOR_WIN_RATE = 0.50;
const PRIOR_WEIGHT = 20; // equivalente a Beta(10,10)

export function shrinkWinRate(wins: number, total: number): number {
  if (total <= 0) return PRIOR_WIN_RATE;
  return (wins + PRIOR_WIN_RATE * PRIOR_WEIGHT) / (total + PRIOR_WEIGHT);
}

// ─── CONFORMAL PREDICTION: Intervallo Clopper-Pearson ─────────────────────────

/**
 * Intervallo esatto per proporzione binomiale.
 * Se il lower bound include il 50%, il setup non ha edge statistico.
 */
export function clopperPearsonInterval(
  wins: number,
  total: number,
  confidence: number = 0.90
): [number, number] {
  if (total === 0) return [0, 1];
  const alpha = 1 - confidence;

  let lower: number;
  if (wins === 0) {
    lower = 0;
  } else {
    lower = jStat.beta.inv(alpha / 2, wins, total - wins + 1);
  }

  let upper: number;
  if (wins === total) {
    upper = 1;
  } else {
    upper = jStat.beta.inv(1 - alpha / 2, wins + 1, total - wins);
  }

  return [lower, upper];
}

// ─── HIERARCHICAL SHRINKAGE (James-Stein semplificato) ────────────────────────

export function hierarchicalShrinkWinRate(
  assetWins: number,
  assetTotal: number,
  classWins: number,
  classTotal: number
): { rate: number; weightToClass: number } {
  const assetRate = assetTotal > 0 ? assetWins / assetTotal : PRIOR_WIN_RATE;
  const classRate = classTotal > 0 ? classWins / classTotal : PRIOR_WIN_RATE;

  // Più hai pochi dati, più ti avvicini alla media della classe
  const shrinkageWeight = Math.min(0.8, PRIOR_WEIGHT / (assetTotal + PRIOR_WEIGHT));

  const blended = assetRate * (1 - shrinkageWeight) + classRate * shrinkageWeight;
  return { rate: blended, weightToClass: shrinkageWeight };
}

// ─── WALK-FORWARD CALIBRATION (singolo simbolo, holding parametrizzato) ──────

interface Bar { date: string; close: number; high?: number; low?: number; }

export function calibrateSetupsForSymbol(
  history: Bar[],
  holdingDays: number = 30,
  symbol: string = '',
  type: 'CRYPTO' | 'STOCK' | 'ETF' = 'STOCK'
): Map<string, { wins: number; total: number; winReturns: number[]; lossReturns: number[]; timeCapped: number; assetClass: AssetClass }> {
  
  const closes = history.map(h => h.close);
  const out = new Map<string, { wins: number; total: number; winReturns: number[]; lossReturns: number[]; timeCapped: number; assetClass: AssetClass }>();
  const minLookback = 55;
  const assetClass = assetClassOf(symbol, type);

  for (let t = minLookback; t < history.length - 1; t++) {
    const w = closes.slice(0, t + 1);
    const price = w[w.length - 1];

    const rsi = calculateRSI(w);
    const sma50 = calculateSMA(w, 50);
    const momentum = calculateMomentum(w, 20);

    const key = setupKey(
      bucketRSI(rsi),
      bucketMomentum(momentum),
      bucketTrend(price - sma50)
    );

    // SL/TP identici a quelli usati in produzione (ATR-based)
    const atrHistory = history.slice(0, t + 1);
    const atr = calculateATR(atrHistory, 14);
    const atrPct = atr / price;
    const slPct = atrPct > 0 ? atrPct * 2.0 : 0.05;
    const tpPct = slPct * 2.0;
    const stopPrice = price * (1 - slPct);
    const targetPrice = price * (1 + tpPct);

    let outcome: 'win' | 'loss' | null = null;
    let exitReturn = 0;
    let wasTimeCapped = false;
    const slippagePct = 0.0015;
    const lastIdx = Math.min(t + holdingDays, history.length - 1);

    for (let f = t + 1; f <= lastIdx; f++) {
      const bar = history[f];
      const lo = bar.low ?? bar.close;
      const hi = bar.high ?? bar.close;
      if (lo <= stopPrice) { outcome = 'loss'; exitReturn = -slPct - slippagePct; break; }
      if (hi >= targetPrice) { outcome = 'win'; exitReturn = tpPct - slippagePct; break; }
    }

    if (outcome === null) {
      wasTimeCapped = true;
      const exitClose = history[lastIdx].close;
      exitReturn = ((exitClose - price) / price) - slippagePct;
      outcome = exitReturn > 0 ? 'win' : 'loss';
    }

    const e = out.get(key) || { wins: 0, total: 0, winReturns: [], lossReturns: [], timeCapped: 0, assetClass };
    e.total += 1;
    if (outcome === 'win') { e.wins += 1; e.winReturns.push(exitReturn); }
    else { e.lossReturns.push(exitReturn); }
    if (wasTimeCapped) e.timeCapped += 1;
    out.set(key, e);
  }

  return out;
}

// ─── TABELLA COMPLETA CON HIERARCHICAL SHRINKAGE ─────────────────────────────

export function buildCalibrationTable(
  historyBySymbol: Record<string, { history: Bar[]; type: 'CRYPTO' | 'STOCK' | 'ETF' }>,
  holdingDays: number = 30
): { table: CalibrationTable; classStats: Record<AssetClass, HierarchicalStats> } {
  
  // Prima passata: raccogli dati grezzi per asset e per classe
  const perAsset = new Map<string, { wins: number; total: number; winReturns: number[]; lossReturns: number[]; timeCapped: number; assetClass: AssetClass }>();
  const perClass = new Map<AssetClass, { wins: number; total: number }>();

  for (const [symbol, { history, type }] of Object.entries(historyBySymbol)) {
    const symbolMap = calibrateSetupsForSymbol(history, holdingDays, symbol, type);
    for (const [key, v] of Array.from(symbolMap.entries())) {
      // Merge per setup key
      const acc = perAsset.get(key) || { wins: 0, total: 0, winReturns: [], lossReturns: [], timeCapped: 0, assetClass: v.assetClass };
      acc.wins += v.wins;
      acc.total += v.total;
      acc.winReturns.push(...v.winReturns);
      acc.lossReturns.push(...v.lossReturns);
      acc.timeCapped += v.timeCapped;
      perAsset.set(key, acc);

      // Accumula per classe
      const cls = perClass.get(v.assetClass) || { wins: 0, total: 0 };
      cls.wins += v.wins;
      cls.total += v.total;
      perClass.set(v.assetClass, cls);
    }
  }

  // Seconda passata: applica hierarchical shrinkage
  const table: CalibrationTable = {};
  for (const [key, v] of Array.from(perAsset.entries())) {
    const cls = perClass.get(v.assetClass) || { wins: 0, total: 0 };
    const hierarchical = hierarchicalShrinkWinRate(v.wins, v.total, cls.wins, cls.total);

    const avgWin = v.winReturns.length ? v.winReturns.reduce((a, b) => a + b, 0) / v.winReturns.length : 0;
    const avgLoss = v.lossReturns.length ? Math.abs(v.lossReturns.reduce((a, b) => a + b, 0) / v.lossReturns.length) : 0;
    
    const [confLow, confHigh] = clopperPearsonInterval(v.wins, v.total, 0.90);

    table[key] = {
      setupKey: key,
      assetClass: v.assetClass,
      sampleSize: v.total,
      wins: v.wins,
      empiricalWinRate: v.total ? v.wins / v.total : PRIOR_WIN_RATE,
      shrunkWinRate: hierarchical.rate,
      confidenceLower: confLow,
      confidenceUpper: confHigh,
      avgWinReturn: avgWin,
      avgLossReturn: avgLoss,
      timeCappedCount: v.timeCapped,
    };
  }

  // Esporta anche le stats di classe per debug
  const classStats: Record<AssetClass, HierarchicalStats> = {} as any;
  for (const [cls, s] of Array.from(perClass.entries())) {
    classStats[cls] = { classWins: s.wins, classTotal: s.total, classRate: s.total ? s.wins / s.total : PRIOR_WIN_RATE };
  }

  return { table, classStats };
}

// ─── LOOKUP LIVE CON FALLBACK GERARCHICO ──────────────────────────────────────

export const MIN_TRUSTED_SAMPLE_SIZE = 30;
export const MIN_CONFIDENCE_LOWER = 0.52; // Solo se lower bound > 52%

export function lookupCalibratedProbability(
  table: CalibrationTable,
  rsi: number,
  momentum: number,
  priceVsSMA50: number,
  vix?: number // opzionale, per stratificazione futura
): {
  winProbability: number;
  sampleSize: number;
  trusted: boolean;
  setupKey: string;
  confidenceLower: number;
  confidenceUpper: number;
  classRate?: number;
} {
  const key = setupKey(bucketRSI(rsi), bucketMomentum(momentum), bucketTrend(priceVsSMA50));
  const entry = table[key];

  if (!entry) {
    return {
      winProbability: PRIOR_WIN_RATE,
      sampleSize: 0,
      trusted: false,
      setupKey: key,
      confidenceLower: 0,
      confidenceUpper: 1,
    };
  }

  // Trusted solo se abbastanza dati E il lower bound del 90% CI supera 52%
  const isTrusted = entry.sampleSize >= MIN_TRUSTED_SAMPLE_SIZE && entry.confidenceLower >= MIN_CONFIDENCE_LOWER;

  return {
    winProbability: entry.shrunkWinRate,
    sampleSize: entry.sampleSize,
    trusted: isTrusted,
    setupKey: key,
    confidenceLower: entry.confidenceLower,
    confidenceUpper: entry.confidenceUpper,
    classRate: entry.assetClass ? undefined : undefined, // popolato dal chiamante se serve
  };
}

// ─── BAYESIAN ONLINE LEARNING ────────────────────────────────────────────────
// Ogni trade reale aggiorna la stima. I dati reali battono qualsiasi storico.

const ONLINE_PRIOR_WINS = 10;
const ONLINE_PRIOR_TOTAL = 20;

export interface OnlineCalibrationEntry {
  wins: number;
  total: number;
  avgWin: number;
  avgLoss: number;
  count: number;
}

export function createOnlinePrior(): OnlineCalibrationEntry {
  return {
    wins: ONLINE_PRIOR_WINS,
    total: ONLINE_PRIOR_TOTAL,
    avgWin: 0.03,
    avgLoss: -0.02,
    count: 0,
  };
}

export function updateOnlineEntry(
  entry: OnlineCalibrationEntry,
  outcome: 'win' | 'loss',
  returnPct: number
): OnlineCalibrationEntry {
  const updated = { ...entry };
  updated.count += 1;
  updated.total += 1;
  
  if (outcome === 'win') {
    updated.wins += 1;
    updated.avgWin = (updated.avgWin * (updated.wins - 1) + returnPct) / updated.wins;
  } else {
    updated.avgLoss = (updated.avgLoss * (updated.total - updated.wins - 1) + returnPct) / (updated.total - updated.wins);
  }
  
  return updated;
}

export function getOnlineProbability(entry: OnlineCalibrationEntry): {
  winProb: number;
  avgWin: number;
  avgLoss: number;
  sampleSize: number;
  confidenceLower: number;
  confidenceUpper: number;
} {
  const winProb = entry.wins / entry.total;
  const [lo, hi] = clopperPearsonInterval(entry.wins, entry.total, 0.90);
  return {
    winProb,
    avgWin: entry.avgWin,
    avgLoss: entry.avgLoss,
    sampleSize: entry.count,
    confidenceLower: lo,
    confidenceUpper: hi,
  };
}

// ─── HELPER PER KV (da usare nelle API) ──────────────────────────────────────

// Queste sono "pure", la persistenza su KV è nel chiamante (tbd-storage.ts)

export function serializeOnlineEntry(entry: OnlineCalibrationEntry): string {
  return JSON.stringify(entry);
}

export function deserializeOnlineEntry(raw: string): OnlineCalibrationEntry {
  return JSON.parse(raw);
}
