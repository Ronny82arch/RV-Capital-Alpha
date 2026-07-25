import { NextResponse } from 'next/server';
import { getPacConfig, savePacConfig } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await getPacConfig();
    return NextResponse.json({ success: true, data: config });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const config = await getPacConfig();

    if (body.type === 'set_budget') {
      // { type: 'set_budget', portfolio: 'Principale', amount: 500 }
      config.portfolioMonthlyBudgets[body.portfolio] = Number(body.amount) || 0;
    } else if (body.type === 'set_weight') {
      // { type: 'set_weight', portfolio: 'Principale', symbol: 'NVDA', weight: 30 }
      if (!config.assetTargetWeights) config.assetTargetWeights = {};
      if (!config.assetTargetWeights[body.portfolio]) config.assetTargetWeights[body.portfolio] = {};
      config.assetTargetWeights[body.portfolio][body.symbol] = Number(body.weight) || 0;
    } else if (body.type === 'reset_weights') {
      // { type: 'reset_weights', portfolio: 'Principale' }
      if (config.assetTargetWeights) {
        delete config.assetTargetWeights[body.portfolio];
      }
    } else if (body.type === 'save_all') {
      // Full config replace: { type: 'save_all', config: PacConfig }
      await savePacConfig(body.config);
      return NextResponse.json({ success: true, data: body.config });
    }

    await savePacConfig(config);
    return NextResponse.json({ success: true, data: config });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
