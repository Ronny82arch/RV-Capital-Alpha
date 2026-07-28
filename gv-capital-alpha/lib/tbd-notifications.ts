/**
 * lib/tbd-notifications.ts — Wrapper notifiche push per TBD Hunter Mode
 */

import { sendPushToAllSubscriptions } from './push';
import { TbdSignal } from './trading-by-day';

export async function sendPreAlertNotification(signal: TbdSignal): Promise<void> {
  await sendPushToAllSubscriptions({
    title: `🎯 TBD Pre-Alert: ${signal.asset}`,
    body: `${signal.direction} @ ${signal.entryPrice.toFixed(2)}€ | R/R ${signal.riskReward} | Quality ${signal.qualityScore}/100`,
    data: {
      type: 'tbd_pre_alert',
      signalId: signal.id,
      asset: signal.asset,
      direction: signal.direction,
      entryPrice: signal.entryPrice,
      qualityScore: signal.qualityScore,
    },
  });
}

export async function sendSignalTriggeredNotification(signal: TbdSignal, fillPrice: number): Promise<void> {
  await sendPushToAllSubscriptions({
    title: `⚡ TBD Triggered: ${signal.asset}`,
    body: `${signal.direction} eseguito @ ${fillPrice.toFixed(2)}€ | Size: ${signal.allocatedSize.toFixed(0)}€`,
    data: {
      type: 'tbd_triggered',
      signalId: signal.id,
      asset: signal.asset,
      fillPrice,
    },
  });
}

export async function sendExitNotification(
  signal: TbdSignal,
  arg2: number | 'TAKE_PROFIT' | 'STOP_LOSS' | 'TP' | 'SL',
  arg3: number | 'TAKE_PROFIT' | 'STOP_LOSS' | 'TP' | 'SL'
): Promise<void> {
  let exitPrice = 0;
  let reason: 'TAKE_PROFIT' | 'STOP_LOSS' = 'TAKE_PROFIT';

  if (typeof arg2 === 'number') {
    exitPrice = arg2;
  } else {
    reason = (arg2 === 'SL' || arg2 === 'STOP_LOSS') ? 'STOP_LOSS' : 'TAKE_PROFIT';
  }

  if (typeof arg3 === 'number') {
    exitPrice = arg3;
  } else {
    reason = (arg3 === 'SL' || arg3 === 'STOP_LOSS') ? 'STOP_LOSS' : 'TAKE_PROFIT';
  }

  const pnl = signal.realizedPnL ?? 0;
  const isWin = pnl >= 0;
  await sendPushToAllSubscriptions({
    title: `${isWin ? '🟢' : '🔴'} TBD ${reason === 'TAKE_PROFIT' ? 'TP' : 'SL'}: ${signal.asset}`,
    body: `${signal.direction} chiuso @ ${exitPrice.toFixed(2)}€ | P&L: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}€`,
    data: {
      type: 'tbd_exit',
      signalId: signal.id,
      asset: signal.asset,
      reason,
      pnl,
    },
  });
}

export async function sendCircuitBreakerNotification(message: string, reason?: string): Promise<void> {
  await sendPushToAllSubscriptions({
    title: `🛑 TBD Circuit Breaker${reason && reason !== 'NONE' ? `: ${reason}` : ''}`,
    body: message,
    data: { type: 'tbd_circuit_breaker', reason },
  });
}

export async function sendAntigravityBoostNotification(
  qualityScore: number,
  extraCapital: number
): Promise<void> {
  await sendPushToAllSubscriptions({
    title: '🚀 Antigravity Boost Attivato',
    body: `Quality ${qualityScore.toFixed(0)}/100 → +${extraCapital.toFixed(0)}€ allocati al TBD`,
    data: { type: 'antigravity_boost', qualityScore, extraCapital },
  });
}
