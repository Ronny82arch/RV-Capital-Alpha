// app/api/antigravity/rebalance/actions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generateRebalanceActions } from '@/lib/rebalance-generator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { portfolio, agState, marketRegime } = body;

    if (!portfolio || !agState) {
      return NextResponse.json(
        { success: false, error: 'Portfolio e agState sono obbligatori.' },
        { status: 400 }
      );
    }

    const plan = generateRebalanceActions(portfolio, agState, marketRegime);

    return NextResponse.json({
      success: true,
      plan,
      message: `Generato piano rebalance: ${plan.actions.length} azioni | ` +
               `Vendite: €${plan.summary.totalSell.toFixed(0)} | ` +
               `Acquisti: €${plan.summary.totalBuy.toFixed(0)} | ` +
               `Regime: ${plan.regime}`,
    });
  } catch (error: any) {
    console.error('[API /antigravity/rebalance/actions] Errore:', error);
    return NextResponse.json(
      { success: false, error: 'Errore generazione azioni.', details: error?.message },
      { status: 500 }
    );
  }
}
