/**
 * TBD STORAGE — Vercel KV CRUD per Trading by Day
 * Chiavi: tbd:log:YYYY-MM-DD | tbd:signals | tbd:config
 * Completamente isolato dal portafoglio principale.
 */

import { TradingDayLog, TbdSignal, TradingEngineConfig, DEFAULT_CONFIG } from './trading-by-day';

// ─── KV ADAPTER (stessa infrastruttura di storage.ts) ────────────────────────

async function kvGet(key: string): Promise<string | null> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const res = await fetch(`${process.env.KV_REST_API_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result ?? null;
  }
  return null;
}

async function kvSet(key: string, value: string, exSeconds?: number): Promise<void> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const url = exSeconds
      ? `${process.env.KV_REST_API_URL}/setex/${key}/${exSeconds}`
      : `${process.env.KV_REST_API_URL}/set/${key}`;
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

async function kvKeys(pattern: string): Promise<string[]> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const res = await fetch(`${process.env.KV_REST_API_URL}/keys/${pattern}`, {
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.result ?? [];
  }
  return [];
}

// ─── HELPER DATE ──────────────────────────────────────────────────────────────

export function todayKey(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

// ─── TRADING DAY LOG ─────────────────────────────────────────────────────────

export async function getTodayLog(): Promise<TradingDayLog | null> {
  const raw = await kvGet(`tbd:log:${todayKey()}`);
  if (!raw) return null;
  try { return JSON.parse(raw) as TradingDayLog; } catch { return null; }
}

export async function saveTodayLog(log: TradingDayLog): Promise<void> {
  log.updatedAt = new Date().toISOString();
  // Conserva il log per 90 giorni
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

// ─── SEGNALI ATTIVI ───────────────────────────────────────────────────────────

export async function getActiveSignals(): Promise<TbdSignal[]> {
  const raw = await kvGet('tbd:signals');
  if (!raw) return [];
  try {
    const all = JSON.parse(raw) as TbdSignal[];
    // Restituisce solo i segnali non chiusi e delle ultime 24h
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return all.filter(s =>
      !['CLOSED_TP', 'CLOSED_SL', 'CANCELLED'].includes(s.status) &&
      new Date(s.timestamp).getTime() > cutoff
    );
  } catch { return []; }
}

export async function saveSignals(signals: TbdSignal[]): Promise<void> {
  // Mantieni al massimo 50 segnali in memoria
  const trimmed = signals.slice(0, 50);
  await kvSet('tbd:signals', JSON.stringify(trimmed), 48 * 3600);
}

export async function addSignal(signal: TbdSignal): Promise<void> {
  const existing = await getActiveSignals();
  // Evita duplicati sullo stesso asset nella stessa direzione
  const deduped = existing.filter(
    s => !(s.asset === signal.asset && s.direction === signal.direction)
  );
  await saveSignals([signal, ...deduped]);
}

export async function updateSignalStatus(
  signalId: string,
  status: TbdSignal['status'],
  realizedPnL?: number,
): Promise<TbdSignal | null> {
  const raw = await kvGet('tbd:signals');
  if (!raw) return null;
  const all = JSON.parse(raw) as TbdSignal[];
  const idx = all.findIndex(s => s.id === signalId);
  if (idx === -1) return null;

  all[idx] = {
    ...all[idx],
    status,
    ...(realizedPnL !== undefined ? { realizedPnL } : {}),
    ...(['CLOSED_TP', 'CLOSED_SL', 'CANCELLED'].includes(status)
      ? { closedAt: new Date().toISOString() }
      : { triggeredAt: new Date().toISOString() }),
  };
  await saveSignals(all);
  return all[idx];
}

// ─── CONFIG RUNTIME ───────────────────────────────────────────────────────────

export async function getTbdConfig(): Promise<TradingEngineConfig> {
  const raw = await kvGet('tbd:config');
  if (!raw) return DEFAULT_CONFIG;
  try { return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }; } catch { return DEFAULT_CONFIG; }
}

export async function saveTbdConfig(config: Partial<TradingEngineConfig>): Promise<void> {
  const current = await getTbdConfig();
  await kvSet('tbd:config', JSON.stringify({ ...current, ...config }));
}
