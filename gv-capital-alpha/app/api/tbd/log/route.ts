/**
 * GET  /api/tbd/log  — Restituisce log oggi + ultimi 30 giorni
 * POST /api/tbd/log  — Crea/aggiorna il log del giorno (es. dopo trade chiuso)
 */

import { NextResponse } from 'next/server';
import { TradingByDayEngine } from '@/lib/trading-by-day';
import {
  getTodayLog, saveTodayLog, getLast30DaysLogs,
  getTbdConfig, getActiveSignals, todayKey,
} from '@/lib/tbd-storage';

export const runtime = 'edge';

export async function GET() {
  try {
    const [todayLog, history, activeSignals, config] = await Promise.all([
      getTodayLog(),
      getLast30DaysLogs(),
      getActiveSignals(),
      getTbdConfig(),
    ]);

    const engine  = new TradingByDayEngine(config);
    const pnl     = todayLog?.realizedPnL ?? 0;
    const breaker = engine.evaluateDailyCircuitBreaker(pnl);

    return NextResponse.json({
      success: true,
      data: {
        today:         todayLog,
        history,
        activeSignals,
        circuitBreaker: {
          stopTrading: breaker.stopTrading,
          reason:      breaker.reason,
          message:     breaker.message,
        },
        config,
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let config = await getTbdConfig();

    // Aggiorna config se totalCapital e' inviato
    if (typeof body.totalCapital === 'number') {
      await saveTbdConfig({ totalCapital: body.totalCapital });
      config = await getTbdConfig();
    }

    const engine = new TradingByDayEngine(config);
    let log = await getTodayLog();

    // Inizializza log se non esiste
    if (!log) {
      log = engine.createEmptyDayLog(todayKey());
    } else if (typeof body.totalCapital === 'number') {
      // Aggiorna il capitale iniziale del log odierno se modificato
      log.startingCash = config.totalCapital;
      log.endingCash = config.totalCapital + log.realizedPnL;
    }

    // Aggiorna manuale P&L (es. operatore chiude un trade su eToro)
    if (typeof body.realizedPnL === 'number') {
      log.realizedPnL   = body.realizedPnL;
      log.endingCash    = config.totalCapital + body.realizedPnL;
      log.totalTrades   = body.totalTrades ?? log.totalTrades;
      log.winningTrades = body.winningTrades ?? log.winningTrades;
      log.targetReached = log.realizedPnL >= config.dailyTarget;
      log.status        = log.targetReached
        ? 'COMPLETED_PROFIT'
        : log.realizedPnL <= -(config.totalCapital * config.maxTotalRiskPercent / 100)
          ? 'COMPLETED_LOSS'
          : 'ACTIVE';
    }

    await saveTodayLog(log);

    return NextResponse.json({ success: true, data: log, config });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
