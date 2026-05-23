import { Signal, Position } from '@/types';

const TELEGRAM_API = 'https://api.telegram.org';

async function sendMessage(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log('[Telegram] Not configured — message skipped:', text.slice(0, 80));
    return false;
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── SIGNAL NOTIFICATION ──────────────────────────────────────────────────────
export async function notifyNewSignal(signal: Signal, appUrl: string): Promise<boolean> {
  const urgencyEmoji = signal.urgency === 'HIGH' ? '🔴' : signal.urgency === 'MEDIUM' ? '🟡' : '🟢';
  const typeEmoji = signal.type === 'CRYPTO' ? '₿' : signal.type === 'ETF' ? '📊' : '📈';

  const text = `
${urgencyEmoji} <b>SEGNALE ALPHA — ACQUISTO</b>

${typeEmoji} <b>${signal.name} (${signal.symbol})</b>
💰 Prezzo suggerito: €${signal.suggestedPrice.toFixed(2)}
📦 Quantità: ${signal.quantity} ${signal.type === 'CRYPTO' ? 'unità' : 'quote'}
💼 Capitale: €${signal.capitalToAllocate.toFixed(0)}

🛡️ Stop Loss: €${signal.stopLoss.toFixed(2)} <i>(-${signal.stopLossPercent.toFixed(1)}%)</i>
🎯 Take Profit: €${signal.takeProfit.toFixed(2)} <i>(+${signal.takeProfitPercent.toFixed(1)}%)</i>
⚖️ Reward/Risk: ${(signal.takeProfitPercent / signal.stopLossPercent).toFixed(1)}:1

📊 <b>Tecnici:</b> RSI ${signal.technicals.rsi} · Momentum ${(signal.technicals.momentum * 100).toFixed(1)}% · ${signal.technicals.trend}
🧮 Win Probability: ${(signal.winProbability * 100).toFixed(0)}% · Kelly: ${(signal.kellyFraction * 100).toFixed(1)}%

💡 <b>${signal.strategy}</b>
${signal.reasoning}

⚡ Urgenza: <b>${signal.urgency}</b>

👉 <b>Apri eToro demo, acquista ${signal.quantity} ${signal.symbol} poi torna sull'app per confermare.</b>
🔗 <a href="${appUrl}">Apri RV Capital Alpha</a>`.trim();

  return sendMessage(text);
}

// ─── POSITION ALERT ───────────────────────────────────────────────────────────
export async function notifyStopLossAlert(position: Position, currentPrice: number): Promise<boolean> {
  const distancePct = ((currentPrice - position.stopLoss) / position.entryPrice) * 100;

  const text = `
⚠️ <b>ATTENZIONE — STOP LOSS VICINO</b>

📉 <b>${position.name} (${position.symbol})</b>
Prezzo attuale: €${currentPrice.toFixed(2)}
Stop Loss: €${position.stopLoss.toFixed(2)}
Distanza: ${distancePct.toFixed(1)}%

P&L non realizzato: ${(position.unrealizedPnl ?? 0) >= 0 ? '+' : ''}€${(position.unrealizedPnl ?? 0).toFixed(2)}

📋 Valuta se chiudere la posizione su eToro.`.trim();

  return sendMessage(text);
}

export async function notifyTakeProfitAlert(position: Position, currentPrice: number): Promise<boolean> {
  const gainPct = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

  const text = `
🎯 <b>TAKE PROFIT RAGGIUNTO!</b>

📈 <b>${position.name} (${position.symbol})</b>
Prezzo attuale: €${currentPrice.toFixed(2)}
Take Profit: €${position.takeProfit.toFixed(2)}
Guadagno: +${gainPct.toFixed(1)}%

💰 P&L: +€${(position.unrealizedPnl ?? 0).toFixed(2)}

✅ <b>Considera di chiudere la posizione su eToro per realizzare il guadagno.</b>`.trim();

  return sendMessage(text);
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

  const text = `
${emoji} <b>RIEPILOGO GIORNALIERO — RV CAPITAL ALPHA</b>

💼 Valore portafoglio: €${totalValue.toFixed(0)}
${totalPnL >= 0 ? '📈' : '📉'} P&L: ${totalPnL >= 0 ? '+' : ''}€${totalPnL.toFixed(0)} (${totalPnLPercent >= 0 ? '+' : ''}${totalPnLPercent.toFixed(2)}%)
🎯 Target annuo: +${(targetPercent * 100).toFixed(0)}%
📊 Posizioni aperte: ${openPositions}

${onTrack ? '🟢 In linea con il target' : '🔴 Sotto il target — modalità aggressiva attivata'}`.trim();

  return sendMessage(text);
}
