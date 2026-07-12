/**
 * lib/ai.ts — Signal generation engine
 *
 * Modifiche rispetto alla versione precedente:
 * 1. estimateWinProbability() (arbitraria) → lookupCalibratedProbability() (storica)
 * 2. getAggression() (loss-chasing) → getDrawdownRiskMultiplier() (protective)
 * 3. findBestCandidate(): richiede probabilità "trusted" + filtro correlazione
 * 4. EMA vera (via calculateEMA in kelly.ts) al posto della SMA mislabeled
 */

import { Signal, MarketData, PortfolioState } from '@/types';
import {
  calculateRSI, calculateSMA, calculateEMA, calculateMomentum, calculateVolatility,
  estimateFallbackWinProbability, calculateKelly, calculatePositionSize,
  getDrawdownRiskMultiplier,
} from './kelly';
import { lookupCalibratedProbability, CalibrationTable } from './backtest';
import { checkCorrelationAgainstOpenPositions, CorrelationMatrix } from './correlation';
import { generateId } from './storage';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

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
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  technicalScore: number;
  rewardRiskRatio: number;
  stopLoss: number;
  takeProfit: number;
}

export function analyzeAsset(market: MarketData, calibration: CalibrationTable | null): AnalyzedAsset | null {
  const closes = market.history.map(h => h.close).filter(p => p > 0);
  if (closes.length < 20) return null;

  const price = market.price;
  const rsi      = calculateRSI(closes);
  const sma20    = calculateSMA(closes, 20);
  const sma50    = calculateSMA(closes, 50);
  const ema10    = calculateEMA(closes, 10);
  const ema50ema = calculateEMA(closes, 50);
  const momentum  = calculateMomentum(closes, 20);
  const volatility = calculateVolatility(closes, 20);

  const priceVsSMA20 = price - sma20;
  const priceVsSMA50 = price - sma50;

  // Probabilità: usa tabella calibrata se disponibile, fallback neutro altrimenti
  let winProbability: number, winProbabilityTrusted: boolean, winProbabilitySampleSize: number;
  let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  let technicalScore: number;

  if (calibration) {
    const c = lookupCalibratedProbability(calibration, rsi, momentum, priceVsSMA20, priceVsSMA50);
    winProbability = c.winProbability;
    winProbabilityTrusted = c.trusted;
    winProbabilitySampleSize = c.sampleSize;
    const fb = estimateFallbackWinProbability(rsi, momentum, priceVsSMA20, priceVsSMA50);
    trend = fb.trend; technicalScore = fb.score;
  } else {
    const fb = estimateFallbackWinProbability(rsi, momentum, priceVsSMA20, priceVsSMA50);
    winProbability = fb.winProbability;
    winProbabilityTrusted = false;
    winProbabilitySampleSize = 0;
    trend = fb.trend; technicalScore = fb.score;
  }

  // SL/TP — IDENTICO alla regola in lib/backtest.ts::calibrateSetupsForSymbol()
  // (se cambi qui, cambia anche lì — altrimenti la probabilità calibrata
  // si riferisce a un trade diverso da quello eseguito live)
  const slPct = Math.max(0.04, Math.min(0.08, volatility * 2));
  const tpPct = slPct * 2.0;
  const stopLoss  = parseFloat((price * (1 - slPct)).toFixed(2));
  const takeProfit = parseFloat((price * (1 + tpPct)).toFixed(2));

  return {
    market, rsi, sma20, sma50, ema10, ema50: ema50ema,
    momentum, volatility, winProbability, winProbabilityTrusted,
    winProbabilitySampleSize, trend, technicalScore,
    rewardRiskRatio: tpPct / slPct, stopLoss, takeProfit,
  };
}

// ─── SELEZIONE CANDIDATO ──────────────────────────────────────────────────────
export interface CandidatesBatchResult {
  candidates: AnalyzedAsset[];
  skippedForCorrelation: { symbol: string; conflictWith: string; correlation: number }[];
  skippedUntrusted: string[];
}

export function findPromisingCandidatesBatch(
  analyses: AnalyzedAsset[],
  portfolio: PortfolioState,
  correlationMatrix: CorrelationMatrix,
  maxPositions = 5,
  correlationThreshold = 0.70
): CandidatesBatchResult {
  const openPositions = portfolio.positions.filter(p => p.status === 'OPEN');
  const openSymbols   = openPositions.map(p => p.symbol);
  const openSet       = new Set(openSymbols);

  if (openSet.size >= maxPositions) return { candidates: [], skippedForCorrelation: [], skippedUntrusted: [] };

  const available  = analyses.filter(a => !openSet.has(a.market.symbol));
  const skippedUntrusted: string[] = [];

  const bullish = available.filter(a => {
    if (a.trend !== 'BULLISH') return false;
    if (!a.winProbabilityTrusted || a.winProbability <= 0.55) {
      skippedUntrusted.push(a.market.symbol);
      return false;
    }
    return true;
  });

  bullish.sort((a, b) => b.winProbability * b.rewardRiskRatio - a.winProbability * a.rewardRiskRatio);

  const candidates: AnalyzedAsset[] = [];
  const skippedForCorrelation: { symbol: string; conflictWith: string; correlation: number }[] = [];

  for (const c of bullish) {
    const check = checkCorrelationAgainstOpenPositions(c.market.symbol, [...openSymbols, ...candidates.map(x => x.market.symbol)], correlationMatrix, correlationThreshold);
    if (!check.blocked) {
      candidates.push(c);
      if (openSet.size + candidates.length >= maxPositions) break;
    } else {
      skippedForCorrelation.push({ symbol: c.market.symbol, conflictWith: check.conflictWith!, correlation: check.correlation! });
    }
  }

  return { candidates, skippedForCorrelation, skippedUntrusted };
}

// ─── GENERAZIONE SEGNALE CON AI ───────────────────────────────────────────────
export async function evaluateCandidatesWithAIBatch(
  candidates: AnalyzedAsset[],
  portfolio: PortfolioState
): Promise<Signal[]> {
  if (candidates.length === 0) return [];
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error('ANTHROPIC_API_KEY non settato'); return []; }

  const { multiplier: drawdownMultiplier, drawdownPercent } = getDrawdownRiskMultiplier(
    portfolio.performanceHistory, portfolio.totalValue
  );

  const candidatesPayload = candidates.map(c => {
    const kelly = calculateKelly(c.winProbability, c.rewardRiskRatio, c.volatility);
    const adjustedFraction = kelly.recommendedFraction * drawdownMultiplier;
    const { capitalToAllocate, quantity } = calculatePositionSize(
      portfolio.capitalAvailable, adjustedFraction, c.market.price, c.stopLoss
    );
    return {
      symbol: c.market.symbol,
      name: c.market.name,
      price: c.market.price,
      change24h: c.market.changePercent,
      technicals: { rsi: c.rsi, momentum: c.momentum, ema10: c.ema10, ema50: c.ema50, trend: c.trend, volatility: c.volatility },
      quant: {
        winProbability: c.winProbability,
        sampleSize: c.winProbabilitySampleSize,
        kellyFraction: adjustedFraction,
        capitalToAllocate,
        quantity,
        stopLoss: c.stopLoss,
        takeProfit: c.takeProfit,
        rewardRiskRatio: c.rewardRiskRatio
      }
    };
  }).filter(c => c.quant.capitalToAllocate >= 100 && c.quant.quantity >= 1);

  if (candidatesPayload.length === 0) return [];

  const systemPrompt = `Sei l'Executive Committee di RV Capital Alpha.
Obiettivo: +25% annuo.
Drawdown dal picco: ${drawdownPercent.toFixed(1)}% (Moltiplicatore Kelly: ${drawdownMultiplier}x).
Capitale Disponibile: €${portfolio.capitalAvailable.toFixed(0)}.
Posizioni Aperte: ${portfolio.positions.filter(p => p.status === 'OPEN').length}.

Riceverai un JSON array con i candidati pre-filtrati dal Technical Quant Agent. 
Devi valutare l'intero array e restituire un JSON array con i trade che decidi di approvare. Puoi approvarli tutti, alcuni o nessuno.

Formato RISPOSTA (SOLO JSON array valido, no markdown o testo extra fuori dall'array):
[
  {
    "symbol": "TICKER",
    "reasoning": "Breve spiegazione sul perché approvi (max 50 parole)",
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
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20240620',
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

  let parsed: Array<{ symbol: string; reasoning: string; strategy: string; urgency: string; confidence: number }> = [];
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
    const p = candidatesPayload.find(x => x.symbol === approved.symbol);
    if (!c || !p) continue;

    const slPct = ((c.market.price - c.stopLoss) / c.market.price) * 100;
    const tpPct = ((c.takeProfit - c.market.price) / c.market.price) * 100;

    signals.push({
      id: generateId(),
      symbol: c.market.symbol,
      name: c.market.name,
      type: c.market.type,
      action: 'BUY',
      suggestedPrice: c.market.price,
      quantity: p.quant.quantity,
      capitalToAllocate: p.quant.capitalToAllocate,
      stopLoss: c.stopLoss,
      takeProfit: c.takeProfit,
      stopLossPercent: slPct,
      takeProfitPercent: tpPct,
      kellyFraction: p.quant.kellyFraction,
      winProbability: c.winProbability,
      winProbabilitySampleSize: c.winProbabilitySampleSize,
      winProbabilityTrusted: c.winProbabilityTrusted,
      expectedReturn: c.winProbability * tpPct - (1 - c.winProbability) * slPct,
      reasoning: approved.reasoning || 'Approved by Executive Committee',
      strategy: approved.strategy || 'Multi-Agent Selection',
      urgency: (approved.urgency as Signal['urgency']) || 'MEDIUM',
      technicals: { rsi: c.rsi, momentum: c.momentum, sma20: c.sma20, sma50: c.sma50, trend: c.trend },
      createdAt: new Date().toISOString(),
      status: 'PENDING',
    });
  }

  return signals;
}
