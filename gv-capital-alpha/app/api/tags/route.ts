import { NextRequest, NextResponse } from 'next/server';
import { updatePositionTags, getPortfolio, savePortfolio, updateCustomPortfolios, updatePositionPortfolio } from '@/lib/supabase/storage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { positionId, tags, type, aiManagedTags, customPortfolios, portfolioName } = body;

    if (type === 'portfolio_tags') {
      const portfolio = await getPortfolio();
      portfolio.aiManagedTags = aiManagedTags || [];
      await savePortfolio(portfolio);
      return NextResponse.json({ success: true, message: 'Filtri IA aggiornati' });
    }

    if (type === 'mark_alerts_read') {
      const { markAllAlertsAsRead } = await import('@/lib/supabase/storage');
      await markAllAlertsAsRead();
      return NextResponse.json({ success: true, message: 'Notifiche lette' });
    }

    if (type === 'update_portfolios') {
      if (!Array.isArray(customPortfolios)) {
        return NextResponse.json({ success: false, message: 'Dati non validi' }, { status: 400 });
      }
      await updateCustomPortfolios(customPortfolios);
      return NextResponse.json({ success: true, message: 'Portafogli aggiornati' });
    }

    if (type === 'delete_portfolio') {
      if (!portfolioName) return NextResponse.json({ success: false, message: 'Nome mancante' }, { status: 400 });
      const { deleteCustomPortfolio } = await import('@/lib/supabase/storage');
      await deleteCustomPortfolio(portfolioName);
      return NextResponse.json({ success: true, message: 'Portafoglio eliminato e asset riassegnati' });
    }

    if (type === 'rename_portfolio') {
      const { oldName, newName } = body;
      if (!oldName || !newName) return NextResponse.json({ success: false, message: 'Dati mancanti' }, { status: 400 });
      const { renameCustomPortfolio } = await import('@/lib/supabase/storage');
      await renameCustomPortfolio(oldName, newName);
      return NextResponse.json({ success: true, message: 'Portafoglio rinominato' });
    }

    if (type === 'assign_portfolio') {
      if (!positionId || !portfolioName) {
        return NextResponse.json({ success: false, message: 'Dati non validi' }, { status: 400 });
      }
      await updatePositionPortfolio(positionId, portfolioName);
      return NextResponse.json({ success: true, message: 'Portafoglio assegnato con successo' });
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

