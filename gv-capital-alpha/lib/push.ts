import webpush from 'web-push';
import { getPushSubscriptions } from './storage';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
  if (!pub || !priv) {
    console.warn('[Push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY non configurate — invio push disabilitato');
    return;
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

export async function sendPushToAllSubscriptions(title: string, body: string, data?: Record<string, string>): Promise<void> {
  ensureConfigured();
  if (!configured) return;

  const subs = await getPushSubscriptions();
  if (subs.length === 0) return;

  const payload = JSON.stringify({ title, body, data: data || {} });

  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
    } catch (err: any) {
      console.error(`[Push] Invio fallito per ${sub.endpoint.slice(0, 50)}...:`, err?.statusCode || err?.message);
    }
  }));
}
