import { jStat } from 'jstat';

export interface MonteCarloResult {
  p10: number;
  p50: number;
  p90: number;
  successRate: number;
  iterations: number;
}

/**
 * Motore Monte Carlo (Geometric Brownian Motion) — simulazione giornaliera.
 *
 * Fix: dt = 1/252 (1 giorno lavorativo), steps = years * 252.
 * Con dt=1 e steps=years si perdeva la path-dependency e i PMT mensili
 * venivano aggiunti una sola volta per anno invece che ogni giorno.
 * La simulazione giornaliera è la standard di settore per proiezioni
 * di portafoglio (Black-Scholes, risk management, Basilea III).
 *
 * @param pv          Valore iniziale (€)
 * @param pmt         Cashflow periodico (€/giorno, es. contributo mensile / 21)
 * @param mu          Rendimento atteso annuo (es. 0.18 per 18%)
 * @param sigma       Volatilità annua (es. 0.25)
 * @param years       Orizzonte temporale in anni
 * @param targetCap   Soglia di successo (opzionale) — usata per successRate
 * @param iterations  Numero simulazioni MC (default 10 000)
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
  // ✅ FIX: dt giornaliero, steps proporzionali
  const dt = 1 / 252;                           // 1 giorno lavorativo
  const steps = Math.max(1, Math.round(years * 252)); // giorni totali

  // Parametri GBM pre-calcolati (costanti per tutte le simulazioni)
  const drift = (mu - (sigma * sigma) / 2) * dt;
  const vol   = sigma * Math.sqrt(dt);

  const finalValues = new Float64Array(iterations);
  let successCount = 0;

  for (let i = 0; i < iterations; i++) {
    let currentV = pv;

    for (let t = 0; t < steps; t++) {
      // Box-Muller: Z ~ N(0,1)
      let u1 = 0, u2 = 0;
      while (u1 === 0) u1 = Math.random();
      while (u2 === 0) u2 = Math.random();
      const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

      // GBM step giornaliero
      currentV = currentV * Math.exp(drift + vol * z);
      currentV += pmt; // cashflow giornaliero (può essere 0)
    }

    finalValues[i] = currentV;
    if (targetCap && currentV >= targetCap) successCount++;
  }

  // Ordinamento per percentili
  finalValues.sort();

  const getPercentile = (p: number): number => {
    const idx = Math.floor((p / 100) * (iterations - 1));
    return finalValues[idx];
  };

  return {
    p10: getPercentile(10),
    p50: getPercentile(50),
    p90: getPercentile(90),
    successRate: targetCap ? (successCount / iterations) * 100 : 0,
    iterations,
  };
}
