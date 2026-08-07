/**
 * lib/tbd-storage.ts — Lock atomico Redis NX + helper TBD
 * Lock via Upstash SET NX EX (atomico, no polling).
 */

import { TradingDayLog, TbdSignal, TradingEngineConfig, DEFAULT_CONFIG } from './trading-by-day';

// ─── KV ADAPTER ───────────────────────────────────────────────────────────

export async function kvGet(key: string): Promise<string | null> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const res = await fetch(`${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result ?? null;
  }
  return null;
}

export async function kvSet(key: string, value: string, exSeconds?: number): Promise<void> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const url = exSeconds
      ? `${process.env.KV_REST_API_URL}/set/${encodeURIComponent(key)}?ex=${exSeconds}`
      : `${process.env.KV_REST_API_URL}/set/${encodeURIComponent(key)}`;
    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: value,
    });
  }
}

// ─── HELPER DATE ─────────────────────────────────────────────────────────

export function todayKey(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

// ─── TRADING DAY LOG ─────────────────────────────────────────────────────

export async function getTodayLog(): Promise<TradingDayLog | null> {
  const raw = await kvGet(`tbd:log:${todayKey()}`);
  if (!raw) return null;
  try { return JSON.parse(raw) as TradingDayLog; } catch { return null; }
}

export async function saveTodayLog(log: TradingDayLog): Promise<void> {
  log.updatedAt = new Date().toISOString();
  await kvSet(`tbd:log:${log.date}`, JSON.stringify(log), 90 * 24 * 3600);
}

export async function getLast30DaysLogs(): Promise<TradingDayLog[]> {
  const promises = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    promises.push(kvGet(`tbd:log:${key}`));
  }
  const results = await Promise.allSettled(promises);
  const logs: TradingDayLog[] = [];
  results.forEach(res => {
    if (res.status === 'fulfilled' && res.value) {
      try { logs.push(JSON.parse(res.value) as TradingDayLog); } catch { /* skip */ }
    }
  });
  return logs.sort((a, b) => b.date.localeCompare(a.date));
}

// ─── SEGNALI ATTIVI (con lock per atomicità) ───────────────────────────────

const SIGNALS_KV_KEY = 'tbd:signals';
const SIGNALS_LOCK_KEY = 'tbd:signals:lock';
const SIGNALS_LOCK_TTL = 8; // seconds

async function acquireLock(lockKey: string, ttlSec = 8): Promise<boolean> {
  // If KV not configured, allow in development, fail in production to avoid silent inconsistencies
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    if (process.env.NODE_ENV === 'production') return false;
    return true;
  }

  const url = `${process.env.KV_REST_API_URL}/set/${encodeURIComponent(lockKey)}?nx&ex=${ttlSec}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
        'Content-Type': 'text/plain',
      },
      body: String(Date.now()),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.result !== null && data.result !== undefined;
  } catch (err) {
    console.error('[acquireLock] Error:', err);
    return false;
  }
}

async function releaseLock(lockKey: string): Promise<void> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return;
  const url = `${process.env.KV_REST_API_URL}/del/${encodeURIComponent(lockKey)}`;
  try {
    await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
    });
  } catch (err) {
    console.error('[releaseLock] Error:', err);
  }
}

export async function getActiveSignals(): Promise<TbdSignal[]> {
  const raw = await kvGet(SIGNALS_KV_KEY);
  if (!raw) return [];
  try {
    const all = JSON.parse(raw) as TbdSignal[];
    return all.filter(s => !['CLOSED_TP', 'CLOSED_SL', 'CANCELLED'].includes(s.status));
  } catch { return []; }
}

export async function saveSignals(signals: TbdSignal[]): Promise<void> {
  // write under a lock to avoid concurrent read-modify-write races
  const got = await acquireLock(SIGNALS_LOCK_KEY, SIGNALS_LOCK_TTL);
  if (!got) {
    console.warn('[saveSignals] Could not acquire signals lock, aborting save to avoid race');
    return;
  }
  try {
    const trimmed = signals.slice(0, 100);
    await kvSet(SIGNALS_KV_KEY, JSON.stringify(trimmed));
  } finally {
    await releaseLock(SIGNALS_LOCK_KEY);
  }
}

export async function addSignal(signal: TbdSignal): Promise<void> {
  const got = await acquireLock(SIGNALS_LOCK_KEY, SIGNALS_LOCK_TTL);
  if (!got) {
    console.warn('[addSignal] Could not acquire signals lock, skipping add to avoid race');
    return;
  }

  try {
    const existingRaw = await kvGet(SIGNALS_KV_KEY);
    let existing: TbdSignal[] = [];
    if (existingRaw) {
      try { existing = JSON.parse(existingRaw) as TbdSignal[]; } catch { existing = []; }
    }

    const deduped = existing.filter(
      s => !(s.asset === signal.asset && s.direction === signal.direction && s.timeframe === signal.timeframe)
    );
    const combined = [signal, ...deduped].slice(0, 100);
    await kvSet(SIGNALS_KV_KEY, JSON.stringify(combined));
  } finally {
    await releaseLock(SIGNALS_LOCK_KEY);
  }
}

export async function updateSignalStatus(
  signalId: string,
  status: TbdSignal['status'],
  realizedPnL?: number,
): Promise<TbdSignal | null> {
  const got = await acquireLock(SIGNALS_LOCK_KEY, SIGNALS_LOCK_TTL);
  if (!got) {
    console.warn('[updateSignalStatus] Could not acquire signals lock, aborting update');
    return null;
  }

  try {
    const raw = await kvGet(SIGNALS_KV_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as TbdSignal[];
    const idx = all.findIndex(s => s.id === signalId);
    if (idx === -1) return null;

    const isClosing = ['CLOSED_TP', 'CLOSED_SL', 'CANCELLED'].includes(status);

    all[idx] = {
      ...all[idx],
      status,
      ...(realizedPnL !== undefined ? { realizedPnL } : {}),
      ...(isClosing ? { closedAt: new Date().toISOString() } : {}),
      ...(!isClosing && !all[idx].triggeredAt ? { triggeredAt: new Date().toISOString() } : {}),
    };
    await kvSet(SIGNALS_KV_KEY, JSON.stringify(all.slice(0, 100)));
    return all[idx];
  } catch (err) {
    console.error('[updateSignalStatus] Error:', err);
    return null;
  } finally {
    await releaseLock(SIGNALS_LOCK_KEY);
  }
}

// ─── CONFIG RUNTIME ───────────────────────────────────────────────────────

export async function getTbdConfig(): Promise<TradingEngineConfig> {
  const raw = await kvGet('tbd:config');
  if (!raw) return DEFAULT_CONFIG;
  try { return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }; } catch { return DEFAULT_CONFIG; }
}

export async function saveTbdConfig(config: Partial<TradingEngineConfig>): Promise<void> {
  const current = await getTbdConfig();
  await kvSet('tbd:config', JSON.stringify({ ...current, ...config }));
}

// ─── LOCK ATOMICO VIA SET NX EX (Upstash REST) ──────────────────────────────

const LOCK_PREFIX = 'tbd:lock:';
const LOCK_TTL_SECONDS = 30;

/**
 * Acquisisce un lock giornaliero atomico via Upstash SET NX EX.
 * Ritorna true solo se il lock è stato acquisito (chiave non esisteva).
 * Nessun polling: opera in O(1) con semantica forte.
 */
export async function acquireDayLock(date: string): Promise<boolean> {
  // In production we require KV envs; in dev allow fallback
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    if (process.env.NODE_ENV === 'production') return false;
    return true;
  }

  const lockKey = `${LOCK_PREFIX}${date}`;
  const lockValue = Date.now().toString();

  // SET NX EX: atomico, nessuna race condition
  const url = `${process.env.KV_REST_API_URL}/set/${encodeURIComponent(lockKey)}?nx&ex=${LOCK_TTL_SECONDS}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
        'Content-Type': 'text/plain',
      },
      body: lockValue,
    });

    if (!res.ok) return false;
    const data = await res.json();
    // Upstash REST: ritorna {"result":"OK"} se SET ha successo, {"result":null} se NX fallisce
    return data.result !== null && data.result !== undefined;
  } catch (err) {
    console.error('[acquireDayLock] Error:', err);
    return false;
  }
}

/**
 * Rilascia esplicitamente il lock (il TTL di 30s lo scade comunque automaticamente).
 */
export async function releaseDayLock(date: string): Promise<void> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return;

  const lockKey = `${LOCK_PREFIX}${date}`;
  const url = `${process.env.KV_REST_API_URL}/del/${encodeURIComponent(lockKey)}`;
  try {
    await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
    });
  } catch (err) {
    console.error('[releaseDayLock] Error:', err);
  }
}
