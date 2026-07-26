import { NextResponse } from 'next/server';
import { getPortfolio, mutatePortfolio, addAlert } from '@/lib/storage';
import { AntigravityEngine, DEFAULT_ANTIGRAVITY_CONFIG } from '@/lib/antigravity-engine';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, newLeverage } = body;

    const portfolio = await getPortfolio();
    if (!portfolio) return NextResponse.json({ success: false, error: 'Portfolio not found' }, { status: 404 });

    const engine = new AntigravityEngine({ ...DEFAULT_ANTIGRAVITY_CONFIG, targetLeverage: newLeverage });
    const deployedCapital = portfolio.positions.filter(p => p.status === 'OPEN').reduce((sum, p) => sum + p.capitalAllocated, 0);
    const simulation = engine.stressTestMarketShock(portfolio.totalValue, newLeverage, deployedCapital, -10);

    // ✅ FIX: applica per davvero — persiste il nuovo target
    await mutatePortfolio(p => {
      (p as any).antigravityTargetLeverage = newLeverage;
    });

    // ✅ FIX: calcola quanto capitale muovere per raggiungere il target e notifica cosa fare su eToro
    const targetDeployed = portfolio.totalValue * newLeverage;
    const delta = targetDeployed - deployedCapital;
    const actionText = delta > 0
      ? `Aumenta l'esposizione di circa €${delta.toFixed(0)} (apri nuove posizioni)`
      : `Riduci l'esposizione di circa €${Math.abs(delta).toFixed(0)} (chiudi/riduci posizioni)`;

    await addAlert({
      title: `⚖️ Rebalance Antigravity applicato: ${newLeverage.toFixed(2)}x`,
      message: `Nuovo target di leva impostato a ${newLeverage.toFixed(2)}x.\n${actionText}\nEsegui manualmente su eToro, poi conferma in app.`,
      type: 'INFO',
    });

    return NextResponse.json({
      success: true,
      applied: true, // ✅ non più "simulationOnly"
      simulation,
      actionRequired: actionText,
      message: `Target di leva aggiornato a ${newLeverage.toFixed(2)}x. Controlla le notifiche per l'azione da eseguire su eToro.`,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
