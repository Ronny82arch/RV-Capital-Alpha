import { Signal, Position } from '@/types';
import { addAlert } from './storage';

// ─── SIGNAL NOTIFICATION ──────────────────────────────────────────────────────
export async function notifyNewSignal(signal: Signal, appUrl: string): Promise<boolean> {
  const urgencyEmoji = signal.urgency === 'HIGH' ? '🔴' : signal.urgency === 'MEDIUM' ? '🟡' : '🟢';
  const typeEmoji = signal.type === 'CRYPTO' ? '₿' : signal.type === 'ETF' ? '📊' : '📈';

  const message = `${urgencyEmoji} SEGNALE ALPHA — ACQUISTO\n\n${typeEmoji} ${signal.name} (${signal.symbol})\n💰 Prezzo suggerito: €${signal.suggestedPrice.toFixed(2)}\n📦 Quantità: ${signal.quantity} ${signal.type === 'CRYPTO' ? 'unità' : 'quote'}\n💼 Capitale: €${signal.capitalToAllocate.toFixed(0)}\n\n🛡️ Stop Loss: €${signal.stopLoss.toFixed(2)} (-${signal.stopLossPercent.toFixed(1)}%)\n🎯 Take Profit: €${signal.takeProfit.toFixed(2)} (+${signal.takeProfitPercent.toFixed(1)}%)\n⚖️ Reward/Risk: ${(signal.takeProfitPercent / signal.stopLossPercent).toFixed(1)}:1\n\n📊 Tecnici: RSI ${signal.technicals.rsi} · Momentum ${(signal.technicals.momentum * 100).toFixed(1)}% · ${signal.technicals.trend}\n🧮 Win Probability: ${(signal.winProbability * 100).toFixed(0)}% · Kelly: ${(signal.kellyFraction * 100).toFixed(1)}%\n\n💡 ${signal.strategy}\n${signal.reasoning}\n\n⚡ Urgenza: ${signal.urgency}\n\n👉 Apri eToro demo, acquista ${signal.quantity} ${signal.symbol} poi conferma nell'app.`;

  await addAlert({
    title: `Nuovo Segnale: ${signal.symbol}`,
    message,
    type: 'INFO'
  });
  return true;
}

// ─── POSITION ALERT ───────────────────────────────────────────────────────────
export async function notifyStopLossAlert(position: Position, currentPrice: number): Promise<boolean> {
  const distancePct = ((currentPrice - position.stopLoss) / position.entryPrice) * 100;

  const message = `⚠️ ATTENZIONE — STOP LOSS VICINO\n\n📉 ${position.name} (${position.symbol})\nPrezzo attuale: €${currentPrice.toFixed(2)}\nStop Loss: €${position.stopLoss.toFixed(2)}\nDistanza: ${distancePct.toFixed(1)}%\n\nP&L non realizzato: ${(position.unrealizedPnl ?? 0) >= 0 ? '+' : ''}€${(position.unrealizedPnl ?? 0).toFixed(2)}\n\n📋 Valuta se chiudere la posizione su eToro.`;

  await addAlert({
    title: `Allarme Stop Loss: ${position.symbol}`,
    message,
    type: 'WARNING'
  });
  return true;
}

export async function notifyTakeProfitAlert(position: Position, currentPrice: number): Promise<boolean> {
  const gainPct = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

  const message = `🎯 TAKE PROFIT RAGGIUNTO!\n\n📈 ${position.name} (${position.symbol})\nPrezzo attuale: €${currentPrice.toFixed(2)}\nTake Profit: €${position.takeProfit.toFixed(2)}\nGuadagno: +${gainPct.toFixed(1)}%\n\n💰 P&L: +€${(position.unrealizedPnl ?? 0).toFixed(2)}\n\n✅ Considera di chiudere la posizione su eToro per realizzare il guadagno.`;

  await addAlert({
    title: `Take Profit: ${position.symbol}`,
    message,
    type: 'SUCCESS'
  });
  return true;
}

export async function notifyDailySummary(
  totalValue: number,
  totalPnL: number,
  totalPnLPercent: number,
  targetPercent: number,
  openPositions: number
): Promise<boolean> {
  const onTrack = totalPnLPercent >= 0;
  const emoji = onTrack ? '✅' : '📉';

  const message = `${emoji} RIEPILOGO GIORNALIERO\n\n💼 Valore portafoglio: €${totalValue.toFixed(0)}\n${totalPnL >= 0 ? '📈' : '📉'} P&L: ${totalPnL >= 0 ? '+' : ''}€${totalPnL.toFixed(0)} (${totalPnLPercent >= 0 ? '+' : ''}${totalPnLPercent.toFixed(2)}%)\n🎯 Target annuo: +${(targetPercent * 100).toFixed(0)}%\n📊 Posizioni aperte: ${openPositions}\n\n${onTrack ? '🟢 In linea con il target' : '🔴 Sotto il target — modalità aggressiva attivata'}`;

  await addAlert({
    title: `Riepilogo Giornaliero Portfolio`,
    message,
    type: onTrack ? 'INFO' : 'WARNING'
  });
  return true;
}
