import { NextResponse } from 'next/server';
import { fetchLivePrice } from '@/lib/market';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');
    if (!symbolsParam) {
      return NextResponse.json({ success: true, prices: {} });
    }

    const symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);
    const priceMap: Record<string, number> = {};

    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const price = await fetchLivePrice(symbol);
          if (price !== null) {
            priceMap[symbol] = price;
          }
        } catch {}
      })
    );

    return NextResponse.json({ success: true, prices: priceMap });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
