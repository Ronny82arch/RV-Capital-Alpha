import { NextResponse } from 'next/server';
import { getPortfolio, mutatePortfolio, addAlert } from '@/lib/storage';
import { AntigravityEngine, DEFAULT_ANTIGRAVITY_CONFIG, getTbdCooldownUntil } from '@/lib/antigravity-engine';
import { getActiveSignals, kvGet } from '@/lib/tbd-storage';

export async function POST(request: Request) {
  try {
    const portfolio = await getPortfolio();
    if (!portfolio) return NextResponse.json({ success: false, error: 'Portfolio not found' }, { status: 404 });

    const tbdActive = await getActiveSignals();
    const avgQuality = tbdActive.length > 0
      ? tbdActive.reduce((s, sig) => s + ((sig as any).probability || (sig as any).qualityScore || 0), 0) / tbdActive.length
      : 0;

    const cooldown = await getTbdCooldownUntil(kvGet);
    const peakValue = Math.max(portfolio.totalValue, ...(portfolio.performanceHistory?.map(p => p.totalValue) || []));

    const engine = new AntigravityEngine(DEFAULT_ANTIGRAVITY_CONFIG);
    const state = engine.calculateState(portfolio.totalValue, peakValue, avgQuality, cooldown);
    const allocations = engine.calculateAbsoluteAllocation(portfolio.totalValue, state);
    const formattedStatus = engine.formatStatus(state);

    // Salva il target core % come referenza
    await mutatePortfolio(p => {
      p.coreSatelliteTarget = state.coreTargetPct; 
    });

    const actionText = `Core: €${allocations.coreValue.toFixed(0)} (${state.coreTargetPct}%)\nSatellite: €${allocations.satelliteValue.toFixed(0)} (${state.satelliteTargetPct}%)\nTBD: €${allocations.tbdValue.toFixed(0)} (${state.tbdTargetPct}%)`;

    await addAlert({
      title: `${formattedStatus.emoji} Rebalance Antigravity: ${formattedStatus.title}`,
      message: `${state.actionRequired}\n\nNuovi target:\n${actionText}\n\nEsegui manualmente le transazioni su eToro.`,
      type: 'INFO',
    });

    return NextResponse.json({
      success: true,
      state,
      allocations,
      actionRequired: actionText,
      message: `Target aggiornati a ${formattedStatus.title}. Controlla le notifiche.`,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

