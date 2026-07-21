import { NextResponse } from 'next/server';
import { Client } from '@upstash/qstash';
import { supabaseAdmin } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Inizializza QStash client
// La token deve essere impostata in QSTASH_TOKEN nel file .env
const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN || '',
});

export async function GET(req: Request) {
  try {
    // Sicurezza di base per CRON Vercel (se configurata)
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Recupera la lista degli asset da analizzare (es. tutti i portafogli attivi)
    // Usiamo Supabase Admin per bypassare RLS dato che è un cron job di sistema
    const { data: portfolios, error } = await supabaseAdmin
      .from('portfolios' as any) // Assumiamo esista una tabella portfolios
      .select('id, user_id, active_assets');

    if (error) {
      console.error('Errore lettura portafogli:', error);
      return NextResponse.json({ error: 'DB Error' }, { status: 500 });
    }

    const messages = [];

    // 2. Itera sui portafogli e prepara i payload
    for (const portfolio of (portfolios || [])) {
      const assets = portfolio.active_assets || [];
      
      for (const ticker of assets) {
        const payload = {
          portfolio_id: portfolio.id,
          user_id: portfolio.user_id,
          ticker: ticker,
          strategy: 'QUONTEST',
          timestamp: new Date().toISOString(),
        };

        // 3. Pubblica il job sulla coda QStash
        // Il target è il nostro Consumer (Worker)
        const targetUrl = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/worker/process-ticker`;
        
        // Push del messaggio in coda
        const message = await qstashClient.publishJSON({
          url: targetUrl,
          body: payload,
          retries: 3, // Retry in caso di fallimento (es. 429)
        });
        
        messages.push(message);
      }
    }

    return NextResponse.json({ 
      success: true, 
      jobs_queued: messages.length,
      message_ids: messages.map(m => m.messageId)
    });

  } catch (err: any) {
    console.error('Trigger scan failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
