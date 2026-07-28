/**
 * lib/ai.ts — Generazione segnali Satellite con Conformal Prediction + Online Learning
 * E pipeline multi-agente legacy (analyzeAsset, findPromisingCandidatesBatch, evaluateCandidatesWithAIBatch).
 */

import { PortfolioState, Signal, Position } from './types';
import { getAlphaWatchlist } from './market';
import { checkCorrelationStrict, checkCorrelationAgainstOpenPositions, CorrelationMatrix } from './correlation';
import { calculateKelly, calculateRSI, calculateSMA, calculateEMA, calculateMomentum, calculateVolatility, calculateATR, estimateFallbackWinProbability, calculatePositionSize } from './kelly';
import { lookupCalibratedProbability, MIN_CONFIDENCE_LOWER, MIN_TRUSTED_SAMPLE_SIZE, deserializeOnlineEntry, getOnlineProbability } from './backtest';
import { kvGet } from './tbd-storage';
import { CalibrationData, generateId } from './storage';
import { MarketData } from './types';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

interface AiInput {
  marketData: Array<{ symbol: string; price: number; rsi: number; momentum: number; sma50: number; sma20: number; volatility: number; returns: number[] }>;
  portfolio: PortfolioState;
  correlationMatrix: any;
  mode: 'STRICT' | 'NORMAL';
  calibrationTable?: any;
}

// ─── GENERATE SIGNALS (CONFORMAL PREDICTION + SATELLITE) ─────────────────────

export async function generateSignals(input: AiInput): Promise<Signal[]> {
  const { marketData, portfolio, correlationMatrix, mode, calibrationTable } = input;
  const signals: Signal[] = [];
  const openPositions = portfolio.positions?.filter(p => p.status === 'OPEN') || [];

  for (const md of marketData) {
    // 1. Correlazione (con checkCorrelationStrict per supportare il tipo Position[])
    const corrCheck = checkCorrelationStrict(md.symbol, openPositions, correlationMatrix, mode);
    if (!corrCheck.allowed) continue;

    // 2. Trend filter
    const trend = md.price > md.sma50 ? 'BULLISH' : 'BEARISH';
    const priceVsSMA50 = (md.price - md.sma50) / md.sma50;
    const priceVsSMA20 = (md.price - md.sma20) / md.sma20;

    // 3. Calibrazione
    let winProb = 0.5;
    let sampleSize = 0;
    let trusted = false;
    let setupKeyStr = '';

    if (calibrationTable) {
      const cal = lookupCalibratedProbability(
        calibrationTable,
        md.rsi,
        md.momentum,
        priceVsSMA50
      );
      winProb = cal.winProbability;
      sampleSize = cal.sampleSize;
      trusted = cal.trusted;
      setupKeyStr = cal.setupKey;

      // Online learning override
      const onlineRaw = await kvGet(`bayesian:${setupKeyStr}`);
      if (onlineRaw) {
        const online = deserializeOnlineEntry(onlineRaw);
        const live = getOnlineProbability(online);
        if (live.sampleSize >= 10 && live.confidenceLower > 0.55) {
          winProb = live.winProb;
          sampleSize = live.sampleSize;
          trusted = true;
        }
      }
    }

    // 4. Filtro qualità
    const minWinProb = mode === 'STRICT' ? 0.58 : 0.53;
    const minSample = mode === 'STRICT' ? MIN_TRUSTED_SAMPLE_SIZE : 15;
    const minRR = 2.0;

    if (winProb < minWinProb) continue;
    if (!trusted && mode === 'STRICT') continue;
    if (sampleSize < minSample) continue;

    // 5. SL/TP basati su ATR
    const atrPct = md.volatility;
    const slPct = Math.max(atrPct * 2.0, 0.03);
    const tpPct = slPct * minRR;

    const direction = trend === 'BULLISH' ? 'BUY' : 'SELL';
    const entryPrice = md.price;
    const stopLoss = direction === 'BUY' ? entryPrice * (1 - slPct) : entryPrice * (1 + slPct);
    const takeProfit = direction === 'BUY' ? entryPrice * (1 + tpPct) : entryPrice * (1 - tpPct);

    // 6. Kelly sizing (quarter-Kelly fisso)
    const kelly = calculateKelly(winProb, tpPct / slPct, md.volatility);
    const satelliteCapital = (portfolio.totalValue || 0) * ((portfolio.coreSatelliteTarget || 70) / 100) * 0.25;
    const capitalToAllocate = Math.min(
      satelliteCapital * kelly.recommendedFraction,
      satelliteCapital * 0.03 // max 3% per posizione
    );
    if (capitalToAllocate < 200) continue;

    // 7. Costruisci segnale
    const signal: Signal = {
      id: `sat-${md.symbol}-${Date.now()}`,
      symbol: md.symbol,
      name: md.symbol,
      type: 'STOCK',
      action: direction,
      suggestedPrice: entryPrice,
      quantity: Math.floor(capitalToAllocate / entryPrice),
      capitalToAllocate: Number(capitalToAllocate.toFixed(2)),
      stopLoss: Number(stopLoss.toFixed(4)),
      takeProfit: Number(takeProfit.toFixed(4)),
      stopLossPercent: Number((slPct * 100).toFixed(2)),
      takeProfitPercent: Number((tpPct * 100).toFixed(2)),
      kellyFraction: kelly.recommendedFraction,
      winProbability: winProb,
      winProbabilitySampleSize: sampleSize,
      winProbabilityTrusted: trusted,
      expectedReturn: kelly.expectedValue,
      reasoning: `Setup ${setupKeyStr} | Win rate ${(winProb * 100).toFixed(1)}% (n=${sampleSize}) | Trend ${trend}`,
      strategy: 'Satellite Alpha',
      urgency: winProb > 0.65 ? 'HIGH' : 'MEDIUM',
      technicals: {
        rsi: md.rsi,
        momentum: md.momentum,
        sma20: md.sma20,
        sma50: md.sma50,
        trend,
        correlationMax: corrCheck.highestRho,
      },
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      portfolio: 'Satellite',
    };

    signals.push(signal);
  }

  // Ordina per expected return
  signals.sort((a, b) => (b.expectedReturn || 0) - (a.expectedReturn || 0));
  return signals.slice(0, 5); // max 5 segnali per scan
}

// ─── PIPELINE MULTI-AGENTE LEGACY ────────────────────────────────────────────

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
  confidenceLower: number;
  confidenceUpper: number;
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

  // SL/TP ATR-based
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

export interface CandidatesBatchResult {
  candidates: AnalyzedAsset[];
  skippedForCorrelation: { symbol: string; conflictWith: string; correlation: number }[];
  skippedUntrusted: string[];
  skippedLowConfidence: string[];
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
  
  const minConfidence = aiMode === 'STRICT' ? 0.55 : 0.50;
  const minWinProb = aiMode === 'STRICT' ? 0.55 : 0.52;

  const bullish = available.filter(a => {
    if (a.trend !== 'BULLISH') return false;
    
    if (a.confidenceLower < minConfidence) {
      skippedLowConfidence.push(`${a.market.symbol} (conf: ${(a.confidenceLower * 100).toFixed(1)}%)`);
      return false;
    }
    
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

export async function evaluateCandidatesWithAIBatch(
  candidates: AnalyzedAsset[],
  portfolio: PortfolioState
): Promise<Signal[]> {
  if (candidates.length === 0) return [];
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error('ANTHROPIC_API_KEY non settato'); return []; }

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
          model: ANTHROPIC_MODEL,
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
    
    const kelly = calculateKelly(c.winProbability, c.rewardRiskRatio, c.volatility, 0.03);
    
    const { capitalToAllocate, quantity } = calculatePositionSize(
      portfolio.capitalAvailable, 
      kelly.recommendedFraction, 
      c.market.price, 
      c.stopLoss,
      c.market.type === 'CRYPTO'
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
      expectedReturn: kelly.expectedValue,
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
