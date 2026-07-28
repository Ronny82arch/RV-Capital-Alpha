/**
 * POST /api/tbd/scan
 * Hunter Mode: genera segnali PRE_ALERT solo su setup estremi.
 * Integra Antigravity per capitale TBD giornaliero.
 */

import { NextRequest, NextResponse } from 'next/server';
import { TradingByDayEngine, TbdSignal } from '@/lib/trading-by-day';
import { fetchAllTbdMarketData } from '@/lib/tbd-market';
import {
  getTodayLog, saveTodayLog, getTbdConfig,
  getActiveSignals, addSignal, updateSignalStatus, todayKey,
  acquireDayLock, releaseDayLock, kvGet
} from '@/lib/tbd-storage';
import { 
  sendPreAlertNotification, sendCircuitBreakerNotification,
  sendSignalTriggeredNotification, sendExitNotification
} from '@/lib/tbd-notifications';
import { AntigravityEngine, getTbdCooldownUntil } from '@/lib/antigravity-engine';
import { getPortfolio, updatePortfolioPeakValue } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Auth
  const auth = req.headers.get('authorization');
  const isCron = auth === `Bearer ${process.env.CRON_SECRET}`;
  const isDev = process.env.NODE_ENV === 'development';
  const host = req.headers.get('host');
  const referer = req.headers.get('referer');
  const origin = req.headers.get('origin');
  let isSameOrigin = false;
  if (host && referer) {
    try { isSameOrigin = new URL(referer).host === host; } catch {}
  }
  if (!isSameOrigin && origin) {
    try { isSameOrigin = new URL(origin).host === (host ?? ''); } catch {}
  }
  if (!isCron && !isDev && !isSameOrigin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Stato globale
    const portfolio = await getPortfolio();
    await updatePortfolioPeakValue(portfolio.totalValue);

    const config = await getTbdConfig();
    const engine = new TradingByDayEngine(config);

    let log = await getTodayLog();
    if (!log) {
      log = engine.createEmptyDayLog(todayKey());
      await saveTodayLog(log);
    }

    // 2. Antigravity: quanto capitale TBD oggi?
    const agEngine = new AntigravityEngine();
    const peakValue = Math.max(
      portfolio.totalValue,
      ...(portfolio.performanceHistory || []).map((p: { totalValue: number }) => p.totalValue)
    );
    const cooldown = await getTbdCooldownUntil(kvGet);

    // Quality score medio da segnali esistenti (se ci sono)
    const existingSignals = await getActiveSignals();
    const avgQuality = existingSignals.length > 0
      ? existingSignals.reduce((s, sig) => s + (sig.qualityScore || 0), 0) / existingSignals.length
      : 0;

    const agState = agEngine.calculateState(
      portfolio.totalValue, peakValue, avgQuality, cooldown
    );

    // Se PROTECT, TBD è 0 — cortocircuito immediato
    if (agState.status === 'PROTECT') {
      return NextResponse.json({
        success: true,
        circuitBreaker: true,
        antigravity: agState.status,
        message: agState.reason,
        newSignals: [],
      });
    }

    const { tbdValue } = agEngine.calculateAbsoluteAllocation(portfolio.totalValue, agState);
    // Override config.totalCapital con il capitale effettivo oggi (safety cap: max 3x config base)
    const effectiveTbdCapital = Math.min(tbdValue, config.totalCapital * 3);
    engine['config'].totalCapital = effectiveTbdCapital;

    // 3. Circuit breaker giornaliero TBD
    const pnl = log.realizedPnL;
    const existing = existingSignals; // già letti sopra
    const breaker = engine.evaluateDailyCircuitBreaker(log);

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

    // 4. Fetch dati mercato H1
    const marketData = await fetchAllTbdMarketData();

    // 5. Calcola il capitale residuo prima di generare i segnali
    const currentlyCommitted = existing.reduce((sum, s) => sum + (s.allocatedSize || 0), 0);
    let remainingCapital = Math.max(0, effectiveTbdCapital - currentlyCommitted);

    // 6. Genera segnali dinamici usando il capitale residuo
    const rawSignals = engine.scanMarketForSpeculation(marketData, remainingCapital, log);

    // 7. Filtra asset già in posizione attiva
    const activeCount = existing.length;
    const maxAllowedNew = Math.max(0, config.activeSlots - activeCount);

    const existingAssets = new Set(
      existing.map(s => `${s.asset}:${s.direction}`)
    );

    const newSignals: TbdSignal[] = [];

    for (const s of rawSignals) {
      if (newSignals.length >= maxAllowedNew) break;
      if (existingAssets.has(`${s.asset}:${s.direction}`)) continue;
      if (s.allocatedSize <= 0) continue;

      // Se la size supera la liquidità residua, riduci proporzionalmente
      if (s.allocatedSize > remainingCapital) {
        if (remainingCapital < 100) break;
        const ratio = remainingCapital / s.allocatedSize;
        s.allocatedSize = Number(remainingCapital.toFixed(2));
        s.expectedPnL = Number((s.expectedPnL * ratio).toFixed(2));
        s.maxLoss = Number((s.maxLoss * ratio).toFixed(2));
      }

      newSignals.push(s);
      remainingCapital -= s.allocatedSize;
    }

    // 8. Salva e notifica nuovi segnali (Pre-Alert)
    for (const signal of newSignals) {
      await addSignal(signal);
      await sendPreAlertNotification(signal);
    }

    // 9. Monitora segnali attivi per trigger o uscita SL/TP
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
      antigravity: agState.status,
      effectiveTbdCapital,
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
