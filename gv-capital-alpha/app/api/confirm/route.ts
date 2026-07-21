import { NextRequest, NextResponse } from 'next/server';
import {
  getPortfolio,
  updateSignalStatus,
  openPosition,
  closePosition,
  deletePosition,
  generateId,
} from '@/lib/supabase/storage';
import { Position } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { signalId, executedPrice, action } = body as {
      signalId: string;
      executedPrice: number;
      action: 'confirm' | 'reject' | 'close';
    };

    if (!signalId || !action) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
    }

    const portfolio = await getPortfolio();

    // ── REJECT ───────────────────────────────────────────────────────────────
    if (action === 'reject') {
      await updateSignalStatus(signalId, 'REJECTED');
      return NextResponse.json({ success: true, message: 'Segnale rifiutato.' });
    }

    // ── CONFIRM (open position) ───────────────────────────────────────────────
    if (action === 'confirm') {
      if (!executedPrice || executedPrice <= 0) {
        return NextResponse.json({ success: false, error: 'Prezzo di esecuzione mancante' }, { status: 400 });
      }

      const signal = portfolio.signals.find(s => s.id === signalId);
      if (!signal) {
        return NextResponse.json({ success: false, error: 'Segnale non trovato' }, { status: 404 });
      }
      if (signal.status !== 'PENDING') {
        return NextResponse.json({ success: false, error: 'Segnale non più in attesa' }, { status: 400 });
      }

      const positionId = generateId();

      // Recalculate stop/take based on actual execution price (slight adjustment)
      const slPct = signal.stopLossPercent / 100;
      const tpPct = signal.takeProfitPercent / 100;
      const stopLoss = parseFloat((executedPrice * (1 - slPct)).toFixed(2));
      const takeProfit = parseFloat((executedPrice * (1 + tpPct)).toFixed(2));

      const position: Position = {
        id: positionId,
        signalId,
        symbol: signal.symbol,
        name: signal.name,
        type: signal.type,
        action: signal.action,
        entryPrice: executedPrice,
        quantity: signal.quantity,
        capitalAllocated: executedPrice * signal.quantity,
        stopLoss,
        takeProfit,
        entryDate: new Date().toISOString(),
        status: 'OPEN',
        currentPrice: executedPrice,
        unrealizedPnl: 0,
        unrealizedPnlPercent: 0,
        portfolio: signal.portfolio,
      };

      await openPosition(position);
      await updateSignalStatus(signalId, 'EXECUTED', {
        executedAt: new Date().toISOString(),
        executedPrice,
        positionId,
        approvedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: `Posizione aperta — ${signal.quantity} ${signal.symbol} a €${executedPrice}`,
        positionId,
      });
    }

    // ── CLOSE POSITION ────────────────────────────────────────────────────────
    if (action === 'close') {
      if (!executedPrice || executedPrice <= 0) {
        return NextResponse.json({ success: false, error: 'Prezzo di chiusura mancante' }, { status: 400 });
      }

      // signalId here is actually positionId when closing
      const closed = await closePosition(signalId, executedPrice);
      if (!closed) {
        return NextResponse.json({ success: false, error: 'Posizione non trovata' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: `Posizione chiusa — P&L: ${closed.realizedPnl! >= 0 ? '+' : ''}€${closed.realizedPnl!.toFixed(2)} (${closed.realizedPnlPercent!.toFixed(2)}%)`,
        pnl: closed.realizedPnl,
        pnlPercent: closed.realizedPnlPercent,
      });
    }

    // ── DELETE/CANCEL POSITION ───────────────────────────────────────────────
    if (action === 'delete') {
      const deleted = await deletePosition(signalId);
      if (!deleted) {
        return NextResponse.json({ success: false, error: 'Posizione non trovata' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: 'Operazione rifiutata. Posizione cancellata e capitale ripristinato.',
      });
    }

    return NextResponse.json({ success: false, error: 'Action not recognized' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
