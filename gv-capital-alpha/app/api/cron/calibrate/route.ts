/**
 * GET/POST /api/cron/calibrate
 * Cron Vercel: ogni giorno alle 06:00 UTC (prima del cron scan alle 08:00).
 * Scarica 2 anni di storia per ogni asset in watchlist, costruisce la tabella
 * di calibrazione walk-forward (lib/backtest.ts) e la salva su Vercel KV.
 * Il cron scan la legge ogni mattina per usare probabilità reali invece di
 * score euristici arbitrari.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchAllMarketDataForCalibration, WATCHLIST } from '@/lib/market';
import { buildCalibrationTable } from '@/lib/backtest';
import { saveCalibrationTable } from '@/lib/storage';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return run();
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return run();
}

async function run() {
  try {
    const marketData = await fetchAllMarketDataForCalibration();

    if (marketData.length < Math.floor(WATCHLIST.length / 2)) {
      return NextResponse.json({
        success: false,
        message: `Solo ${marketData.length}/${WATCHLIST.length} asset scaricati: troppo pochi per una calibrazione affidabile.`,
      });
    }

    const historyBySymbol: Record<string, { date: string; close: number; high?: number; low?: number }[]> = {};
    for (const md of marketData) historyBySymbol[md.symbol] = md.history;

    const table = buildCalibrationTable(historyBySymbol, 10);
    await saveCalibrationTable(table);

    const total   = Object.keys(table).length;
    const trusted = Object.values(table).filter(e => e.sampleSize >= 30).length;
    const samples = Object.values(table).reduce((s, e) => s + e.sampleSize, 0);

    return NextResponse.json({
      success: true,
      message: `Calibrazione completata: ${total} setup trovati, ${trusted} con campione ≥30, ${samples} osservazioni totali su ${marketData.length} asset.`,
      total, trusted, samples,
    });
  } catch (err) {
    console.error('Calibration error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
