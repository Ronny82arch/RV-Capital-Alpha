/**
 * POST /api/tbd/scan
 * Avvia lo scanner H1, genera segnali PRE_ALERT e gestisce il circuit breaker.
 */

import { NextResponse } from 'next/server';
import { TradingByDayEngine } from '@/lib/trading-by-day';
import { fetchAllTbdMarketData } from '@/lib/tbd-market';
import {
  getTodayLog, saveTodayLog, getTbdConfig,
  getActiveSignals, addSignal,
} from '@/lib/tbd-storage';
import { sendPreAlertNotification, sendCircuitBreakerNotification } from '@/lib/tbd-notifications';

export const runtime = 'edge';

export async function POST() {
  try {
    const config  = await getTbdConfig();
    const engine  = new TradingByDayEngine(config);

    // 1. Controlla circuit breaker
    const log     = await getTodayLog();
    const pnl     = log?.realizedPnL ?? 0;
    const breaker = engine.evaluateDailyCircuitBreaker(pnl);

    if (breaker.stopTrading) {
      if (breaker.reason !== 'NONE') {
        await sendCircuitBreakerNotification(breaker.message, breaker.reason);
      }
      return NextResponse.json({
        success: true,
        circuitBreaker: true,
        reason: breaker.reason,
        message: breaker.message,
        newSignals: [],
      });
    }

    // 2. Fetch dati mercato H1
    const marketData = await fetchAllTbdMarketData();

    // 3. Genera segnali
    const rawSignals = engine.scanMarketForSpeculation(marketData);

    // 4. Filtra asset già in posizione attiva
    const existing = await getActiveSignals();
    const existingAssets = new Set(
      existing.map(s => `${s.asset}:${s.direction}`)
    );
    const newSignals = rawSignals.filter(
      s => !existingAssets.has(`${s.asset}:${s.direction}`)
    );

    // 5. Salva e notifica
    for (const signal of newSignals) {
      await addSignal(signal);
      await sendPreAlertNotification(signal);
    }

    return NextResponse.json({
      success: true,
      circuitBreaker: false,
      message: breaker.message,
      scannedAssets: marketData.length,
      newSignals: newSignals.length,
      signals: newSignals,
    });

  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
