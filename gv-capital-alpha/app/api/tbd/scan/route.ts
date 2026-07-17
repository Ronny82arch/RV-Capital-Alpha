/**
 * POST /api/tbd/scan
 * Avvia lo scanner H1, genera segnali PRE_ALERT e gestisce il circuit breaker.
 */

import { NextRequest, NextResponse } from 'next/server';
import { TradingByDayEngine } from '@/lib/trading-by-day';
import { fetchAllTbdMarketData } from '@/lib/tbd-market';
import {
  getTodayLog, saveTodayLog, getTbdConfig,
  getActiveSignals, addSignal, updateSignalStatus,
} from '@/lib/tbd-storage';
import { 
  sendPreAlertNotification, sendCircuitBreakerNotification,
  sendSignalTriggeredNotification, sendExitNotification
} from '@/lib/tbd-notifications';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
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

  if (!isCron && !isDev && !isSameOrigin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
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

    // 5. Salva e notifica nuovi segnali (Pre-Alert)
    for (const signal of newSignals) {
      await addSignal(signal);
      await sendPreAlertNotification(signal);
    }

    // 6. Monitora segnali attivi per trigger o uscita SL/TP
    for (const signal of existing) {
      const md = marketData.find(m => m.asset === signal.asset);
      if (!md) continue;

      const currentPrice = md.currentPrice;
      const isBuy = signal.direction === 'BUY';

      if (signal.status === 'PRE_ALERT') {
        const reachedEntry = isBuy 
          ? currentPrice <= signal.entryPrice 
          : currentPrice >= signal.entryPrice;
        if (reachedEntry) {
          await updateSignalStatus(signal.id, 'TRIGGERED');
          signal.status = 'TRIGGERED';
          await sendSignalTriggeredNotification(signal, currentPrice);
        }
      } else if (signal.status === 'TRIGGERED' || signal.status === 'ACTIVE') {
        const hitTp = isBuy 
          ? currentPrice >= signal.takeProfit 
          : currentPrice <= signal.takeProfit;
        const hitSl = isBuy 
          ? currentPrice <= signal.stopLoss 
          : currentPrice >= signal.stopLoss;

        if (hitTp) {
          const updatedSignal = await updateSignalStatus(signal.id, 'CLOSED_TP', signal.expectedPnL);
          if (updatedSignal && log) {
            const updatedLog = engine.updateDayLog(log, updatedSignal);
            await saveTodayLog(updatedLog);
          }
          await sendExitNotification(signal, 'TP', currentPrice);
        } else if (hitSl) {
          const updatedSignal = await updateSignalStatus(signal.id, 'CLOSED_SL', -signal.maxLoss);
          if (updatedSignal && log) {
            const updatedLog = engine.updateDayLog(log, updatedSignal);
            await saveTodayLog(updatedLog);
          }
          await sendExitNotification(signal, 'SL', currentPrice);
        }
      }
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
