import { NextResponse } from 'next/server';
import { Client } from '@upstash/qstash';
import { WATCHLIST } from '@/lib/market';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const qstashClient = new Client({ token: process.env.QSTASH_TOKEN || '' });

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const messages = [];
    // ✅ FIX: single-tenant, niente più tabella 'portfolios' multi-utente inesistente
    for (const item of WATCHLIST) {
      const payload = {
        ticker: item.symbol,
        strategy: 'QUONTEST_ASYNC', // ✅ tag distinto da /api/cron/scan per evitare doppioni
        timestamp: new Date().toISOString(),
      };

      const targetUrl = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/worker/process-ticker`;
      const message = await qstashClient.publishJSON({ url: targetUrl, body: payload, retries: 3 });
      messages.push(message);
    }

    return NextResponse.json({ success: true, jobs_queued: messages.length, message_ids: messages.map(m => m.messageId) });
  } catch (err: any) {
    console.error('Trigger scan failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
