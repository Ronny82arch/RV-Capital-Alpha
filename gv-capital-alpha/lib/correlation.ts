/**
 * lib/correlation.ts — Matrice di correlazione e filtro concentrazione
 *
 * Impedisce di aprire posizioni troppo correlate tra loro.
 * Problema originale: "5 posizioni aperte" non garantisce diversificazione
 * se sono tutte tech USA (QQQ + NVDA + MSFT + META = 1 scommessa, non 4).
 * Usa log-return pearson correlation (standard in quant finance).
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
      matrix[a.symbol][b.symbol] = pairwiseCorrelation(a.history, b.history, minPoints) ?? 0;
    }
  }
  return matrix;
}

// ─── FILTRO CONCENTRAZIONE ────────────────────────────────────────────────────
export interface CorrelationCheck {
  blocked: boolean;
  conflictWith?: string;
  correlation?: number;
}

export function checkCorrelationAgainstOpenPositions(
  candidateSymbol: string,
  openSymbols: string[],
  matrix: CorrelationMatrix,
  threshold = 0.70
): CorrelationCheck {
  for (const open of openSymbols) {
    const rho = matrix[candidateSymbol]?.[open];
    if (rho != null && Math.abs(rho) > threshold) {
      return { blocked: true, conflictWith: open, correlation: rho };
    }
  }
  return { blocked: false };
}
