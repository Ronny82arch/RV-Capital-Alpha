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
import { projectAllBuckets } from '@/lib/monte-carlo';
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

    // Aggiorna proiezioni Monte Carlo per bucket (p10/p50/p90)
    // Eseguito dopo ogni satellite-scan per tenere le proiezioni fresche
    const coreSatTarget = portfolio.coreSatelliteTarget ?? 70;
    const satTarget = 100 - coreSatTarget;
    const bucketInputs = [
      {
        name: 'Core',
        currentValue: portfolio.totalValue * (coreSatTarget / 100),
        mu: 0.08,   // 8% atteso Core (ETF/blue chip)
        sigma: 0.15, // 15% vol
      },
      {
        name: 'Satellite',
        currentValue: portfolio.totalValue * (satTarget / 100),
        mu: 0.35,   // 35% atteso Satellite (stock picking)
        sigma: 0.25, // 25% vol
      },
    ];
    const projections = projectAllBuckets(bucketInputs, 1, 10000);
    await mutatePortfolio(p => {
      p.bucketProjections = projections;
    });

    return NextResponse.json({
      success: true,
      scannedAssets: watchlist.length,
      candidatesAnalyzed: candidates.length,
      signalsGenerated: signals.length,
      topSignal: signals[0] || null,
      bucketProjections: projections,
    });

  } catch (err: any) {
    console.error('[Satellite Scan Error]', err);
    return NextResponse.json(
      { success: false, error: err.message }, { status: 500 }
    );
  }
}
