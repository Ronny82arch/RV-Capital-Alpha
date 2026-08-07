/**
 * GET /api/cron/scan
 * Cron Vercel: ogni giorno alle 08:00 UTC (dopo calibrate alle 06:00).
 * Scansiona il watchlist, applica la probabilità calibrata + filtro correlazione
 * + drawdown risk multiplier, genera segnale su Telegram se c'è un'opportunità.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchAllMarketData } from '@/lib/market';
import { analyzeAsset, findPromisingCandidatesBatch, evaluateCandidatesWithAIBatch } from '@/lib/ai';
import {
  getPortfolio, addSignal, updatePositionPrices, recalcPortfolio,
  getCalibrationTable, getCalibrationUpdatedAt,
} from '@/lib/storage';
import { buildCorrelationMatrix } from '@/lib/correlation';
import { notifyNewSignal, notifyStopLossAlert, notifyTakeProfitAlert, notifyDailySummary, notifyCoreSatelliteDrift } from '@/lib/alerts';
import { AntigravityEngine, DEFAULT_ANTIGRAVITY_CONFIG, getTbdCooldownUntil } from '@/lib/antigravity-engine';
import { kvGet, getTodayLog, saveSignals, getTbdConfig } from '@/lib/tbd-storage';
import { TBDEngine } from '@/lib/tbd-engine';
import { sendPreAlertNotification } from '@/lib/tbd-notifications';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://gv-capital-alpha.vercel.app';

function isAuthorized(req: NextRequest): boolean {
  // Accept only cron secret in production; allow local dev when NODE_ENV === 'development'
  const auth = req.headers.get('authorization');
  const isCron = auth === `Bearer ${process.env.CRON_SECRET}`;
  const isDev = process.env.NODE_ENV === 'development';
  return !!(isCron || isDev);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return runScan();
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return runScan();
}

async function runWithConcurrency<T, R>(items: T[], fn: (t: T) => Promise<R>, concurrency = 5) {
  const results: (R | Error)[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (true) {
      const i = index++;
      if (i >= items.length) return;
      try {
        results[i] = await fn(items[i]);
      } catch (err) {
        results[i] = err as Error;
      }
    }
  }
  const workers = [];
  for (let i = 0; i < Math.min(concurrency, items.length); i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}

async function runScan() {
  try {
    // Fail-fast checks for production environment
    if (process.env.NODE_ENV === 'production') {
      const required = ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'CRON_SECRET'];
      const missing = required.filter(k => !process.env[k]);
      if (missing.length > 0) {
        console.error('[scan] Missing required env:', missing);
        return NextResponse.json({ success: false, error: `Missing env: ${missing.join(', ')}` }, { status: 500 });
      }
    }

    const portfolio = await getPortfolio();
    const marketData = await fetchAllMarketData();
    const calibrationTable = await getCalibrationTable();
    const calibrationUpdatedAt = await getCalibrationUpdatedAt();
    
    const peakValue = Math.max(portfolio.totalValue, ...(portfolio.performanceHistory?.map(p => p.totalValue) || []));
    const cooldown = await getTbdCooldownUntil(kvGet);

    if (!calibrationTable) {
      console.warn('[scan] Nessuna tabella di calibrazione: le probabilità usano il prior neutro 50%. Attendi che /api/cron/calibrate giri almeno una volta.');
    }

    // ── Aggiorna prezzi posizioni aperte ─────────────────────────────────────
    const openPositions = portfolio.positions.filter(p => p.status === 'OPEN');
    const priceUpdates  = marketData
      .filter(md => openPositions.some(p => p.symbol === md.symbol))
      .map(md => ({ positionId: openPositions.find(p => p.symbol === md.symbol)!.id, currentPrice: md.price }));

    if (priceUpdates.length > 0) {
      await updatePositionPrices(priceUpdates);
    } else {
      await recalcPortfolio();
    }

    // ── Alert SL/TP ─────────────────────────────────────────────────────────
    for (const pos of openPositions) {
      const md = marketData.find(m => m.symbol === pos.symbol);
      if (!md) continue;
      if (md.price <= pos.stopLoss)   await notifyStopLossAlert(pos, md.price);
      if (md.price >= pos.takeProfit) await notifyTakeProfitAlert(pos, md.price);
    }

    // ── Alert Core/Satellite Drift ──────────────────────────────────────────
    if (openPositions.length > 0) {
      const coreValue = openPositions
        .filter(p => p.tags?.some(t => t.toLowerCase() === 'core'))
        .reduce((sum, p) => sum + ((Number(p.capitalAllocated) || 0) + (Number(p.unrealizedPnl) || 0)), 0);
      const satValue = openPositions
        .filter(p => p.tags?.some(t => t.toLowerCase() === 'satellite'))
        .reduce((sum, p) => sum + ((Number(p.capitalAllocated) || 0) + (Number(p.unrealizedPnl) || 0)), 0);
      const totalCoreSat = coreValue + satValue;
      if (totalCoreSat > 0) {
        const corePct = (coreValue / totalCoreSat) * 100;
        const userTarget = portfolio.coreSatelliteTarget ?? 70;
        
        if (Math.abs(corePct - userTarget) > 5) {
          const engine = new AntigravityEngine(DEFAULT_ANTIGRAVITY_CONFIG);
          const state = engine.calculateState(portfolio.totalValue, peakValue, 0, cooldown);
          
          await notifyCoreSatelliteDrift(corePct, userTarget, state.coreTargetPct, state.tbdTargetPct);
        }
      }
    }

    // ── Matrice di correlazione su dati live ─────────────────────────────────
    const correlationMatrix = buildCorrelationMatrix(marketData);

    // ── Analisi tecnica + selezione candidato ────────────────────────────────
    const analyses = marketData
      .map(md => analyzeAsset(md, calibrationTable))
      .filter((a): a is NonNullable<typeof a> => a !== null);

    const { candidates, skippedForCorrelation, skippedUntrusted } = findPromisingCandidatesBatch(
      analyses, portfolio, correlationMatrix
    );

    const aiMode = portfolio.aiMode || 'STRICT';
    
    // ── Antigravity Engine V2 Check ─────────────────────────────────────────
    const avgQuality = candidates.length > 0
      ? candidates.reduce((sum, c) => sum + (c.winProbability || 0), 0) / candidates.length
      : 0;
      
    const engine = new AntigravityEngine(DEFAULT_ANTIGRAVITY_CONFIG);
    const agState = engine.calculateState(portfolio.totalValue, peakValue, avgQuality, cooldown);

    // ── Daily summary Telegram ───────────────────────────────────────────────
    await notifyDailySummary(
      portfolio.totalValue,
      portfolio.totalPnL,
      portfolio.totalPnLPercent,
      portfolio.targetAnnualReturn || 0.25,
      openPositions.length
    );

    // ── Genera segnali Trading-by-Day automatici e salvali in KV (usati dalla UI)
    try {
      const tbdConfigRaw = await getTbdConfig(); // TradingEngineConfig

      // Map TradingEngineConfig -> TBDConfig expected by TBDEngine
      const tbdConfigForEngine = {
        targetAnnualReturn: portfolio.targetAnnualReturn ?? 0.25,
        tradingDaysPerYear: 252,
        maxDailyTrades: (tbdConfigRaw as any).maxTradesPerDay ?? (tbdConfigRaw as any).activeSlots ?? 3,
        maxDailyLoss: (tbdConfigRaw as any).dailyRiskBudget ?? 200,
        maxDrawdownPct: 5,
        riskPerTradePct: 0.02,
        minKellyFraction: 0.1,
        maxKellyFraction: 0.5,
        minQuontestScore: 55,
      };

      const tbdEngine = new TBDEngine(tbdConfigForEngine as any);
      const todayLog = await getTodayLog();
      const tradesToday = todayLog?.totalTrades ?? 0;
      const pnlToday = todayLog?.realizedPnL ?? 0;
      const currentDayReturn = (portfolio.totalPnLPercent ?? 0) / 100; // convert % to decimal

      const tbdState = tbdEngine.checkCircuitBreaker(
        currentDayReturn,
        (agState as any).currentDrawdownPct ?? 0,
        tradesToday,
        pnlToday,
        (agState as any).status
      );

      const tbdSignals = tbdEngine.generateSignals(
        portfolio.totalValue,
        tbdState,
        (agState as any).status,
        undefined,
        portfolio.positions || []
      );

      if (tbdSignals.length > 0) {
        await saveSignals(tbdSignals as any);
        console.log(`[scan] Saved ${tbdSignals.length} TBD signals to KV`);

        // invia pre-alert push per ogni segnale generato (con concurrency)
        await runWithConcurrency(tbdSignals, async (s) => {
          try {
            await sendPreAlertNotification(s as any);
          } catch (e) {
            console.error('[scan] sendPreAlertNotification failed for', (s as any).id, e);
          }
        }, 5);
      }
    } catch (err) {
      console.error('[scan] TBD generation error', err);
    }

    if ((agState as any).tbdTargetPct === 0) {
      return NextResponse.json({
        success: true,
        message: `Nessun segnale generato. Antigravity Engine V2 ha bloccato il TBD. Stato: ${(agState as any).status}. Motivazione: ${(agState as any).actionRequired}`,
        agState
      });
    }

    if (candidates.length === 0) {
      return NextResponse.json({
        success: true,
        message: `Nessun segnale [Modo: ${aiMode}]: nessun setup con probabilità >${aiMode === 'STRICT' ? '55' : '50'}% e decorrelato dalle posizioni aperte.`,
        scanned: analyses.length,
        skippedForCorrelation,
        skippedUntrusted,
        calibrationUpdatedAt,
      });
    }

    // ── Genera segnali con AI in Batch ─────────────────────────────────────
    const signals = await evaluateCandidatesWithAIBatch(candidates.slice(0, 5), portfolio); // Top 5 max per evitare payload enormi
    
    if (signals.length === 0) {
      return NextResponse.json({ success: true, message: 'Nessun segnale approvato dall\'AI.' });
    }

    // Salva i segnali (uno per uno o batch)
    for (const signal of signals) {
      await addSignal(signal as any);
      await notifyNewSignal(signal, APP_URL);
    }

    return NextResponse.json({
      success: true,
      message: `${signals.length} Segnali generati dall'AI.`,
      signals,
      calibrationUpdatedAt,
    });
  } catch (err) {
    console.error('[scan] Error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
