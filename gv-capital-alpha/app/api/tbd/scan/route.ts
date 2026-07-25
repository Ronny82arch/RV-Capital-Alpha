/**
 * POST /api/tbd/scan
 * Avvia lo scanner H1, genera segnali PRE_ALERT e gestisce il circuit breaker.
 */

import { NextRequest, NextResponse } from 'next/server';
import { TradingByDayEngine, TbdSignal } from '@/lib/trading-by-day';
import { fetchAllTbdMarketData } from '@/lib/tbd-market';
import {
  getTodayLog, saveTodayLog, getTbdConfig,
  getActiveSignals, addSignal, updateSignalStatus, todayKey,
  acquireDayLock, releaseDayLock
} from '@/lib/tbd-storage';
import { 
  sendPreAlertNotification, sendCircuitBreakerNotification,
  sendSignalTriggeredNotification, sendExitNotification
} from '@/lib/tbd-notifications';

export const dynamic = 'force-dynamic';

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

    // 1. Controlla / Inizializza log giornaliero e circuit breaker
    let log = await getTodayLog();
    if (!log) {
      log = engine.createEmptyDayLog(todayKey());
      await saveTodayLog(log);
    }
    const pnl     = log.realizedPnL;
    
    // N2: leggi i segnali attivi PRIMA del circuit breaker
    const existing = await getActiveSignals();
    const breaker = engine.evaluateDailyCircuitBreaker(pnl, existing);

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

    // 3. Calcola il capitale residuo prima di generare i segnali
    // existing già letto in alto
    const currentlyCommitted = existing.reduce((sum, s) => sum + (s.allocatedSize || 0), 0);
    let remainingCapital = Math.max(0, config.totalCapital - currentlyCommitted);

    // 4. Genera segnali dinamici usando il capitale residuo (così da sfruttare tutta la liquidità)
    const rawSignals = engine.scanMarketForSpeculation(marketData, remainingCapital);

    // 5. Filtra asset già in posizione attiva
    const activeCount = existing.length;
    const maxAllowedNew = Math.max(0, config.activeSlots - activeCount);

    const existingAssets = new Set(
      existing.map(s => `${s.asset}:${s.direction}`)
    );

    const newSignals: TbdSignal[] = [];

    for (const s of rawSignals) {
      if (newSignals.length >= maxAllowedNew) break;
      if (existingAssets.has(`${s.asset}:${s.direction}`)) continue;

      if (s.allocatedSize <= 0) continue; // N4: Filtro segnali con size 0 mancante

      // Se la size del segnale supera la liquidità residua, riduci la size
      if (s.allocatedSize > remainingCapital) {
        if (remainingCapital < 100) break; // Non aprire slot sotto i 100€
        const ratio = remainingCapital / s.allocatedSize;
        s.allocatedSize = Number(remainingCapital.toFixed(2));
        s.expectedPnL = Number((s.expectedPnL * ratio).toFixed(2));
        s.maxLoss = Number((s.maxLoss * ratio).toFixed(2));
      }

      newSignals.push(s);
      remainingCapital -= s.allocatedSize;
    }

    // 5. Salva e notifica nuovi segnali (Pre-Alert)
    for (const signal of newSignals) {
      await addSignal(signal);
      await sendPreAlertNotification(signal);
    }

    // 6. Monitora segnali attivi per trigger o uscita SL/TP
    const dateKey = todayKey();
    const hasLock = await acquireDayLock(dateKey);

    if (!hasLock) {
      console.warn('[TBD] Lock non acquisito, skip monitoraggio TP/SL in questo run');
    } else {
      try {
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
      } finally {
        await releaseDayLock(dateKey);
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
