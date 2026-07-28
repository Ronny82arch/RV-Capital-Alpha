/**
 * GET /api/cron/satellite-scan
 * Cron scan Satellite con watchlist Alpha.
 * Genera segnali tramite il pipeline multi-agente (Technical → AI).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAlphaWatchlist, fetchAllMarketData } from '@/lib/market';
import { buildCorrelationMatrix, checkCorrelationStrict } from '@/lib/correlation';
import {
  analyzeAsset,
  findPromisingCandidatesBatch,
  evaluateCandidatesWithAIBatch,
} from '@/lib/ai';
import { getPortfolio, mutatePortfolio } from '@/lib/storage';
import { sendPushToAllSubscriptions } from '@/lib/push';
import type { CalibrationData } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const watchlist = getAlphaWatchlist();
    const marketData = await fetchAllMarketData(watchlist);
    
    const matrix = buildCorrelationMatrix(marketData);
    const portfolio = await getPortfolio();
    const openPositions = portfolio.positions.filter(p => p.status === 'OPEN');
    const openSymbols = openPositions.map(p => p.symbol);

    // Analisi tecnica su tutti gli asset
    const calibration: CalibrationData | null = (portfolio as any).calibration || null;
    const analyses = marketData
      .map(m => analyzeAsset(m, calibration))
      .filter((a): a is NonNullable<typeof a> => a !== null);

    // Selezione candidati con filtro correlazione
    const { candidates } = findPromisingCandidatesBatch(
      analyses, portfolio, matrix,
      30,   // maxPositions
      0.70  // correlationThreshold
    );

    // Filtra ulteriormente per correlazione con posizioni aperte
    const validCandidates = candidates.filter(c => {
      const check = checkCorrelationStrict(
        c.market.symbol, openPositions, matrix, 'STRICT'
      );
      return check.allowed;
    });

    // Genera segnali tramite AI batch
    const signals = await evaluateCandidatesWithAIBatch(validCandidates, portfolio);
    
    if (signals.length > 0) {
      await mutatePortfolio(p => {
        p.signals.push(...signals);
      });
      
      await sendPushToAllSubscriptions({
        title: `🎯 ${signals.length} nuovi segnali Satellite`,
        body: `Top: ${signals[0].symbol} (${signals[0].action}) — Win prob: ${(signals[0].winProbability * 100).toFixed(1)}%`,
        data: { type: 'satellite_scan', count: String(signals.length) },
      });
    }

    // Aggiorna prezzi correnti sulle posizioni aperte
    await mutatePortfolio(p => {
      for (const pos of p.positions) {
        if (pos.status !== 'OPEN') continue;
        const md = marketData.find(m => m.symbol === pos.symbol);
        if (md) {
          pos.currentPrice = md.price;
          pos.unrealizedPnl = pos.action === 'BUY'
            ? (md.price - pos.entryPrice) * pos.quantity
            : (pos.entryPrice - md.price) * pos.quantity;
          pos.unrealizedPnlPercent = pos.capitalAllocated > 0
            ? (pos.unrealizedPnl / pos.capitalAllocated) * 100
            : 0;
        }
      }
    });

    return NextResponse.json({
      success: true,
      scannedAssets: watchlist.length,
      candidatesAnalyzed: candidates.length,
      signalsGenerated: signals.length,
      topSignal: signals[0] || null,
    });

  } catch (err: any) {
    console.error('[Satellite Scan Error]', err);
    return NextResponse.json(
      { success: false, error: err.message }, { status: 500 }
    );
  }
}
