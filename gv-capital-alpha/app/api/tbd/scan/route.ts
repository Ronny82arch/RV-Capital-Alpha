/**
 * POST /api/tbd/scan
 * Hunter Mode: genera segnali PRE_ALERT solo su setup estremi.
 * Integra Antigravity per capitale TBD giornaliero.
 */

import { NextRequest, NextResponse } from 'next/server';
import { TradingByDayEngine, DEFAULT_CONFIG } from '@/lib/trading-by-day';
import { fetchAllTbdMarketData } from '@/lib/tbd-market';
import {
  getTodayLog, saveTodayLog, getTbdConfig,
  getActiveSignals, addSignal, updateSignalStatus, todayKey,
  acquireDayLock, releaseDayLock, kvGet, kvSet
} from '@/lib/tbd-storage';
import { 
  sendPreAlertNotification, sendCircuitBreakerNotification,
  sendSignalTriggeredNotification, sendExitNotification
} from '@/lib/tbd-notifications';
import { AntigravityEngine, getTbdCooldownUntil, setTbdCooldownUntil } from '@/lib/antigravity-engine';
import { getPortfolio, updatePortfolioPeakValue } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const isCron = auth === `Bearer ${process.env.CRON_SECRET}`;
  const isDev = process.env.NODE_ENV === 'development';
  const host = req.headers.get('host');
  const referer = req.headers.get('referer');
  let isSameOrigin = false;
  if (host && referer) {
    try { isSameOrigin = new URL(referer).host === host; } catch {}
  }
  if (!isCron && !isDev && !isSameOrigin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const portfolio = await getPortfolio();
    await updatePortfolioPeakValue(portfolio.totalValue);
    
    const config = await getTbdConfig();
    const engine = new TradingByDayEngine(config);
    
    let log = await getTodayLog();
    if (!log) {
      log = engine.createEmptyDayLog(todayKey());
      await saveTodayLog(log);
    }

    // Antigravity: calcola capitale TBD effettivo oggi
    const agEngine = new AntigravityEngine();
    const peakValue = Math.max(
      portfolio.totalValue,
      ...(portfolio.performanceHistory || []).map((p: { totalValue: number }) => p.totalValue)
    );
    // getTbdCooldownUntil richiede il callback kvGet da tbd-storage
    const cooldown = await getTbdCooldownUntil(kvGet);
    
    const existingSignals = await getActiveSignals();
    const avgQuality = existingSignals.length > 0
      ? existingSignals.reduce((s, sig) => s + (sig.qualityScore || 0), 0) / existingSignals.length
      : 0;
    
    const agState = agEngine.calculateState(
      portfolio.totalValue, peakValue, avgQuality, cooldown
    );
    
    if (agState.status === 'PROTECT') {
      return NextResponse.json({
        success: true, circuitBreaker: true, antigravity: agState.status,
        message: agState.reason, newSignals: [],
      });
    }

    const { tbdValue } = agEngine.calculateAbsoluteAllocation(portfolio.totalValue, agState);
    const effectiveTbdCapital = Math.min(tbdValue, config.totalCapital * 3);
    // Crea un engine dedicato allo scan con il capitale effettivo (no mutazione)
    const scanConfig = { ...config, totalCapital: effectiveTbdCapital };
    const scanEngine = new TradingByDayEngine(scanConfig);

    // Circuit breaker
    const breaker = scanEngine.evaluateDailyCircuitBreaker(log);
    if (breaker.stopTrading) {
      if (breaker.reason !== 'NONE') {
        await sendCircuitBreakerNotification(breaker.message, breaker.reason);
      }
      return NextResponse.json({
        success: true, circuitBreaker: true,
        reason: breaker.reason, message: breaker.message, newSignals: [],
      });
    }

    // Lock atomico giornaliero
    const dateKey = todayKey();
    const hasLock = await acquireDayLock(dateKey);
    if (!hasLock) {
      return NextResponse.json({
        success: true, locked: true,
        message: 'Another TBD scan is already running.',
      });
    }

    try {
      const marketData = await fetchAllTbdMarketData();
      
      const committed = existingSignals
        .filter(s => ['PRE_ALERT', 'ACTIVE', 'TRIGGERED'].includes(s.status))
        .reduce((sum, s) => sum + (s.allocatedSize || 0), 0);
      const availableCash = effectiveTbdCapital - committed;

      const newSignals = scanEngine.scanMarketForSpeculation(marketData, availableCash, log);
      const { valid, pending } = scanEngine.filterSignalsByLiquidity(newSignals);
      
      for (const signal of valid) {
        await addSignal(signal);
        await sendPreAlertNotification(signal);
      }
      
      // Monitora TP/SL sui segnali attivi
      for (const signal of existingSignals) {
        if (signal.status !== 'ACTIVE' && signal.status !== 'TRIGGERED') continue;
        const md = marketData.find(m => m.asset === signal.asset);
        if (!md) continue;
        
        let closed = false;
        if ((signal.direction === 'BUY' && md.currentPrice <= signal.stopLoss) ||
            (signal.direction === 'SELL' && md.currentPrice >= signal.stopLoss)) {
          signal.status = 'CLOSED_SL';
          signal.closedAt = new Date().toISOString();
          signal.realizedPnL = -signal.maxLoss;
          await updateSignalStatus(signal.id, 'CLOSED_SL', signal.realizedPnL);
          // sendExitNotification(signal, type, currentPrice)
          await sendExitNotification(signal, 'SL', md.currentPrice);
          closed = true;
        } else if ((signal.direction === 'BUY' && md.currentPrice >= signal.takeProfit) ||
                   (signal.direction === 'SELL' && md.currentPrice <= signal.takeProfit)) {
          signal.status = 'CLOSED_TP';
          signal.closedAt = new Date().toISOString();
          signal.realizedPnL = signal.expectedPnL;
          await updateSignalStatus(signal.id, 'CLOSED_TP', signal.realizedPnL);
          await sendExitNotification(signal, 'TP', md.currentPrice);
          closed = true;
        }
        
        if (closed) {
          log = scanEngine.updateDayLog(log, signal);
        }
      }
      
      await saveTodayLog(log);

      // Attiva cooldown se budget giornaliero bruciato
      if (log.realizedPnL <= -scanConfig.dailyRiskBudget) {
        const until = new Date();
        until.setHours(until.getHours() + 48);
        // setTbdCooldownUntil richiede kvSet callback da tbd-storage
        await setTbdCooldownUntil(kvSet, until.toISOString());
      }

      return NextResponse.json({
        success: true, circuitBreaker: false,
        antigravityStatus: agState.status,
        tbdCapitalToday: effectiveTbdCapital,
        scannedAssets: marketData.length,
        newSignals: valid.length,
        pendingSignals: pending.length,
        activeSignals: existingSignals.filter(s => ['ACTIVE','TRIGGERED'].includes(s.status)).length,
        signals: valid.map(s => ({
          asset: s.asset, direction: s.direction,
          expectedPnL: s.expectedPnL, qualityScore: s.qualityScore, riskReward: s.riskReward,
        })),
      });

    } finally {
      await releaseDayLock(dateKey);
    }

  } catch (err: any) {
    console.error('[TBD Scan Error]', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal error' },
      { status: 500 }
    );
  }
}
