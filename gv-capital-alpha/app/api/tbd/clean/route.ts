import { NextResponse } from 'next/server';
import { saveSignals } from '@/lib/tbd-storage';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pulisce tutti i segnali attivi TBD salvati nel database KV
    await saveSignals([]);
    return NextResponse.json({
      success: true,
      message: '🧹 Tutti i segnali TBD in memoria sono stati azzerati con successo!',
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
