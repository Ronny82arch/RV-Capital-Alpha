import { NextResponse } from 'next/server';
import { cleanPerformanceHistory, getPortfolio } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// POST /api/portfolio/fix-history
// Rimuove tutti i punti mock da 30k dal db e aggiunge un punto reale per oggi
export async function POST() {
  try {
    await cleanPerformanceHistory();
    const portfolio = await getPortfolio();
    return NextResponse.json({
      success: true,
      message: `Cronologia ripulita. ${portfolio.performanceHistory.length} punti validi mantenuti.`,
      historyLength: portfolio.performanceHistory.length,
      history: portfolio.performanceHistory,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
