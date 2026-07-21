export interface CPPIState {
  portfolioValue: number;
  floorValue: number;
  cushion: number;
  multiplier: number;
  maxRiskExposure: number;
  currentRiskExposure: number;
  requiresRebalance: boolean;
}

/**
 * Logica Constant Proportion Portfolio Insurance (CPPI)
 * @param portfolioValue Valore attuale totale del portafoglio (Liquidità + Asset Rischiosi)
 * @param investedCapital Capitale totale versato storicamente dall'utente
 * @param floorPercent Percentuale di capitale da proteggere (es. 0.8 per l'80%)
 * @param multiplier Moltiplicatore di esposizione (es. 3)
 * @param currentRiskExposure Valore attuale degli asset rischiosi nel portafoglio
 * @returns Stato CPPI per determinare se serve un ribilanciamento forzato
 */
export function calculateCPPI(
  portfolioValue: number,
  investedCapital: number,
  floorPercent: number = 0.8,
  multiplier: number = 3,
  currentRiskExposure: number
): CPPIState {
  // Il "Floor" è il valore al di sotto del quale il portafoglio non deve mai scendere
  const floorValue = investedCapital * floorPercent;
  
  // Il "Cushion" (cuscinetto) è la differenza tra il valore attuale e il floor
  const cushion = Math.max(0, portfolioValue - floorValue);
  
  // Esposizione Massima consentita su asset rischiosi
  const maxRiskExposure = multiplier * cushion;
  
  // Se l'esposizione attuale supera il limite massimo teorico, il sistema DEVE ribilanciare (vendere)
  const requiresRebalance = currentRiskExposure > maxRiskExposure;

  return {
    portfolioValue,
    floorValue,
    cushion,
    multiplier,
    maxRiskExposure,
    currentRiskExposure,
    requiresRebalance
  };
}
