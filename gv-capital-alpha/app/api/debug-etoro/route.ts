import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const kvUrl = process.env.KV_REST_API_URL ? process.env.KV_REST_API_URL.substring(0, 20) + '...' : 'undefined';
    const kvToken = process.env.KV_REST_API_TOKEN ? 'present' : 'undefined';

    if (!process.env.ETORO_API_KEY || !process.env.ETORO_USER_KEY) {
      return NextResponse.json({ error: 'No eToro keys', kvUrl, kvToken }, { status: 400 });
    }

    const { v4: uuidv4 } = await import('uuid');
    const headers = {
      'x-request-id': uuidv4(),
      'x-api-key': process.env.ETORO_API_KEY!,
      'x-user-key': process.env.ETORO_USER_KEY!,
      'Content-Type': 'application/json',
    };

    let raw: any = null;
    let source = 'real';
    try {
      const res = await fetch('https://public-api.etoro.com/api/v1/trading/info/real/pnl', { headers });
      if (res.ok) { raw = await res.json(); }
      else {
        source = 'demo (real failed ' + res.status + ')';
        const r2 = await fetch('https://public-api.etoro.com/api/v1/trading/info/demo/pnl', { headers });
        raw = await r2.json();
      }
    } catch (e: any) {
      source = 'demo (exception: ' + e.message + ')';
      const r2 = await fetch('https://public-api.etoro.com/api/v1/trading/info/demo/pnl', { headers });
      raw = await r2.json();
    }

    const { getEtoroPositions, getEtoroBalance } = await import('@/lib/etoro');
    const balance = await getEtoroBalance();
    const ePositions = await getEtoroPositions();

    return NextResponse.json({
      source,
      kvUrl,
      kvToken,
      balance,
      mappedPositionsCount: ePositions.length,
      mappedPositions: ePositions,
      clientPortfolio: raw?.clientPortfolio || null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

