/**
 * app/api/signals/approve/route.ts
 * Approvazione manuale segnali Satellite
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPortfolio, mutatePortfolio } from '@/lib/storage';
import { sendPushToAllSubscriptions } from '@/lib/push';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { signalId } = await req.json();
    if (!signalId) {
      return NextResponse.json({ success: false, error: 'signalId required' }, { status: 400 });
    }

    const portfolio = await getPortfolio();
    const signal = portfolio.signals?.find((s: any) => s.id === signalId);

    if (!signal) {
      return NextResponse.json({ success: false, error: 'Signal not found' }, { status: 404 });
    }

    if (signal.status !== 'PENDING') {
      return NextResponse.json({ success: false, error: `Signal already ${signal.status}` }, { status: 400 });
    }

    // Approve
    await mutatePortfolio(p => {
      const sig = p.signals?.find((s: any) => s.id === signalId);
      if (sig) {
        sig.status = 'APPROVED';
        sig.approvedAt = new Date().toISOString();
      }
    });

    // Notifica
    await sendPushToAllSubscriptions({
      title: `✅ Segnale Approvato: ${signal.symbol}`,
      body: `${signal.action} @ ${signal.suggestedPrice.toFixed(2)}€ | Kelly: ${((signal.kellyFraction || 0) * 100).toFixed(1)}%`,
      data: { type: 'signal_approved', signalId, symbol: signal.symbol },
    });

    return NextResponse.json({ success: true, signal });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// GET: lista segnali pending
export async function GET() {
  try {
    const portfolio = await getPortfolio();
    const pending = (portfolio.signals || []).filter((s: any) => s.status === 'PENDING');
    return NextResponse.json({ success: true, signals: pending });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
