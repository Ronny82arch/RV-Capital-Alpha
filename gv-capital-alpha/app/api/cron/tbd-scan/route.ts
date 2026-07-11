/**
 * POST /api/cron/tbd-scan
 * Cron Vercel — ogni 30 minuti (ore di mercato 7-20 UTC, lunedì-venerdì)
 * Avvia lo scanner speculativo H1 automaticamente.
 */

import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: Request) {
  // Verifica firma Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Richiama lo scanner interno
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://gv-capital-alpha.vercel.app';
    const res = await fetch(`${baseUrl}/api/tbd/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...data,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
