/**
 * Calcola l'allocazione tramite il criterio Fractional Kelly.
 * @param p Probabilità di successo (win rate)
 * @param b Payoff ratio (average win / average loss)
 * @param gamma Frazione di Kelly (es. 0.5 per Half-Kelly)
 * @param f_max Esposizione massima (hard-cap, es. 0.05 per 5%)
 * @returns La percentuale di capitale da allocare
 */
export function calculateFractionalKelly(
  p: number,
  b: number,
  gamma: number = 0.5,
  f_max: number = 0.05
): number {
  if (b <= 0) return 0;
  
  // Formula di Kelly base
  const kelly = p - ((1 - p) / b);
  
  // Applica la frazione, il minimo 0 (niente short previsti qui) e il massimo f_max
  const f_star = Math.max(0, Math.min(gamma * kelly, f_max));
  
  return f_star;
}

/**
 * Applica una penalità di diversificazione basata sulla correlazione.
 * Se la correlazione tra due asset (A e B) supera 0.70, riduce l'esposizione.
 * @param f_star_A Allocazione originale per l'asset A
 * @param rho Correlazione di Pearson tra l'asset A e l'asset in portafoglio
 * @returns Allocazione aggiustata
 */
export function applyCorrelationPenalty(f_star_A: number, rho: number): number {
  if (rho > 0.70) {
    // Fattore di diversificazione: sqrt(1 - rho^2)
    const factor = Math.sqrt(Math.max(0, 1 - Math.pow(rho, 2)));
    return f_star_A * factor;
  }
  return f_star_A;
}
