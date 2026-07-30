// app/api/tbd/plan/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { TBDEngine, DEFAULT_TBD_CONFIG } from '@/lib/tbd-engine';
import { getPortfolio } from '@/lib/storage';
import { getTbdCooldownUntil } from '@/lib/antigravity-engine';
import { kvGet } from '@/lib/tbd-storage';

export async function POST(req: NextRequest) {
  try {
    const portfolio = await getPortfolio();
    if (!portfolio) {
      return NextResponse.json({ success: false, error: 'Portfolio non trovato.' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const currentDayReturn = typeof body.currentDayReturn === 'number' ? body.currentDayReturn : (portfolio.totalPnLPercent || 0) / 100;
    const currentDrawdownPct = typeof body.currentDrawdownPct === 'number' ? body.currentDrawdownPct : 0;
    const tradesToday = typeof body.tradesToday === 'number' ? body.tradesToday : 0;
    const pnlToday = typeof body.pnlToday === 'number' ? body.pnlToday : (portfolio.tbdRealizedPnL || 0);
    const agStatus = body.agStatus || (currentDrawdownPct > 5 ? 'PROTECTION' : 'NORMAL');

    const engine = new TBDEngine(DEFAULT_TBD_CONFIG);
    const plan = engine.buildPlan(
      portfolio.totalValue || 10000,
      currentDayReturn,
      currentDrawdownPct,
      tradesToday,
      pnlToday,
      agStatus,
      portfolio.positions || []
    );

    return NextResponse.json({
      success: true,
      plan,
      message: `Generato piano TBD: ${plan.signals.length} segnali | Target giornaliero: ${(plan.summary.targetDaily * 100).toFixed(3)}% | Gap: ${(plan.summary.gapToTarget * 100).toFixed(3)}%`,
    });
  } catch (error: any) {
    console.error('[API /tbd/plan] Errore:', error);
    return NextResponse.json(
      { success: false, error: 'Errore durante la generazione del piano TBD.', details: error?.message },
      { status: 500 }
    );
  }
}
