/**
 * lib/ai.ts — Signal generation engine v2
 * 
 * Modifiche:
 * 1. lookupCalibratedProbability() → richiede confidenceLower >= 52%
 * 2. getDrawdownRiskMultiplier() → rimosso dal sizing (gestito da Antigravity)
 * 3. calculateKelly() → NO targetAnnualReturn, NO momentumScore
 * 4. Modello Claude fisso: claude-3-5-sonnet-20241022
 * 5. Filtro candidati: usa confidenceLower, non solo winProbability
 */

import { Signal, MarketData, PortfolioState } from '@/types';
import {
  calculateRSI, calculateSMA, calculateEMA, calculateMomentum, calculateVolatility, calculateATR,
  estimateFallbackWinProbability, calculateKelly, calculatePositionSize,
} from './kelly';
import { lookupCalibratedProbability, CalibrationTable } from './backtest';
import type { CalibrationData } from './storage';
import { checkCorrelationAgainstOpenPositions, CorrelationMatrix } from './correlation';
import { generateId } from './storage';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

// ─── ANALISI TECNICA ──────────────────────────────────────────────────────────

export interface AnalyzedAsset {
  market: MarketData;
  rsi: number;
  sma20: number;
  sma50: number;
  ema10: number;
  ema50: number;
  momentum: number;
  volatility: number;
  winProbability: number;
  winProbabilityTrusted: boolean;
  winProbabilitySampleSize: number;
  confidenceLower: number;        // NUOVO: lower bound 90% CI
  confidenceUpper: number;        // NUOVO: upper bound 90% CI
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  technicalScore: number;
  rewardRiskRatio: number;
  stopLoss: number;
  takeProfit: number;
}

export function analyzeAsset(market: MarketData, calibration: CalibrationData | null): AnalyzedAsset | null {
  const closes = market.history.map(h => h.close).filter(p => p > 0);
  if (closes.length < 20) return null;

  const price = market.price;
  const rsi = calculateRSI(closes);
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const ema10 = calculateEMA(closes, 10);
  const ema50ema = calculateEMA(closes, 50);
  const momentum = calculateMomentum(closes, 20);
  const volatility = calculateVolatility(closes, 20);

  const priceVsSMA20 = price - sma20;
  const priceVsSMA50 = price - sma50;

  let winProbability: number, winProbabilityTrusted: boolean, winProbabilitySampleSize: number;
  let confidenceLower: number = 0, confidenceUpper: number = 1;
  let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  let technicalScore: number;

  if (calibration) {
    const c = lookupCalibratedProbability(calibration.table, rsi, momentum, priceVsSMA50);
    winProbability = c.winProbability;
    winProbabilityTrusted = c.trusted;
    winProbabilitySampleSize = c.sampleSize;
    confidenceLower = c.confidenceLower;
    confidenceUpper = c.confidenceUpper;
    const fb = estimateFallbackWinProbability(rsi, momentum, priceVsSMA20, priceVsSMA50);
    trend = fb.trend;
    technicalScore = fb.score;
  } else {
    const fb = estimateFallbackWinProbability(rsi, momentum, priceVsSMA20, priceVsSMA50);
    winProbability = fb.winProbability;
    winProbabilityTrusted = false;
    winProbabilitySampleSize = 0;
    trend = fb.trend;
    technicalScore = fb.score;
  }

  // SL/TP ATR-based (identici a produzione)
  const atr = calculateATR(market.history, 14);
  const atrPct = atr / price;
  const slPct = atrPct > 0 ? atrPct * 2.0 : 0.05;
  const tpPct = slPct * 2.0;
  
  const stopLoss = parseFloat((price * (1 - slPct)).toFixed(2));
  const takeProfit = parseFloat((price * (1 + tpPct)).toFixed(2));

  return {
    market, rsi, sma20, sma50, ema10, ema50: ema50ema,
    momentum, volatility, winProbability, winProbabilityTrusted,
    winProbabilitySampleSize, confidenceLower, confidenceUpper,
    trend, technicalScore,
    rewardRiskRatio: tpPct / slPct, stopLoss, takeProfit,
  };
}

// ─── SELEZIONE CANDIDATI — FILTRO PER CONFIDENCE ─────────────────────────────

export interface CandidatesBatchResult {
  candidates: AnalyzedAsset[];
  skippedForCorrelation: { symbol: string; conflictWith: string; correlation: number }[];
  skippedUntrusted: string[];
  skippedLowConfidence: string[];  // NUOVO
}

export function findPromisingCandidatesBatch(
  analyses: AnalyzedAsset[],
  portfolio: PortfolioState,
  correlationMatrix: CorrelationMatrix,
  maxPositions = 30,
  correlationThreshold = 0.70
): CandidatesBatchResult {
  const openPositions = portfolio.positions.filter(p => p.status === 'OPEN');
  const openSymbols = openPositions.map(p => p.symbol);
  const openSet = new Set(openSymbols);

  if (openSet.size >= maxPositions) return { candidates: [], skippedForCorrelation: [], skippedUntrusted: [], skippedLowConfidence: [] };

  const available = analyses.filter(a => !openSet.has(a.market.symbol));
  const skippedUntrusted: string[] = [];
  const skippedLowConfidence: string[] = [];

  const aiMode = portfolio.aiMode || 'STRICT';
  
  // STRICT: richiede trusted + confidenceLower >= 55%
  // DYNAMIC: accetta confidenceLower >= 50% (ma preferisce trusted)
  const minConfidence = aiMode === 'STRICT' ? 0.55 : 0.50;
  const minWinProb = aiMode === 'STRICT' ? 0.55 : 0.52;

  const bullish = available.filter(a => {
    if (a.trend !== 'BULLISH') return false;
    
    // Filtro confidence: il lower bound dell'intervallo deve superare la soglia
    if (a.confidenceLower < minConfidence) {
      skippedLowConfidence.push(`${a.market.symbol} (conf: ${(a.confidenceLower * 100).toFixed(1)}%)`);
      return false;
    }
    
    // Filtro trusted: in STRICT serve anche il flag trusted
    if (aiMode === 'STRICT' && !a.winProbabilityTrusted) {
      skippedUntrusted.push(a.market.symbol);
      return false;
    }
    
    if (a.winProbability <= minWinProb) {
      skippedUntrusted.push(a.market.symbol);
      return false;
    }
    
    return true;
  });

  bullish.sort((a, b) => b.winProbability * b.rewardRiskRatio - a.winProbability * a.rewardRiskRatio);

  const candidates: AnalyzedAsset[] = [];
  const skippedForCorrelation: { symbol: string; conflictWith: string; correlation: number }[] = [];

  for (const c of bullish) {
    const check = checkCorrelationAgainstOpenPositions(
      c.market.symbol, 
      [...openSymbols, ...candidates.map(x => x.market.symbol)], 
      correlationMatrix, 
      correlationThreshold
    );
    if (!check.blocked) {
      candidates.push(c);
      if (openSet.size + candidates.length >= maxPositions) break;
    } else {
      skippedForCorrelation.push({ symbol: c.market.symbol, conflictWith: check.conflictWith!, correlation: check.correlation! });
    }
  }

  return { candidates, skippedForCorrelation, skippedUntrusted, skippedLowConfidence };
}

// ─── GENERAZIONE SEGNALI CON AI — SIZING SENZA TARGET ────────────────────────

export async function evaluateCandidatesWithAIBatch(
  candidates: AnalyzedAsset[],
  portfolio: PortfolioState
): Promise<Signal[]> {
  if (candidates.length === 0) return [];
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error('ANTHROPIC_API_KEY non settato'); return []; }

  // NO drawdown multiplier nel sizing: gestito da Antigravity a livello bucket
  const globalTarget = portfolio.targets?.['Tutti'] !== undefined
    ? portfolio.targets['Tutti'] / 100
    : portfolio.targetAnnualReturn;

  const portfoliosList = portfolio.customPortfolios && portfolio.customPortfolios.length > 0
    ? portfolio.customPortfolios
    : ['Core', 'Satellite', 'PAC'];

  const targetsInfo = portfoliosList.map(pName => {
    const pTarget = portfolio.targets?.[pName] !== undefined
      ? portfolio.targets[pName]
      : (pName.toLowerCase().includes('core') ? 8 : pName.toLowerCase().includes('sat') ? 25 : 10);
    return `- ${pName}: target annuo +${pTarget}%`;
  }).join('\n');

  const candidatesPayload = candidates.map(c => ({
    symbol: c.market.symbol,
    name: c.market.name,
    price: c.market.price,
    change24h: c.market.changePercent,
    technicals: { rsi: c.rsi, momentum: c.momentum, ema10: c.ema10, ema50: c.ema50, trend: c.trend, volatility: c.volatility },
    quant: {
      winProbability: c.winProbability,
      confidenceInterval: `${(c.confidenceLower * 100).toFixed(0)}%-${(c.confidenceUpper * 100).toFixed(0)}%`,
      sampleSize: c.winProbabilitySampleSize,
      stopLoss: c.stopLoss,
      takeProfit: c.takeProfit,
      rewardRiskRatio: c.rewardRiskRatio
    }
  }));

  const systemPrompt = `Sei l'Executive Committee di RV Capital Alpha.
Portafogli disponibili con rispettivi target annui (descrittivi, non input operativi):
${targetsInfo}

Capitale Disponibile: €${portfolio.capitalAvailable.toFixed(0)}.
Posizioni Aperte: ${portfolio.positions.filter(p => p.status === 'OPEN').length}.

Regole di Risposta:
1. Valuta l'intero array di candidati pre-filtrati dal Technical Quant Agent.
2. Per ciascun trade approvato, specifica il portafoglio di destinazione.
3. Il sizing monetario NON è tuo compito: viene calcolato dal motore Kelly puro.
4. Se un candidato ha confidence interval basso, rifiutalo anche se la mediana è alta.

Formato RISPOSTA (SOLO JSON array valido):
[
  {
    "symbol": "TICKER",
    "portfolio": "NomePortafoglio",
    "reasoning": "Breve spiegazione (max 50 parole)",
    "strategy": "Nome strategia",
    "urgency": "LOW|MEDIUM|HIGH",
    "confidence": 0-100
  }
]`;

  let attempt = 0;
  let success = false;
  let text = '[]';
  
  while (attempt < 3 && !success) {
    try {
      const res = await fetch(ANTHROPIC_API, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'x-api-key': apiKey, 
          'anthropic-version': '2023-06-01' 
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,  // ✅ FIX: modello valido
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: 'user', content: JSON.stringify(candidatesPayload, null, 2) }],
        }),
      });

      if (res.status === 429) {
        attempt++;
        const waitTime = Math.pow(2, attempt) * 1000;
        console.warn(`[AI] Rate limit 429. Retry in ${waitTime}ms...`);
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }
      
      if (!res.ok) {
        console.error(`[AI] API Error ${res.status}: ${await res.text()}`);
        return [];
      }

      const data = await res.json();
      text = data.content?.[0]?.text || '[]';
      success = true;
    } catch (err) {
      console.error('[AI] Fetch error:', err);
      attempt++;
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (!success) return [];

  let parsed: Array<{ symbol: string; portfolio: string; reasoning: string; strategy: string; urgency: string; confidence: number }> = [];
  try {
    parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (!Array.isArray(parsed)) parsed = [];
  } catch {
    console.error('[AI] Failed to parse JSON response:', text);
    return [];
  }

  const signals: Signal[] = [];
  for (const approved of parsed) {
    const c = candidates.find(x => x.market.symbol === approved.symbol);
    if (!c) continue;

    const assignedPortfolio = portfoliosList.find(p => p.toLowerCase() === approved.portfolio?.toLowerCase()) || 'Da Assegnare';
    
    // ✅ FIX: Kelly puro, niente target, niente drawdown multiplier
    const kelly = calculateKelly(c.winProbability, c.rewardRiskRatio, c.volatility, 0.03);
    
    const { capitalToAllocate, quantity } = calculatePositionSize(
      portfolio.capitalAvailable, 
      kelly.recommendedFraction, 
      c.market.price, 
      c.stopLoss,
      c.market.type === 'CRYPTO'  // ✅ FIX: frazioni per crypto
    );

    if (capitalToAllocate < 100 || quantity < (c.market.type === 'CRYPTO' ? 0.001 : 1)) {
      console.log(`[AI] Segnale ${c.market.symbol} scartato: sizing insufficiente`);
      continue;
    }

    const slPct = ((c.market.price - c.stopLoss) / c.market.price) * 100;
    const tpPct = ((c.takeProfit - c.market.price) / c.market.price) * 100;

    signals.push({
      id: generateId(),
      symbol: c.market.symbol,
      name: c.market.name,
      type: c.market.type,
      action: 'BUY',
      suggestedPrice: c.market.price,
      quantity,
      capitalToAllocate,
      stopLoss: c.stopLoss,
      takeProfit: c.takeProfit,
      stopLossPercent: slPct,
      takeProfitPercent: tpPct,
      kellyFraction: kelly.recommendedFraction,
      winProbability: c.winProbability,
      winProbabilitySampleSize: c.winProbabilitySampleSize,
      winProbabilityTrusted: c.winProbabilityTrusted,
      expectedReturn: c.winProbability * tpPct - (1 - c.winProbability) * slPct,
      reasoning: approved.reasoning || 'Approved by Executive Committee',
      strategy: approved.strategy || 'Multi-Agent Selection',
      urgency: (approved.urgency as Signal['urgency']) || 'MEDIUM',
      technicals: { rsi: c.rsi, momentum: c.momentum, sma20: c.sma20, sma50: c.sma50, trend: c.trend } as any,
      createdAt: new Date().toISOString(),
      status: 'PENDING',
      portfolio: assignedPortfolio
    });
  }

  return signals;
}
