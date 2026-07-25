import { NextRequest, NextResponse } from 'next/server';
import {
  getPortfolio,
  updateSignalStatus,
  openPosition,
  closePosition,
  deletePosition,
  generateId,
} from '@/lib/storage';
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

      // ✅ FIX: Calcola slippage massimo consentito (0.5%)
      const slippage = Math.abs((executedPrice - signal.suggestedPrice) / signal.suggestedPrice);
      const MAX_SLIPPAGE = 0.005; // 0.5%
      if (slippage > MAX_SLIPPAGE) {
        return NextResponse.json({ 
          success: false, 
          error: `Slippage eccessivo: ${(slippage * 100).toFixed(2)}% > ${(MAX_SLIPPAGE * 100).toFixed(2)}%. Esecuzione rifiutata.` 
        }, { status: 400 });
      }

      // ✅ FIX: Ricalcola quantity per rispettare capitalToAllocate approvato dal Kelly
      const recalculatedQty = Math.floor(signal.capitalToAllocate / executedPrice);
      const finalQty = Math.max(1, recalculatedQty);
      const actualCapitalAllocated = executedPrice * finalQty;

      // ✅ FIX: Se il capitale effettivo supera quello approvato + tolleranza, blocca
      const capitalTolerance = signal.capitalToAllocate * 1.02; // 2% tolleranza
      if (actualCapitalAllocated > capitalTolerance) {
        return NextResponse.json({ 
          success: false, 
          error: `Capitale richiesto (${actualCapitalAllocated.toFixed(2)}€) supera l'allocazione approvata (${signal.capitalToAllocate.toFixed(2)}€)` 
        }, { status: 400 });
      }

      const positionId = generateId();

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
        quantity: finalQty, // ✅ FIX: usa quantity ricalcolata
        capitalAllocated: actualCapitalAllocated, // ✅ FIX: usa capitale effettivo
        stopLoss,
        takeProfit,
        entryDate: new Date().toISOString(),
        status: 'OPEN',
        currentPrice: executedPrice,
        unrealizedPnl: 0,
        unrealizedPnlPercent: 0,
        realizedPnl: 0,
        realizedPnlPercent: 0,
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
        message: `Posizione aperta — ${finalQty} ${signal.symbol} a €${executedPrice} (slippage: ${(slippage * 100).toFixed(2)}%)`,
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
