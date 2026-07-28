/**
 * app/api/tbd/status/route.ts
 * Stato live del TBD Hunter per la UI
 */

import { NextResponse } from 'next/server';
import { getTodayLog, getActiveSignals, kvGet } from '@/lib/tbd-storage';
import { getTbdCooldownUntil } from '@/lib/antigravity-engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const log = await getTodayLog();
    const signals = await getActiveSignals();
    const cooldown = await getTbdCooldownUntil(kvGet);

    const activeSignals = signals.filter((s: any) =>
      ['PRE_ALERT', 'ACTIVE', 'TRIGGERED'].includes(s.status)
    );

    const recentLosses = (log?.signals || []).slice(-2);
    const streakLoss = recentLosses.length >= 2 && recentLosses.every((s: any) => (s.realizedPnL ?? 0) < 0)
      ? 2
      : recentLosses.filter((s: any) => (s.realizedPnL ?? 0) < 0).length;

    const nextHour = new Date();
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);

    return NextResponse.json({
      success: true,
      riskBudget: 100,
      riskBudgetUsed: Math.abs(log?.realizedPnL || 0),
      riskBudgetRemaining: Math.max(0, 100 - Math.abs(log?.realizedPnL || 0)),
      tradesToday: log?.totalTrades || 0,
      maxTrades: 3,
      streakLoss,
      nextScan: nextHour.toISOString(),
      active: !cooldown || new Date() > new Date(cooldown),
      inCooldown: !!cooldown && new Date() < new Date(cooldown),
      cooldownUntil: cooldown,
      activeSignalsCount: activeSignals.length,
      antigravityStatus: 'NORMAL', // calcolato da route(5) al prossimo scan
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
