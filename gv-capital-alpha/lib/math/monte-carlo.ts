import { jStat } from 'jstat';

export interface MonteCarloResult {
  p10: number;
  p50: number;
  p90: number;
  successRate: number;
  iterations: number;
}

/**
 * Motore Monte Carlo (Geometric Brownian Motion)
 * Vettorizzato usando Float64Array per massime prestazioni.
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
  const dt = 1; // 1 anno per step
  const steps = Math.max(1, Math.floor(years));
  
  // Utilizzo Float64Array per allocazione contigua in memoria
  const finalValues = new Float64Array(iterations);

  let successCount = 0;
  const drift = (mu - (sigma * sigma) / 2) * dt;
  const vol = sigma * Math.sqrt(dt);

  for (let i = 0; i < iterations; i++) {
    let currentV = pv;
    
    for (let t = 0; t < steps; t++) {
      // Box-Muller transform per random normale standard (Z)
      let u1 = 0, u2 = 0;
      while (u1 === 0) u1 = Math.random();
      while (u2 === 0) u2 = Math.random();
      const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      
      // GBM step
      currentV = currentV * Math.exp(drift + vol * z);
      currentV += pmt; // Aggiunta cashflow
    }
    
    finalValues[i] = currentV;
    if (targetCap && currentV >= targetCap) {
      successCount++;
    }
  }

  // Sort array per calcolo percentili
  finalValues.sort();

  const getPercentile = (p: number) => {
    const idx = Math.floor((p / 100) * (iterations - 1));
    return finalValues[idx];
  };

  return {
    p10: getPercentile(10),
    p50: getPercentile(50),
    p90: getPercentile(90),
    successRate: targetCap ? (successCount / iterations) * 100 : 0,
    iterations
  };
}
