/**
 * lib/push.ts — Invio notifiche push + pulizia automatica subscription 410/404
 */

import webpush from 'web-push';
import { supabaseAdmin } from './supabase/client';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
  if (!pub || !priv) {
    console.warn('[Push] VAPID keys non configurate — push disabilitato');
    return;
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Invia una notifica push a tutte le subscription attive.
 * Pulisce automaticamente gli endpoint 410/404 (subscription scadute).
 */
export async function sendPushToAllSubscriptions(
  payload: PushPayload
): Promise<{ sent: number; failed: number; cleaned: number }> {
  ensureConfigured();
  if (!configured) return { sent: 0, failed: 0, cleaned: 0 };

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*');

  if (!subs || subs.length === 0) return { sent: 0, failed: 0, cleaned: 0 };

  let sent = 0;
  let failed = 0;
  const deadEndpoints: string[] = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify(payload)
      );
      sent++;
    } catch (err: any) {
      failed++;
      const status = err.statusCode || err.httpStatusCode;
      // 410 Gone = subscription scaduta | 404 Not Found = endpoint invalido
      if (status === 410 || status === 404) {
        deadEndpoints.push(sub.endpoint);
      }
      console.error(`[Push] Failed ${sub.endpoint.slice(0, 40)}...`, status || err.message);
    }
  }

  let cleaned = 0;
  if (deadEndpoints.length > 0) {
    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .in('endpoint', deadEndpoints);

    if (!error) {
      cleaned = deadEndpoints.length;
      console.log(`[Push] Cleaned ${cleaned} dead subscriptions (410/404)`);
    }
  }

  return { sent, failed, cleaned };
}
