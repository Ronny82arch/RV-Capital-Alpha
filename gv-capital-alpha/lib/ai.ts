import { Signal, MarketData, PortfolioState, AssetType } from '@/types';
import {
  calculateRSI,
  calculateSMA,
  calculateMomentum,
  calculateVolatility,
  estimateWinProbability,
  calculateKelly,
  calculatePositionSize,
  getAggression,
} from './kelly';
import { generateId } from './storage';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

// ─── TECHNICAL ANALYSIS ───────────────────────────────────────────────────────
export interface AnalyzedAsset {
  market: MarketData;
  rsi: number;
  sma20: number;
  sma50: number;
  momentum: number;
  volatility: number;
  winProbability: number;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  technicalScore: number;
  rewardRiskRatio: number;
  stopLoss: number;
  takeProfit: number;
}

export function analyzeAsset(market: MarketData): AnalyzedAsset | null {
  const closes = market.history.map(h => h.close).filter(p => p > 0);
  if (closes.length < 20) return null;

  const price = market.price;
  const rsi = calculateRSI(closes);
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const momentum = calculateMomentum(closes, 20);
  const volatility = calculateVolatility(closes, 20);

  const priceVsSMA20 = price - sma20;
  const priceVsSMA50 = price - sma50;

  const { winProbability, trend, score } = estimateWinProbability(
    rsi, momentum, priceVsSMA20, priceVsSMA50, volatility
  );

  // Chandelier Exit based on Volatility (Standard Deviation Proxy for ATR)
  // Stop Loss at 2.5 standard deviations (captures ~98% of normal variance)
  const slPct = Math.max(0.02, Math.min(0.15, volatility * 2.5)); 
  const tpPct = slPct * 2.0; // reward:risk = 2.0:1

  const stopLoss = parseFloat((price * (1 - slPct)).toFixed(2));
  const takeProfit = parseFloat((price * (1 + tpPct)).toFixed(2));
  const rewardRiskRatio = tpPct / slPct;

  return {
    market,
    rsi,
    sma20,
    sma50,
    momentum,
    volatility,
    winProbability,
    trend,
    technicalScore: score,
    rewardRiskRatio,
    stopLoss,
    takeProfit,
  };
}

// ─── SIGNAL CANDIDATES ────────────────────────────────────────────────────────
export function findBestCandidate(
  analyses: AnalyzedAsset[],
  portfolio: PortfolioState,
  maxPositions = 5
): AnalyzedAsset | null {
  const openSymbols = new Set(
    portfolio.positions.filter(p => p.status === 'OPEN').map(p => p.symbol)
  );

  // Don't open more than maxPositions
  if (openSymbols.size >= maxPositions) return null;

  // Don't re-open existing positions
  const available = analyses.filter(a => !openSymbols.has(a.market.symbol));

  // Macro Regime Filter (Risk-On / Risk-Off)
  const bullishCount = analyses.filter(a => a.trend === 'BULLISH').length;
  const isRiskOn = (bullishCount / Math.max(1, analyses.length)) >= 0.5;

  // Filter: only bullish with dynamic thresholds based on macro regime
  const minProbability = isRiskOn ? 0.55 : 0.65; // Require 65% win probability in Risk-Off
  const minScore = isRiskOn ? 10 : 25;

  const candidates = available.filter(
    a => a.trend === 'BULLISH' && a.winProbability > minProbability && a.technicalScore > minScore
  );

  if (candidates.length === 0) return null;

  // Sort by composite score: probability × score
  candidates.sort((a, b) =>
    b.winProbability * b.technicalScore - a.winProbability * a.technicalScore
  );

  return candidates[0];
}

// ─── AI REASONING ─────────────────────────────────────────────────────────────
export async function generateSignalWithAI(
  candidate: AnalyzedAsset,
  portfolio: PortfolioState
): Promise<Signal | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set');
    return null;
  }

  const aggression = getAggression(
    portfolio.totalPnLPercent,
    portfolio.targetAnnualReturn * 100,
    portfolio.startDate
  );

  const { winProbability, rewardRiskRatio, volatility } = candidate;
  const kelly = calculateKelly(winProbability, rewardRiskRatio, volatility);

  // Adjust Kelly based on aggression
  let adjustedFraction = kelly.recommendedFraction;
  if (aggression === 'AGGRESSIVE') adjustedFraction = Math.min(0.25, adjustedFraction * 1.3);
  if (aggression === 'CONSERVATIVE') adjustedFraction = adjustedFraction * 0.7;

  const { capitalToAllocate, quantity } = calculatePositionSize(
    portfolio.capitalAvailable,
    adjustedFraction,
    candidate.market.price,
    candidate.stopLoss
  );

  if (capitalToAllocate < 100 || quantity < 1) return null;

  const systemPrompt = `Sei ALPHA, il motore decisionale di RV Capital Alpha.
Il tuo unico obiettivo: portare il portafoglio a +25% annuo (€${(portfolio.capitalBase * portfolio.targetAnnualReturn).toFixed(0)} su €${portfolio.capitalBase}).

Stato attuale:
- Capitale disponibile: €${portfolio.capitalAvailable.toFixed(0)}
- P&L attuale: ${portfolio.totalPnLPercent >= 0 ? '+' : ''}${portfolio.totalPnLPercent.toFixed(2)}%
- Posizioni aperte: ${portfolio.positions.filter(p => p.status === 'OPEN').length}
- Modalità: ${aggression}

Rispondi SOLO in JSON con questa struttura esatta (nessun testo fuori dal JSON):
{
  "reasoning": "spiegazione in italiano max 150 parole, chiara e diretta",
  "strategy": "nome breve della strategia (es: Momentum ETF, Oversold Bounce, Trend Following)",
  "urgency": "LOW|MEDIUM|HIGH",
  "confidence": "numero 0-100"
}`;

  const userPrompt = `Analizza questo segnale di acquisto e fornisci reasoning:

Asset: ${candidate.market.name} (${candidate.market.symbol}) — ${candidate.market.type}
Prezzo corrente: €${candidate.market.price.toFixed(2)}
Variazione 24h: ${candidate.market.changePercent >= 0 ? '+' : ''}${candidate.market.changePercent.toFixed(2)}%

Indicatori tecnici:
- RSI (14): ${candidate.rsi}
- Momentum 20gg: ${(candidate.momentum * 100).toFixed(2)}%
- Prezzo vs SMA20: ${candidate.market.price > candidate.sma20 ? '+' : ''}${(((candidate.market.price - candidate.sma20) / candidate.sma20) * 100).toFixed(2)}%
- Prezzo vs SMA50: ${candidate.market.price > candidate.sma50 ? '+' : ''}${(((candidate.market.price - candidate.sma50) / candidate.sma50) * 100).toFixed(2)}%
- Trend: ${candidate.trend}
- Volatilità: ${(candidate.volatility * 100).toFixed(1)}%

Decisione algoritmica:
- Win probability: ${(winProbability * 100).toFixed(1)}%
- Kelly fraction: ${(adjustedFraction * 100).toFixed(1)}%
- Capitale da allocare: €${capitalToAllocate.toFixed(0)} (${((capitalToAllocate / portfolio.capitalAvailable) * 100).toFixed(1)}% del disponibile)
- Quantità: ${quantity} ${candidate.market.type === 'CRYPTO' ? 'unità' : 'azioni/quote'}
- Stop Loss: €${candidate.stopLoss.toFixed(2)} (-${((1 - candidate.stopLoss / candidate.market.price) * 100).toFixed(1)}%)
- Take Profit: €${candidate.takeProfit.toFixed(2)} (+${((candidate.takeProfit / candidate.market.price - 1) * 100).toFixed(1)}%)
- Reward/Risk: ${candidate.rewardRiskRatio.toFixed(1)}:1`;

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
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
      expectedReturn: winProbability * tpPct - (1 - winProbability) * slPct,
      reasoning: parsed.reasoning,
      strategy: parsed.strategy,
      urgency: (parsed.urgency as Signal['urgency']) || 'MEDIUM',
      technicals: {
        rsi: candidate.rsi,
        momentum: candidate.momentum,
        sma20: candidate.sma20,
        sma50: candidate.sma50,
        trend: candidate.trend,
      },
      createdAt: new Date().toISOString(),
      status: 'PENDING',
      // Note: tags will be moved to the Position when the signal is executed, 
      // but for now we don't store tags on the Signal itself as per types.
    };

    return signal;
  } catch (err) {
    console.error('AI signal generation error:', err);
    return null;
  }
}
