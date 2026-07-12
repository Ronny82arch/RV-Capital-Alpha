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
export interface CandidateResult {
  candidate: AnalyzedAsset | null;
  skippedForCorrelation: { symbol: string; conflictWith: string; correlation: number }[];
  skippedUntrusted: string[];
}

export function findBestCandidate(
  analyses: AnalyzedAsset[],
  portfolio: PortfolioState,
  correlationMatrix: CorrelationMatrix,
  maxPositions = 5,
  correlationThreshold = 0.70
): CandidateResult {
  const openPositions = portfolio.positions.filter(p => p.status === 'OPEN');
  const openSymbols   = openPositions.map(p => p.symbol);
  const openSet       = new Set(openSymbols);

  if (openSet.size >= maxPositions) return { candidate: null, skippedForCorrelation: [], skippedUntrusted: [] };

  const available  = analyses.filter(a => !openSet.has(a.market.symbol));
  const skippedUntrusted: string[] = [];

  // Solo setup BULLISH con probabilità STORICAMENTE VALIDATA (≥30 osservazioni)
  // e win rate calibrato > 55% (edge reale sopra il baseline 50%)
  const bullish = available.filter(a => {
    if (a.trend !== 'BULLISH') return false;
    if (!a.winProbabilityTrusted || a.winProbability <= 0.55) {
      skippedUntrusted.push(a.market.symbol);
      return false;
    }
    return true;
  });

  // Ordina per expected value (EV = winProb × R/R)
  bullish.sort((a, b) => b.winProbability * b.rewardRiskRatio - a.winProbability * a.rewardRiskRatio);

  const skippedForCorrelation: { symbol: string; conflictWith: string; correlation: number }[] = [];

  for (const c of bullish) {
    const check = checkCorrelationAgainstOpenPositions(c.market.symbol, openSymbols, correlationMatrix, correlationThreshold);
    if (!check.blocked) return { candidate: c, skippedForCorrelation, skippedUntrusted };
    skippedForCorrelation.push({ symbol: c.market.symbol, conflictWith: check.conflictWith!, correlation: check.correlation! });
  }

  return { candidate: null, skippedForCorrelation, skippedUntrusted };
}

// ─── GENERAZIONE SEGNALE CON AI ───────────────────────────────────────────────
export async function generateSignalWithAI(
  candidate: AnalyzedAsset,
  portfolio: PortfolioState
): Promise<Signal | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error('ANTHROPIC_API_KEY not set'); return null; }

  // Drawdown-based risk: riduce il Kelly quando ci allontaniamo dal picco
  // Non amplifica MAI la size dopo le perdite (vecchio bug getAggression rimosso)
  const { multiplier: drawdownMultiplier, drawdownPercent } = getDrawdownRiskMultiplier(
    portfolio.performanceHistory, portfolio.totalValue
  );

  const { winProbability, rewardRiskRatio, volatility } = candidate;
  const kelly = calculateKelly(winProbability, rewardRiskRatio, volatility);
  const adjustedFraction = kelly.recommendedFraction * drawdownMultiplier;

  const { capitalToAllocate, quantity } = calculatePositionSize(
    portfolio.capitalAvailable, adjustedFraction, candidate.market.price, candidate.stopLoss
  );

  if (capitalToAllocate < 100 || quantity < 1) return null;

  const systemPrompt = `Sei ALPHA, il motore decisionale di RV Capital Alpha.
Obiettivo: portare il portafoglio a +25% annuo (€${(portfolio.capitalBase * portfolio.targetAnnualReturn).toFixed(0)} su €${portfolio.capitalBase}).

Stato attuale:
- Capitale disponibile: €${portfolio.capitalAvailable.toFixed(0)}
- P&L: ${portfolio.totalPnLPercent >= 0 ? '+' : ''}${portfolio.totalPnLPercent.toFixed(2)}%
- Posizioni aperte: ${portfolio.positions.filter(p => p.status === 'OPEN').length}
- Drawdown dal picco: ${drawdownPercent.toFixed(1)}% → moltiplicatore rischio ${drawdownMultiplier}x
- Win probability calibrata su ${candidate.winProbabilitySampleSize} trade storici reali

Rispondi SOLO in JSON (no markdown, no testo fuori):
{
  "reasoning": "spiegazione max 150 parole, cita la probabilità calibrata e il drawdown",
  "strategy": "nome breve (es: Momentum ETF, Oversold Bounce)",
  "urgency": "LOW|MEDIUM|HIGH",
  "confidence": 0-100
}`;

  const userPrompt = `Segnale BUY: ${candidate.market.name} (${candidate.market.symbol})
Prezzo: €${candidate.market.price.toFixed(2)} | 24h: ${candidate.market.changePercent >= 0 ? '+' : ''}${candidate.market.changePercent.toFixed(2)}%

Tecnica:
- RSI: ${candidate.rsi} | Momentum 20gg: ${(candidate.momentum * 100).toFixed(2)}%
- EMA10: ${candidate.ema10.toFixed(2)} | EMA50: ${candidate.ema50.toFixed(2)}
- Trend: ${candidate.trend} | Volatilità: ${(candidate.volatility * 100).toFixed(1)}%

Decisione algoritmica:
- Win prob calibrata: ${(winProbability * 100).toFixed(1)}% (n=${candidate.winProbabilitySampleSize} osservazioni)
- Kelly (post-drawdown): ${(adjustedFraction * 100).toFixed(1)}%
- Capitale: €${capitalToAllocate.toFixed(0)} | Qty: ${quantity}
- SL: €${candidate.stopLoss.toFixed(2)} (-${((1 - candidate.stopLoss / candidate.market.price)*100).toFixed(1)}%)
- TP: €${candidate.takeProfit.toFixed(2)} (+${((candidate.takeProfit / candidate.market.price - 1)*100).toFixed(1)}%)
- R/R: ${candidate.rewardRiskRatio.toFixed(1)}:1`;

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data.content?.[0]?.text || '{}';

    let parsed: { reasoning: string; strategy: string; urgency: string; confidence: number };
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      parsed = { reasoning: text.slice(0, 200), strategy: 'Technical Analysis', urgency: 'MEDIUM', confidence: 60 };
    }

    const slPct = ((candidate.market.price - candidate.stopLoss) / candidate.market.price) * 100;
    const tpPct = ((candidate.takeProfit - candidate.market.price) / candidate.market.price) * 100;

    const signal: Signal = {
      id: generateId(),
      symbol: candidate.market.symbol,
      name: candidate.market.name,
      type: candidate.market.type,
      action: 'BUY',
      suggestedPrice: candidate.market.price,
      quantity,
      capitalToAllocate,
      stopLoss: candidate.stopLoss,
      takeProfit: candidate.takeProfit,
      stopLossPercent: slPct,
      takeProfitPercent: tpPct,
      kellyFraction: adjustedFraction,
      winProbability,
      winProbabilitySampleSize: candidate.winProbabilitySampleSize,
      winProbabilityTrusted: candidate.winProbabilityTrusted,
      expectedReturn: winProbability * tpPct - (1 - winProbability) * slPct,
      reasoning: parsed.reasoning,
      strategy: parsed.strategy,
      urgency: (parsed.urgency as Signal['urgency']) || 'MEDIUM',
      technicals: { rsi: candidate.rsi, momentum: candidate.momentum, sma20: candidate.sma20, sma50: candidate.sma50, trend: candidate.trend },
      createdAt: new Date().toISOString(),
      status: 'PENDING',
    };

    return signal;
  } catch (err) {
    console.error('AI signal generation error:', err);
    return null;
  }
}
