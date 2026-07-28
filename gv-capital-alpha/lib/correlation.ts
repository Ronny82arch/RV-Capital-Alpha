/**
 * lib/correlation.ts — Matrice di correlazione e filtro concentrazione
 *
 * Impedisce di aprire posizioni troppo correlate tra loro.
 * Usa log-return Pearson correlation (standard in quant finance).
 * Fix STRICT: NaN = blocca (dati insufficienti = rischio non calcolabile).
 */

import { MarketData } from '@/types';

// ─── CORRELAZIONE PEARSON SU LOG-RETURN ──────────────────────────────────────

export function pairwiseCorrelation(
  a: { date: string; close: number }[],
  b: { date: string; close: number }[],
  minPoints = 30
): number | null {
  const mapB = new Map(b.map(h => [h.date, h.close]));
  const pairs: [number, number][] = [];

  for (let i = 1; i < a.length; i++) {
    const prevA = a[i - 1].close, curA = a[i].close;
    const prevB = mapB.get(a[i - 1].date), curB = mapB.get(a[i].date);
    if (!prevB || !curB || prevA <= 0 || prevB <= 0) continue;
    pairs.push([Math.log(curA / prevA), Math.log(curB / prevB)]);
  }

  if (pairs.length < minPoints) return null;

  const meanA = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
  const meanB = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;

  let cov = 0, varA = 0, varB = 0;
  for (const [ra, rb] of pairs) {
    cov  += (ra - meanA) * (rb - meanB);
    varA += (ra - meanA) ** 2;
    varB += (rb - meanB) ** 2;
  }
  if (varA === 0 || varB === 0) return null;
  return cov / Math.sqrt(varA * varB);
}

export type CorrelationMatrix = Record<string, Record<string, number>>;

export function buildCorrelationMatrix(marketData: MarketData[], minPoints = 30): CorrelationMatrix {
  const matrix: CorrelationMatrix = {};
  for (const a of marketData) {
    matrix[a.symbol] = {};
    for (const b of marketData) {
      if (a.symbol === b.symbol) { matrix[a.symbol][b.symbol] = 1; continue; }
      const rho = pairwiseCorrelation(a.history, b.history, minPoints);
      matrix[a.symbol][b.symbol] = rho ?? NaN; // sconosciuto ≠ zero
    }
  }
  return matrix;
}

// ─── FILTRO CONCENTRAZIONE (v1 — backward compat) ────────────────────────────

export interface CorrelationCheck {
  blocked: boolean;
  conflictWith?: string;
  correlation?: number;
}

/**
 * Versione legacy usata da lib/ai.ts (openSymbols string[], threshold number).
 * NaN in STRICT → warn ma non blocca (cautela ma non stop).
 */
export function checkCorrelationAgainstOpenPositions(
  candidateSymbol: string,
  openSymbols: string[],
  matrix: CorrelationMatrix,
  threshold = 0.70
): CorrelationCheck {
  for (const open of openSymbols) {
    const rho = matrix[candidateSymbol]?.[open];
    if (rho === undefined || Number.isNaN(rho)) {
      console.warn(`[Correlation] Dati insufficienti per ${candidateSymbol} vs ${open} — procedo con cautela`);
      continue;
    }
    if (Math.abs(rho) > threshold) return { blocked: true, conflictWith: open, correlation: rho };
  }
  return { blocked: false };
}

// ─── FILTRO CONCENTRAZIONE (v2 — con STRICT NaN block) ───────────────────────

export interface CorrelationCheckResult {
  allowed: boolean;
  reason: string;
  highestRho: number;
}

/**
 * Versione v2 con STRICT mode: NaN = blocca (dati insufficienti = rischio ignoto).
 * Usata dalla satellite-scan route e dai nuovi consumer.
 */
export function checkCorrelationStrict(
  newSymbol: string,
  openPositions: Array<{ symbol: string }>,
  matrix: CorrelationMatrix,
  mode: 'STRICT' | 'NORMAL' = 'STRICT'
): CorrelationCheckResult {
  const threshold = mode === 'STRICT' ? 0.70 : 0.85;
  let highestRho = 0;

  for (const pos of openPositions) {
    const rho = matrix[newSymbol]?.[pos.symbol] ?? matrix[pos.symbol]?.[newSymbol];

    if (Number.isNaN(rho) || rho === undefined) {
      if (mode === 'STRICT') {
        return {
          allowed: false,
          reason: `Correlazione con ${pos.symbol} è NaN (dati insufficienti). In STRICT mode il trade è bloccato.`,
          highestRho: NaN,
        };
      }
      continue;
    }

    const absRho = Math.abs(rho);
    if (absRho > highestRho) highestRho = absRho;

    if (absRho > threshold) {
      return {
        allowed: false,
        reason: `Correlazione |ρ| = ${absRho.toFixed(2)} con ${pos.symbol} supera soglia ${threshold}`,
        highestRho: absRho,
      };
    }
  }

  return {
    allowed: true,
    reason: highestRho > 0
      ? `Correlazione max |ρ| = ${highestRho.toFixed(2)} < ${threshold}`
      : 'Nessuna posizione aperta o correlazione disponibile',
    highestRho,
  };
}
