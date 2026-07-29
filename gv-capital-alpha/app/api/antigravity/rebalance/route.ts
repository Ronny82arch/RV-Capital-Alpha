// app/api/antigravity/rebalance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AntigravityEngine, DEFAULT_ANTIGRAVITY_CONFIG, setTbdCooldownUntil } from '@/lib/antigravity-engine';
import { getPortfolio, mutatePortfolio, addAlert } from '@/lib/storage';
import { kvSet } from '@/lib/tbd-storage';

// ─── HELPERS DB ─────────────────────────────────────────────────────────────

async function getPortfolioFromDB() {
  return await getPortfolio();
}

async function saveAntigravityState(
  portfolioId: string,
  state: {
    status: string;
    currentDrawdownPct: number;
    peakValue: number;
    currentValue: number;
    tbdInCooldown: boolean;
    cooldownUntil: string | null;
    coreTargetPct: number;
    satelliteTargetPct: number;
    tbdTargetPct: number;
    actionRequired: string;
    timestamp: string;
  }
) {
  // Salva il target core % e la leva nel portafoglio
  await mutatePortfolio(p => {
    p.coreSatelliteTarget = state.coreTargetPct;
    p.antigravityTargetLeverage = state.status === 'EXPANDED'
      ? DEFAULT_ANTIGRAVITY_CONFIG.expandedLeverage
      : DEFAULT_ANTIGRAVITY_CONFIG.targetLeverage;
  });

  // Salva eventuale cooldown in KV / Storage
  if (state.cooldownUntil) {
    await setTbdCooldownUntil(kvSet, state.cooldownUntil);
  }
}

// ─── HANDLER PRINCIPALE ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1. Recupera il portfolio dal database/storage
    const portfolio = await getPortfolioFromDB();

    if (!portfolio) {
      return NextResponse.json(
        {
          success: false,
          error: 'Portfolio non trovato nel database.',
        },
        { status: 404 }
      );
    }

    // 2. Calcola il valore di picco (peak) dalla history o dal valore corrente
    const historyValues = (portfolio.performanceHistory || [])
      .map((p: any) => Number(p.totalValue))
      .filter((v: number) => !isNaN(v) && v > 0);

    const currentValue = Number(portfolio.totalValue) || 0;
    const peakValue = Math.max(currentValue, ...historyValues);

    // 3. PnL realizzato TBD (se presente nel portfolio)
    const tbdRealizedPnL = Number((portfolio as any).tbdRealizedPnL) || 0;

    // 4. Cooldown pre-esistente
    const lastCooldownUntil = (portfolio as any).antigravityCooldownUntil || null;

    // 5. Istanzia il motore e calcola
    const engine = new AntigravityEngine(DEFAULT_ANTIGRAVITY_CONFIG);
    const state = engine.calculateState(
      currentValue,
      peakValue,
      tbdRealizedPnL,
      lastCooldownUntil
    );

    // 6. Persiste il nuovo stato
    await saveAntigravityState(portfolio.id || 'default', state);

    // Formattazione avviso/notifica
    const formattedStatus = engine.formatStatus(state);
    const allocations = engine.calculateAbsoluteAllocation(currentValue, state);
    const actionText = `Core: €${allocations.coreValue.toFixed(0)} (${state.coreTargetPct}%)\nSatellite: €${allocations.satelliteValue.toFixed(0)} (${state.satelliteTargetPct}%)\nTBD: €${allocations.tbdValue.toFixed(0)} (${state.tbdTargetPct}%)`;

    await addAlert({
      title: `${formattedStatus.emoji} Rebalance Antigravity: ${formattedStatus.title}`,
      message: `${state.actionRequired}\n\nNuovi target:\n${actionText}\n\nEsegui manualmente le transazioni su eToro.`,
      type: 'INFO',
    });

    // 7. Risposta al frontend
    return NextResponse.json({
      success: true,
      state,
      allocations,
      actionRequired: state.actionRequired,
      message: `Stato Antigravity: ${state.status} | Drawdown: ${state.currentDrawdownPct.toFixed(2)}%`,
    });
  } catch (error: any) {
    console.error('[API /antigravity/rebalance] Errore:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Errore interno durante il calcolo del rebalance Antigravity.',
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
