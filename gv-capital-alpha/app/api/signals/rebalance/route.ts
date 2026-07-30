// app/api/signals/rebalance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { mutatePortfolio } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const { actions } = await req.json();

    if (!Array.isArray(actions)) {
      return NextResponse.json({ success: false, error: 'Azioni non valide.' }, { status: 400 });
    }

    const signals = actions.map((action: any) => ({
      id: action.id,
      symbol: action.symbol,
      name: action.name,
      type: (action.category === 'TBD' ? 'STOCK' : 'ETF') as any,
      action: action.type as 'BUY' | 'SELL',
      suggestedPrice: action.price,
      entryPrice: action.price,
      stopLoss: action.stopLoss || action.price * 0.95,
      takeProfit: action.takeProfit || action.price * 1.10,
      stopLossPercent: 5,
      takeProfitPercent: 10,
      kellyFraction: (action.quontestScore || 50) / 100,
      winProbability: (action.quontestScore || 50) / 100,
      winProbabilitySampleSize: 100,
      winProbabilityTrusted: true,
      expectedReturn: action.expectedReturn || 10,
      reasoning: action.reason,
      strategy: 'Antigravity Dynamic Rebalance',
      urgency: action.urgency === 'IMMEDIATE' ? 'HIGH' : 'MEDIUM',
      technicals: {
        rsi: 50,
        momentum: 0,
        sma20: action.price,
        sma50: action.price,
        trend: 'NEUTRAL',
      },
      capitalToAllocate: action.amount,
      quantity: action.quantity,
      createdAt: new Date().toISOString(),
      status: 'PENDING',
      portfolio: action.category,
      tags: ['ANTIGRAVITY_REBALANCE', action.regimeAlignment, action.urgency],
    }));

    await mutatePortfolio(p => {
      // Evita duplicati per ID
      const existingIds = new Set(p.signals.map(s => s.id));
      const newSignals = signals.filter((s: any) => !existingIds.has(s.id));
      p.signals.push(...(newSignals as any));
    });

    console.log('[Signals Rebalance] Persistiti', signals.length, 'segnali');

    return NextResponse.json({ success: true, count: signals.length, signals });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
