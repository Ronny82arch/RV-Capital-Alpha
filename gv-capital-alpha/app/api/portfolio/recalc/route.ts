/**
 * GET /api/portfolio/recalc
 * Fix doppio save: usa mutatePortfolio con recalcPortfolioState integrato.
 * Endpoint leggero per forzare il ricalcolo atomico del portfolio.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPortfolio, mutatePortfolio, recalcPortfolioState } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Un solo save atomico via mutatePortfolio
    await mutatePortfolio(p => {
      recalcPortfolioState(p);
    });

    const portfolio = await getPortfolio();
    
    return NextResponse.json({
      success: true,
      portfolio: {
        totalValue: portfolio.totalValue,
        totalPnL: portfolio.totalPnL,
        totalPnLPercent: portfolio.totalPnLPercent,
        capitalAvailable: portfolio.capitalAvailable,
        positionsCount: portfolio.positions.filter(p => p.status === 'OPEN').length,
      },
    });
  } catch (err: any) {
    console.error('[Portfolio Recalc Error]', err);
    return NextResponse.json(
      { success: false, error: err.message }, { status: 500 }
    );
  }
}
