import { NextResponse } from 'next/server';
import { fetchAllMarketData } from '@/lib/market';
import { getPortfolio, updatePositionPrices } from '@/lib/storage';

export const runtime = 'edge';
export const revalidate = 300; // 5 min cache

export async function GET() {
  try {
    const [marketData, portfolio] = await Promise.all([
      fetchAllMarketData(),
      getPortfolio(),
    ]);

    // Update open position prices
    const updates = portfolio.positions
      .filter(p => p.status === 'OPEN')
      .map(p => {
        const md = marketData.find(m => m.symbol === p.symbol);
        return md ? { positionId: p.id, currentPrice: md.price } : null;
      })
      .filter(Boolean) as { positionId: string; currentPrice: number }[];

    if (updates.length > 0) {
      await updatePositionPrices(updates);
    }

    return NextResponse.json({ success: true, data: marketData });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
