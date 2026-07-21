import { NextResponse } from 'next/server';
import { getPortfolio, updatePortfolio } from '@/lib/storage';
import { AntigravityEngine, DEFAULT_ANTIGRAVITY_CONFIG } from '@/lib/antigravity-engine';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, newLeverage, targetCorePct, targetTbdPct } = body;

    const portfolio = await getPortfolio();
    if (!portfolio) {
      return NextResponse.json({ success: false, error: 'Portfolio not found' }, { status: 404 });
    }

    // Calcola rebalance
    const engine = new AntigravityEngine(DEFAULT_ANTIGRAVITY_CONFIG);
    const simulation = engine.simulateRebalancing(
      portfolio.totalValue,
      newLeverage,
      portfolio.capitalAvailable, // Approssimazione Core
      portfolio.positions
        .filter(p => p.status === 'OPEN')
        .reduce((sum, p) => sum + p.capitalAllocated, 0), // TBD
      { action, newLeverage, coreTargetPct: targetCorePct, tbdTargetPct: targetTbdPct, reason: '', urgency: 'LOW', estimatedPnLImpact: 0 }
    );

    // TODO: Applicare il rebalancing effettivo al portfolio
    // Per ora, ritorna la simulazione

    return NextResponse.json({
      success: true,
      simulation,
      message: `Rebalance simulato: ${action} → ${newLeverage.toFixed(2)}x`,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
