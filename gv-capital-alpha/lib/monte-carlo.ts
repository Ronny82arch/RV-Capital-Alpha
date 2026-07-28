/**
 * lib/monte-carlo.ts — Simulazione GBM per proiezioni UI (p10/p50/p90)
 *
 * FIX: dt = 1/252 (giorni lavorativi), steps = years * 252.
 * Non più usato per sizing, solo per proiezioni probabilistiche dashboard.
 * jStat rimosso — usa Box-Muller nativo.
 */

// ─── TIPI ────────────────────────────────────────────────────────────────────

export interface MonteCarloResult {
  p10: number;          // 10° percentile (coda sinistra)
  p50: number;          // mediana
  p90: number;          // 90° percentile (coda destra)
  mean: number;         // media
  successRate: number;  // P(return > 0) oppure P(value >= targetCap), in %
  maxDrawdown: number;  // max drawdown medio simulato (percentuale, NaN se non calcolato)
}

// ─── COSTANTI ─────────────────────────────────────────────────────────────────

const TRADING_DAYS_PER_YEAR = 252;

// ─── MOTORE GBM PRINCIPALE ───────────────────────────────────────────────────

/**
 * Simula Geometric Brownian Motion con step giornalieri (dt = 1/252).
 *
 * @param pv          Present value (capitale iniziale, € )
 * @param pmt         Versamento periodico annuo (€ — distribuito pro-rata daily)
 * @param mu          Drift atteso annuo (es. 0.18 per 18%)
 * @param sigma       Volatilità annua (es. 0.25 per 25%)
 * @param years       Orizzonte in anni (es. 1, 3, 5)
 * @param targetCap   Soglia obiettivo (opzionale) — se presente, successRate = P(V≥cap)
 * @param iterations  Simulazioni MC (default 10 000)
 */
export function runMonteCarlo(
  pv: number,
  pmt: number,
  mu: number,
  sigma: number,
  years: number,
  targetCap?: number,
  iterations: number = 10000
): MonteCarloResult {
  if (pv <= 0) {
    return { p10: 0, p50: 0, p90: 0, mean: 0, successRate: 0, maxDrawdown: 0 };
  }

  const steps = Math.max(1, Math.floor(years * TRADING_DAYS_PER_YEAR));
  const dt    = 1 / TRADING_DAYS_PER_YEAR;

  // GBM: dS = S·(μ·dt + σ·√dt·Z)  →  S(t+1) = S(t)·exp(drift + vol·Z)
  const drift = (mu - (sigma * sigma) / 2) * dt;
  const vol   = sigma * Math.sqrt(dt);

  const finalValues: number[] = [];
  let positiveCount  = 0;
  let maxDrawdownSum = 0;

  for (let i = 0; i < iterations; i++) {
    let value = pv;
    let peak  = value;
    let maxDD = 0;

    for (let t = 0; t < steps; t++) {
      // Box-Muller: Z ~ N(0,1)
      const u1 = Math.random() || 1e-10; // evita log(0)
      const u2 = Math.random() || 1e-10;
      const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

      value = value * Math.exp(drift + vol * z);

      // Versamento periodico distribuito giornalmente
      if (pmt !== 0) value += pmt * dt;

      // Tracking drawdown intrapath
      if (value > peak) peak = value;
      const dd = peak > 0 ? (peak - value) / peak : 0;
      if (dd > maxDD) maxDD = dd;
    }

    finalValues.push(value);
    if (value > pv) positiveCount++;
    maxDrawdownSum += maxDD;
  }

  finalValues.sort((a, b) => a - b);

  const p10 = finalValues[Math.floor(iterations * 0.10)];
  const p50 = finalValues[Math.floor(iterations * 0.50)];
  const p90 = finalValues[Math.floor(iterations * 0.90)];
  const mean = finalValues.reduce((a, b) => a + b, 0) / iterations;

  const successRate = targetCap !== undefined
    ? (finalValues.filter(v => v >= targetCap).length / iterations) * 100
    : (positiveCount / iterations) * 100;

  return {
    p10, p50, p90, mean,
    successRate,
    maxDrawdown: (maxDrawdownSum / iterations) * 100,
  };
}

// ─── HELPER: PROIEZIONI PER BUCKET ───────────────────────────────────────────

export interface BucketMonteCarloInput {
  name: string;
  currentValue: number;
  mu: number;    // return atteso annuo
  sigma: number; // volatilità annua
}

/**
 * Esegue Monte Carlo per tutti i bucket e restituisce proiezioni aggregate.
 * Usato dal cron giornaliero (satellite-scan) per aggiornare bucketProjections
 * nel portfolio state — il componente ProjectionsDashboard le legge da lì.
 */
export function projectAllBuckets(
  buckets: BucketMonteCarloInput[],
  years: number = 1,
  iterations: number = 10000
): Record<string, MonteCarloResult> {
  const out: Record<string, MonteCarloResult> = {};
  for (const b of buckets) {
    out[b.name] = runMonteCarlo(b.currentValue, 0, b.mu, b.sigma, years, undefined, iterations);
  }
  return out;
}

// ─── HELPER: PROIEZIONE BREVE TBD (H1 — 21 giorni) ──────────────────────────

/**
 * Proiezione a breve termine per il bucket TBD (1 mese ≈ 21 giorni).
 * Accetta parametri già espressi in unità giornaliere.
 *
 * @param pv          Capitale TBD attivo
 * @param muDaily     Drift giornaliero (es. 0.0024 ≈ 60% annuo / 252)
 * @param sigmaDaily  Vol giornaliera (es. 0.025 ≈ 40% annuo / √252)
 * @param days        Giorni di simulazione (default 21)
 * @param iterations  Simulazioni (default 5000)
 */
export function runTbdShortProjection(
  pv: number,
  muDaily: number,
  sigmaDaily: number,
  days: number = 21,
  iterations: number = 5000
): MonteCarloResult {
  if (pv <= 0) {
    return { p10: 0, p50: 0, p90: 0, mean: 0, successRate: 0, maxDrawdown: NaN };
  }

  const drift = (muDaily - (sigmaDaily * sigmaDaily) / 2);
  const vol   = sigmaDaily;

  const finals: number[] = [];
  let positive = 0;

  for (let i = 0; i < iterations; i++) {
    let v = pv;
    for (let t = 0; t < days; t++) {
      const u1 = Math.random() || 1e-10;
      const u2 = Math.random() || 1e-10;
      const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      v = v * Math.exp(drift + vol * z);
    }
    finals.push(v);
    if (v > pv) positive++;
  }

  finals.sort((a, b) => a - b);

  return {
    p10: finals[Math.floor(iterations * 0.10)],
    p50: finals[Math.floor(iterations * 0.50)],
    p90: finals[Math.floor(iterations * 0.90)],
    mean: finals.reduce((a, b) => a + b, 0) / iterations,
    successRate: (positive / iterations) * 100,
    maxDrawdown: NaN, // non calcolato per proiezione breve
  };
}
