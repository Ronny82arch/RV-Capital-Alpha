// app/api/tbd/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { TBDEngine, DEFAULT_TBD_CONFIG } from '@/lib/tbd-engine';
import { getPortfolio, mutatePortfolio } from '@/lib/storage';
import { getTodayLog, kvGet } from '@/lib/tbd-storage';
import { getTbdCooldownUntil, AntigravityEngine } from '@/lib/antigravity-engine';

// ─── HELPERS DB ─────────────────────────────────────────────────────────────

async function getPortfolioFromDB() {
  return await getPortfolio();
}

async function getTodayTradesCount(): Promise<number> {
  const log = await getTodayLog();
  return log?.totalTrades || 0;
}

async function getTodayPnL(): Promise<number> {
  const log = await getTodayLog();
  return log?.realizedPnL || 0;
}

async function getAntigravityState(portfolio: any) {
  const agEngine = new AntigravityEngine();
  const peakValue = Math.max(
    portfolio.totalValue || 0,
    ...(portfolio.performanceHistory || []).map((p: { totalValue: number }) => p.totalValue)
  );
  const cooldown = await getTbdCooldownUntil(kvGet);
  return agEngine.calculateState(portfolio.totalValue || 0, peakValue, 0, cooldown);
}

async function saveTBDSignals(signals: any[]) {
  await mutatePortfolio(p => {
    // Evita duplicati
    const existingIds = new Set(p.signals.map(s => s.id));
    const newSignals = signals.filter(s => !existingIds.has(s.id));
    p.signals.push(...newSignals);
  });
  console.log('[TBD] Salvati', signals.length, 'segnali');
}

// ─── HANDLER PRINCIPALE ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { portfolioId, force = false } = body;

    // 1. Recupera dati
    const portfolio = await getPortfolioFromDB();
    if (!portfolio) {
      return NextResponse.json(
        { success: false, error: 'Portfolio non trovato.' },
        { status: 404 }
      );
    }

    const tradesToday = await getTodayTradesCount();
    const pnlToday = await getTodayPnL();
    const agState = await getAntigravityState(portfolio);

    // 2. Calcola return giornaliero corrente (se force è true, forza gap simulato per testing/manual generation)
    const today = new Date().toISOString().split('T')[0];
    const todayPerf = portfolio.performanceHistory?.find(
      (p: any) => p.date?.startsWith(today)
    );
    const currentDayReturn = force ? 0.0001 : (todayPerf?.pnlPercent ? todayPerf.pnlPercent / 100 : 0);

    // 3. Calcola drawdown
    const peakValue = Math.max(
      portfolio.totalValue || 0,
      ...(portfolio.performanceHistory?.map((p: any) => p.totalValue) || [])
    );
    const currentDrawdown = force ? 0 : (peakValue > 0
      ? ((peakValue - (portfolio.totalValue || 0)) / peakValue) * 100
      : 0);

    const agStatus = force ? 'NORMAL' : agState.status;

    // 4. Istanzia motore e genera
    const engine = new TBDEngine(DEFAULT_TBD_CONFIG);
    const plan = engine.buildPlan(
      portfolio.totalValue || 0,
      currentDayReturn,
      currentDrawdown,
      tradesToday,
      pnlToday,
      agStatus,
      portfolio.positions || [],
    );

    // 5. Se ci sono segnali, salvali
    if (plan.signals.length > 0) {
      const dbSignals = plan.signals.map((s: any) => ({
        id: s.id,
        symbol: s.symbol,
        name: s.name,
        type: 'STOCK',
        action: s.action,
        suggestedPrice: s.entryPrice,
        entryPrice: s.entryPrice,
        stopLoss: s.stopLoss,
        takeProfit: s.takeProfit,
        stopLossPercent: ((s.entryPrice - s.stopLoss) / s.entryPrice) * 100,
        takeProfitPercent: ((s.takeProfit - s.entryPrice) / s.entryPrice) * 100,
        kellyFraction: s.kellyFraction,
        winProbability: s.winProbability,
        winProbabilitySampleSize: 100,
        winProbabilityTrusted: true,
        expectedReturn: (s.expectedValue / s.capitalAllocated) * 100,
        reasoning: s.reason,
        strategy: 'TBD Hunter Engine',
        urgency: s.urgency === 'IMMEDIATE' ? 'HIGH' : 'MEDIUM',
        technicals: {
          rsi: 50,
          momentum: 0,
          sma20: s.entryPrice,
          sma50: s.entryPrice,
          trend: 'BULLISH',
        },
        capitalToAllocate: s.capitalAllocated,
        quantity: s.quantity,
        createdAt: s.generatedAt,
        status: 'PENDING',
        portfolio: 'TBD',
        tags: ['TBD_GENERATED', s.timeframe, s.urgency],
      }));
      await saveTBDSignals(dbSignals);
    }

    // 6. Risposta
    return NextResponse.json({
      success: true,
      plan,
      message: plan.signals.length > 0
        ? `🎯 ${plan.signals.length} segnali TBD generati | Gap: ${(plan.summary.gapToTarget * 100).toFixed(3)}% | Circuit: ${plan.state.circuitBreaker}`
        : `⛔ Circuit breaker: ${plan.state.circuitBreakerReason || 'Nessun gap da colmare'}`,
    });
  } catch (error: any) {
    console.error('[API /tbd/generate] Errore:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Errore generazione segnali TBD.',
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
