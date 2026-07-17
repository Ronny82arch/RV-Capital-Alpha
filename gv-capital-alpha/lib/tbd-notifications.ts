/**
 * TBD NOTIFICATIONS — Firebase FCM scaffold
 * TODO: Configurare le seguenti env vars Vercel al termine dello sviluppo:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 *   FCM_TOPIC (es. "tbd-alerts") oppure salvare FCM token per utente
 *
 * Per ora il modulo logga i payload e non invia nulla se le variabili non sono presenti.
 */

import { TbdSignal } from './trading-by-day';

// ─── PAYLOAD FCM ──────────────────────────────────────────────────────────────

interface FcmPayload {
  topic?: string;
  token?: string;
  notification: {
    title: string;
    body: string;
  };
  data: Record<string, string>;
  android: {
    priority: 'high' | 'normal';
    notification: { channelId: string; priority: string };
  };
  apns: {
    payload: { aps: { contentAvailable: boolean; sound: string } };
    headers: { 'apns-priority': string };
  };
}

// ─── FIREBASE AUTH (OAuth2 Server-to-Server) ──────────────────────────────────

async function getFirebaseAccessToken(): Promise<string | null> {
  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) return null;

  try {
    // JWT manuale per ottenere access token Google OAuth2
    const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const now     = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })).toString('base64url');

    // Nota: in Edge Runtime non c'è crypto.createSign nativo per RSA.
    // L'implementazione completa richiede la libreria jose o google-auth-library.
    // TODO: installare `jose` e completare la firma JWT qui.
    console.log('[TBD FCM] Firebase configurato ma firma JWT in attesa di libreria jose.');
    return null;
  } catch (e) {
    console.error('[TBD FCM] Errore auth:', e);
    return null;
  }
}

// ─── SEND FCM ────────────────────────────────────────────────────────────────

async function sendFcmMessage(payload: FcmPayload): Promise<boolean> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.log('[TBD FCM] FIREBASE_PROJECT_ID non configurato — notifica saltata');
    return false;
  }

  const accessToken = await getFirebaseAccessToken();
  if (!accessToken) return false;

  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const body = { message: payload };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error('[TBD FCM] Errore invio:', await res.text());
    return false;
  }
  return true;
}

// ─── NOTIFICA PRE-ALERT ───────────────────────────────────────────────────────

export async function sendPreAlertNotification(signal: TbdSignal): Promise<void> {
  const dirEmoji = signal.direction === 'BUY' ? '🟢' : '🔴';
  const title    = `${dirEmoji} PRE-ALERT ${signal.asset} — ${signal.direction}`;
  const body     = [
    `⚡ Entry: ${signal.entryPrice}`,
    `🛑 SL: ${signal.stopLoss} | 🎯 TP: ${signal.takeProfit}`,
    `💰 Size: ${signal.allocatedSize}€ | R/R: ${signal.riskReward}`,
    `📱 Apri eToro e prepara l'ordine`,
  ].join('\n');

  const payload: FcmPayload = {
    topic: process.env.FCM_TOPIC ?? 'tbd-alerts',
    notification: { title, body },
    data: {
      signalId:      signal.id,
      asset:         signal.asset,
      direction:     signal.direction,
      entryPrice:    String(signal.entryPrice),
      stopLoss:      String(signal.stopLoss),
      takeProfit:    String(signal.takeProfit),
      allocatedSize: String(signal.allocatedSize),
      preTriggerPx:  String(signal.preTriggerPx),
      type:          'TBD_PRE_ALERT',
    },
    android: {
      priority: 'high',
      notification: { channelId: 'tbd-alerts', priority: 'high' },
    },
    apns: {
      payload: { aps: { contentAvailable: true, sound: 'default' } },
      headers: { 'apns-priority': '10' },
    },
  };

  const sent = await sendFcmMessage(payload);
  if (!sent) {
    // Log console come fallback
    console.log(`[TBD PRE-ALERT] ${title}\n${body}`);
  }
}

export async function sendCircuitBreakerNotification(message: string, reason: 'TARGET' | 'MAX_LOSS'): Promise<void> {
  const emoji = reason === 'TARGET' ? '🎯' : '🛑';
  const payload: FcmPayload = {
    topic: process.env.FCM_TOPIC ?? 'tbd-alerts',
    notification: {
      title: `${emoji} Capital Alpha — Trading by Day`,
      body: message,
    },
    data: { type: 'TBD_CIRCUIT_BREAKER', reason },
    android: { priority: 'high', notification: { channelId: 'tbd-alerts', priority: 'high' } },
    apns: { payload: { aps: { contentAvailable: true, sound: 'default' } }, headers: { 'apns-priority': '10' } },
  };
  const sent = await sendFcmMessage(payload);
  if (!sent) console.log(`[TBD CIRCUIT BREAKER] ${message}`);
}

export async function sendSignalTriggeredNotification(signal: TbdSignal, currentPrice: number): Promise<void> {
  const dirEmoji = signal.direction === 'BUY' ? '🔵' : '🔶';
  const title    = `${dirEmoji} TRIGGER TBD ${signal.asset} — ${signal.direction}`;
  const body     = `Prezzo d'ingresso raggiunto: ${currentPrice}. Imposta l'ordine su eToro!\nSL: ${signal.stopLoss} | TP: ${signal.takeProfit}`;

  const payload: FcmPayload = {
    topic: process.env.FCM_TOPIC ?? 'tbd-alerts',
    notification: { title, body },
    data: {
      signalId: signal.id,
      asset: signal.asset,
      direction: signal.direction,
      type: 'TBD_TRIGGERED',
    },
    android: { priority: 'high', notification: { channelId: 'tbd-alerts', priority: 'high' } },
    apns: { payload: { aps: { contentAvailable: true, sound: 'default' } }, headers: { 'apns-priority': '10' } },
  };

  const sent = await sendFcmMessage(payload);
  if (!sent) console.log(`[TBD TRIGGERED] ${title}\n${body}`);
}

export async function sendExitNotification(signal: TbdSignal, type: 'TP' | 'SL', currentPrice: number): Promise<void> {
  const emoji = type === 'TP' ? '✅' : '❌';
  const title = `${emoji} ESCI TBD ${signal.asset} — ${type} RAGGIUNTO`;
  const pnl = type === 'TP' ? signal.expectedPnL : -signal.maxLoss;
  const body = `Prezzo attuale: ${currentPrice} (SL/TP incrociato).\nChiudi la posizione su eToro!\nRisultato stimato: ${pnl >= 0 ? '+' : ''}${pnl}€`;

  const payload: FcmPayload = {
    topic: process.env.FCM_TOPIC ?? 'tbd-alerts',
    notification: { title, body },
    data: {
      signalId: signal.id,
      asset: signal.asset,
      type: 'TBD_EXIT',
      exitType: type,
    },
    android: { priority: 'high', notification: { channelId: 'tbd-alerts', priority: 'high' } },
    apns: { payload: { aps: { contentAvailable: true, sound: 'default' } }, headers: { 'apns-priority': '10' } },
  };

  const sent = await sendFcmMessage(payload);
  if (!sent) console.log(`[TBD EXIT] ${title}\n${body}`);
}
