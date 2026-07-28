import { NextResponse } from 'next/server';
import { getPacConfig, savePacConfig, updatePacBudget, updatePacWeight, resetPacWeights } from '@/lib/storage';

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

    if (body.type === 'set_budget') {
      await updatePacBudget(body.portfolio, Number(body.amount) || 0);
    } else if (body.type === 'set_weight') {
      await updatePacWeight(body.portfolio, body.symbol, Number(body.weight) || 0);
    } else if (body.type === 'reset_weights') {
      await resetPacWeights(body.portfolio);
    } else if (body.type === 'save_all') {
      await savePacConfig(body.config);
    }

    const config = await getPacConfig();
    return NextResponse.json({ success: true, data: config });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
