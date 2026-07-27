/**
 * GET  /api/tbd/log  — Restituisce log oggi + ultimi 30 giorni
 * POST /api/tbd/log  — Crea/aggiorna il log del giorno (es. dopo trade chiuso)
 */

import { NextResponse } from 'next/server';
import { TradingByDayEngine } from '@/lib/trading-by-day';
import {
  getTodayLog, saveTodayLog, getLast30DaysLogs,
  getTbdConfig, getActiveSignals, todayKey, saveTbdConfig
} from '@/lib/tbd-storage';



export async function GET() {
  try {
    const [todayLog, history, activeSignals, config] = await Promise.all([
      getTodayLog(),
      getLast30DaysLogs(),
      getActiveSignals(),
      getTbdConfig(),
    ]);

    const engine  = new TradingByDayEngine(config);
    let logToEvaluate = todayLog;
    if (!logToEvaluate) {
        logToEvaluate = engine.createEmptyDayLog(todayKey());
    }
    const breaker = engine.evaluateDailyCircuitBreaker(logToEvaluate);

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

    // Aggiorna config se totalCapital o dailyRiskBudget sono inviati
    const configUpdates: any = {};
    if (typeof body.totalCapital === 'number') configUpdates.totalCapital = body.totalCapital;
    if (typeof body.dailyRiskBudget === 'number') configUpdates.dailyRiskBudget = body.dailyRiskBudget;
    
    if (Object.keys(configUpdates).length > 0) {
      await saveTbdConfig(configUpdates);
      config = await getTbdConfig();
    }

    const engine = new TradingByDayEngine(config);
    let log = await getTodayLog();

    // Inizializza log se non esiste
    if (!log) {
      log = engine.createEmptyDayLog(todayKey());
    } else {
      if (typeof body.totalCapital === 'number') {
        log.startingCash = config.totalCapital;
        log.endingCash = config.totalCapital + log.realizedPnL;
      }
    }

    // Aggiorna manuale P&L (es. operatore chiude un trade su eToro)
    if (typeof body.realizedPnL === 'number') {
      log.realizedPnL   = body.realizedPnL;
      log.endingCash    = config.totalCapital + body.realizedPnL;
      log.totalTrades   = body.totalTrades ?? log.totalTrades;
      log.winningTrades = body.winningTrades ?? log.winningTrades;
      
      const breaker = engine.evaluateDailyCircuitBreaker(log);
      log.targetReached = breaker.reason === 'PROFIT_CAP';
      
      if (breaker.reason === 'PROFIT_CAP') {
          log.status = 'COMPLETED_PROFIT';
      } else if (breaker.reason === 'BUDGET' || breaker.reason === 'STREAK') {
          log.status = 'COMPLETED_LOSS';
      } else if (breaker.reason === 'MAX_TRADES') {
          log.status = 'COMPLETED_PROFIT'; 
      } else {
          log.status = 'ACTIVE';
      }
    }

    await saveTodayLog(log);

    return NextResponse.json({ success: true, data: log, config });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
