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
import { AntigravityEngine, DEFAULT_ANTIGRAVITY_CONFIG } from '@/lib/antigravity-engine';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://gv-capital-alpha.vercel.app';

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization');
  const isCron = auth === `Bearer ${process.env.CRON_SECRET}`;
  const isDev = process.env.NODE_ENV === 'development';
  
  const host = req.headers.get('host');
  const referer = req.headers.get('referer');
  const origin = req.headers.get('origin');
  
  let isSameOrigin = false;
  if (host) {
    if (referer) {
      try {
        const refUrl = new URL(referer);
        isSameOrigin = refUrl.host === host;
      } catch {}
    }
    if (!isSameOrigin && origin) {
      try {
        const origUrl = new URL(origin);
        isSameOrigin = origUrl.host === host;
      } catch {}
    }
  }
  return !!(isCron || isDev || isSameOrigin);
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

async function runScan() {
  try {
    const portfolio = await getPortfolio();
    const marketData = await fetchAllMarketData();
    const calibrationTable = await getCalibrationTable();
    const calibrationUpdatedAt = await getCalibrationUpdatedAt();

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

    // ── Alert SL/TP ──────────────────────────────────────────────────────────
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
          const leverageState = engine.calculateLeverageState(
            portfolio.totalValue,
            openPositions.reduce((sum, p) => sum + p.capitalAllocated, 0),
            portfolio.totalPnL
          );
          const aiRec = engine.calculateAllocationTargets(portfolio.totalValue, leverageState.currentLeverage, 70, 30);
          
          await notifyCoreSatelliteDrift(corePct, userTarget, aiRec.coreAssetsPct, aiRec.tbdAssetsPct);
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
    
    // ── Daily summary Telegram ───────────────────────────────────────────────
    await notifyDailySummary(
      portfolio.totalValue,
      portfolio.totalPnL,
      portfolio.totalPnLPercent,
      portfolio.targetAnnualReturn,
      openPositions.length
    );
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
      await addSignal(signal);
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
