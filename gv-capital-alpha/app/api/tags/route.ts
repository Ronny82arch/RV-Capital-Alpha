import { NextRequest, NextResponse } from 'next/server';
import { updatePositionTags, getPortfolio, savePortfolio } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { positionId, tags, type, aiManagedTags } = body;

    if (type === 'portfolio_tags') {
      const portfolio = await getPortfolio();
      portfolio.aiManagedTags = aiManagedTags || [];
      await savePortfolio(portfolio);
      return NextResponse.json({ success: true, message: 'Filtri IA aggiornati' });
    }

    if (!positionId || !Array.isArray(tags)) {
      return NextResponse.json({ success: false, message: 'Dati non validi' }, { status: 400 });
    }

    await updatePositionTags(positionId, tags);
    return NextResponse.json({ success: true, message: 'Tag aggiornati' });
  } catch (err) {
    console.error('Update tags error:', err);
    return NextResponse.json({ success: false, message: 'Errore interno' }, { status: 500 });
  }
}
