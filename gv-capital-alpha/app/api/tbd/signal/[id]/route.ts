/**
 * PATCH /api/tbd/signal/[id]
 * Aggiorna stato di un segnale: TRIGGERED → CLOSED_TP | CLOSED_SL | CANCELLED
 * Aggiorna automaticamente il P&L del giorno.
 */

import { NextResponse } from 'next/server';
import { TradingByDayEngine } from '@/lib/trading-by-day';
import {
  updateSignalStatus, getTodayLog, saveTodayLog,
  getTbdConfig, todayKey,
} from '@/lib/tbd-storage';



export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id }  = await params;
    const body    = await request.json();
    const { status, realizedPnL } = body as {
      status: 'TRIGGERED' | 'CLOSED_TP' | 'CLOSED_SL' | 'CANCELLED';
      realizedPnL?: number;
    };

    if (!status) {
      return NextResponse.json({ success: false, error: 'status richiesto' }, { status: 400 });
    }

    // 1. Aggiorna stato segnale
    const updatedSignal = await updateSignalStatus(id, status, realizedPnL);
    if (!updatedSignal) {
      return NextResponse.json({ success: false, error: 'Segnale non trovato' }, { status: 404 });
    }

    // 2. Se il trade è chiuso, aggiorna il P&L giornaliero
    if (['CLOSED_TP', 'CLOSED_SL'].includes(status) && typeof realizedPnL === 'number') {
      const config = await getTbdConfig();
      const engine = new TradingByDayEngine(config);

      let log = await getTodayLog();
      if (!log) log = engine.createEmptyDayLog(todayKey());

      const updatedLog = engine.updateDayLog(log, { ...updatedSignal, realizedPnL });
      await saveTodayLog(updatedLog);

      return NextResponse.json({
        success: true,
        signal:  updatedSignal,
        dayLog:  updatedLog,
        pnl:     updatedLog.realizedPnL,
        message: `Trade ${status === 'CLOSED_TP' ? '✅ TP' : '❌ SL'}: ${realizedPnL >= 0 ? '+' : ''}${realizedPnL.toFixed(2)}€`,
      });
    }

    return NextResponse.json({ success: true, signal: updatedSignal });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
