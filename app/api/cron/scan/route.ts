import { NextRequest, NextResponse } from 'next/server';
import { fetchAllMarketData } from '@/lib/market';
import { analyzeAsset, findBestCandidate, generateSignalWithAI } from '@/lib/ai';
import { getPortfolio, addSignal } from '@/lib/storage';
import { notifyNewSignal, notifyStopLossAlert, notifyTakeProfitAlert, notifyDailySummary } from '@/lib/alerts';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://rv-capital-alpha.vercel.app';

// ─── CRON JOB ─────────────────────────────────────────────────────────────────
// Called by Vercel Cron every 2 hours
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runScan();
}

// Manual trigger from UI
export async function POST(req: NextRequest) {
  return runScan();
}

async function runScan() {
  try {
    const [marketData, portfolio] = await Promise.all([
      fetchAllMarketData(),
      getPortfolio(),
    ]);

    // ── CHECK STOP LOSS / TAKE PROFIT ALERTS ─────────────────────────────────
    const openPositions = portfolio.positions.filter(p => p.status === 'OPEN');
    for (const pos of openPositions) {
      const md = marketData.find(m => m.symbol === pos.symbol);
      if (!md) continue;

      const distanceToSL = (md.price - pos.stopLoss) / pos.entryPrice;
      const distanceToTP = (pos.takeProfit - md.price) / pos.entryPrice;

      if (distanceToSL < 0.02) {
        await notifyStopLossAlert(pos, md.price);
      } else if (distanceToTP < 0.01 || md.price >= pos.takeProfit) {
        await notifyTakeProfitAlert(pos, md.price);
      }
    }

    // ── CHECK IF DAILY SUMMARY TIME (8:00 UTC) ────────────────────────────────
    const hour = new Date().getUTCHours();
    if (hour === 7) {
      await notifyDailySummary(
        portfolio.totalValue,
        portfolio.totalPnL,
        portfolio.totalPnLPercent,
        portfolio.targetAnnualReturn,
        openPositions.length
      );
    }

    // ── SIGNAL GENERATION ─────────────────────────────────────────────────────
    // Don't generate if there's already a pending signal
    const hasPending = portfolio.signals.some(s => s.status === 'PENDING');
    if (hasPending) {
      return NextResponse.json({ success: true, message: 'Segnale in attesa di conferma — scan saltato.' });
    }

    const analyses = marketData
      .map(analyzeAsset)
      .filter(Boolean) as ReturnType<typeof analyzeAsset>[];

    const filtered = analyses.filter(a => a !== null) as NonNullable<ReturnType<typeof analyzeAsset>>[];
    const candidate = findBestCandidate(filtered, portfolio);

    if (!candidate) {
      return NextResponse.json({
        success: true,
        message: 'Nessun segnale trovato. Mercato non offre opportunità valide ora.',
        scanned: filtered.length,
      });
    }

    const signal = await generateSignalWithAI(candidate, portfolio);
    if (!signal) {
      return NextResponse.json({ success: false, message: 'Generazione segnale AI fallita.' });
    }

    await addSignal(signal);
    await notifyNewSignal(signal, APP_URL);

    return NextResponse.json({
      success: true,
      message: `Segnale generato: ${signal.action} ${signal.symbol}`,
      signal,
    });
  } catch (err) {
    console.error('Scan error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
