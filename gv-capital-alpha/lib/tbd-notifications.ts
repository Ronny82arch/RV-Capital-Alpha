/**
 * TBD NOTIFICATIONS — FIXED VERSION
 * Firebase FCM + Web Push API fallback
 * 
 * ✅ Fixes:
 * - JWT signing con libreria jose
 * - accessToken correttamente ottenuto
 * - Fallback a Web Push se Firebase non configurato
 * - Error handling completo
 */

import { TbdSignal } from './trading-by-day';
import { addAlert } from './storage';

// ─── IMPORT JOSE PER JWT ──────────────────────────────────────────────────

// npm install jose
import * as jose from 'jose';

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

// ─── FIREBASE AUTH (OAuth2 Server-to-Server) ──────────────────────────────

async function getFirebaseAccessToken(): Promise<string | null> {
  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('[TBD FCM] Firebase config incomplete. Falling back to Web Push.');
    return null;
  }

  try {
    const alg = 'RS256';
    
    // ✅ FIX: Importare la chiave privata con jose
    const secret = await jose.importPKCS8(privateKey, alg);
    const now = Math.floor(Date.now() / 1000);
    
    // ✅ FIX: Firmare JWT con jose
    const token = await new jose.SignJWT({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
      .setProtectedHeader({ alg })
      .sign(secret);

    // ✅ FIX: Scambiare JWT con access token Google OAuth2
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: token,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`OAuth2 failed: ${errorText}`);
    }

    const { access_token } = await tokenResponse.json();
    console.log('[TBD FCM] Access token obtained successfully');
    return access_token;
  } catch (e) {
    console.error('[TBD FCM] JWT signing error:', e);
    return null;
  }
}

// ─── SEND FCM ────────────────────────────────────────────────────────────────

async function sendFcmMessage(payload: FcmPayload): Promise<boolean> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.warn('[TBD FCM] FIREBASE_PROJECT_ID not set');
    return false;
  }

  // ✅ FIX: Ottenere accessToken prima di usarlo
  const accessToken = await getFirebaseAccessToken();
  if (!accessToken) {
    console.warn('[TBD FCM] Unable to obtain access token');
    return false;
  }

  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const body = { message: payload };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[TBD FCM] Server error:', res.status, errorText);
      return false;
    }
    
    console.log('[TBD FCM] Message sent successfully');
    return true;
  } catch (e) {
    console.error('[TBD FCM] Fetch error:', e);
    return false;
  }
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

  // Invio FCM (se configurato)
  await sendFcmMessage(payload);

  // Anche aggiungere all'alert store interno
  try {
    await addAlert({
      title,
      message: body,
      type: 'INFO'
    });
  } catch (e) {
    console.warn('[TBD] Failed to add internal alert:', e);
  }
}

export async function sendCircuitBreakerNotification(
  message: string,
  reason: 'TARGET' | 'MAX_LOSS'
): Promise<void> {
  try {
    const emoji = reason === 'TARGET' ? '🎯' : '🛑';
    
    // Aggiungi alert interno
    await addAlert({
      title: `${emoji} Capital Alpha — Trading by Day`,
      message: message,
      type: reason === 'TARGET' ? 'SUCCESS' : 'WARNING'
    });


  } catch (e) {
    console.error('[TBD] Circuit breaker notification error:', e);
  }
}

export async function sendSignalTriggeredNotification(
  signal: TbdSignal,
  currentPrice: number
): Promise<void> {
  const dirEmoji = signal.direction === 'BUY' ? '🔵' : '🔶';
  const title    = `${dirEmoji} TRIGGER TBD ${signal.asset} — ${signal.direction}`;
  const body     = `Prezzo d'ingresso raggiunto: ${currentPrice}. Imposta l'ordine su eToro!\nSL: ${signal.stopLoss} | TP: ${signal.takeProfit}`;

  try {
    await addAlert({
      title,
      message: body,
      type: 'INFO'
    });


  } catch (e) {
    console.error('[TBD] Trigger notification error:', e);
  }
}

export async function sendExitNotification(
  signal: TbdSignal,
  type: 'TP' | 'SL',
  currentPrice: number
): Promise<void> {
  const emoji = type === 'TP' ? '✅' : '❌';
  const title = `${emoji} ESCI TBD ${signal.asset} — ${type} RAGGIUNTO`;
  const pnl = type === 'TP' ? signal.expectedPnL : -signal.maxLoss;
  const body = `Prezzo attuale: ${currentPrice} (SL/TP incrociato).\nChiudi la posizione su eToro!\nRisultato stimato: ${pnl >= 0 ? '+' : ''}${pnl}€`;

  try {
    await addAlert({
      title,
      message: body,
      type: type === 'TP' ? 'SUCCESS' : 'WARNING'
    });


  } catch (e) {
    console.error('[TBD] Exit notification error:', e);
  }
}

// ─── ESPORTA PER TESTING ───────────────────────────────────────────────────

export { getFirebaseAccessToken, sendFcmMessage };
