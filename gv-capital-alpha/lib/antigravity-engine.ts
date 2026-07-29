// lib/antigravity-engine.ts
// ─── ANTIGRAVITY ENGINE V2 ───────────────────────────────────────────────────
// Motore di allocazione tattica adattiva basato su drawdown dinamico.
// Regola leva, Core/Satellite/TBD e cooldown in base ai massimi storici.

export interface AntigravityConfig {
  maxDrawdownPct: number;       // Soglia drawdown per PROTEZIONE (default 5%)
  targetLeverage: number;       // Leva normale (1.0 = nessuna leva)
  expandedLeverage: number;     // Leva massima in espansione (1.5)
  cooldownHours: number;        // Ore di blocco TBD dopo trigger protezione
  coreSatelliteDefault: number; // Target Core di default (%)
}

export interface AntigravityState {
  status: 'NORMAL' | 'EXPANDED' | 'COOLDOWN' | 'PROTECTION';
  currentDrawdownPct: number;
  peakValue: number;
  currentValue: number;
  tbdInCooldown: boolean;
  cooldownUntil: string | null;
  coreTargetPct: number;
  satelliteTargetPct: number;
  tbdTargetPct: number;
  actionRequired: string;
  timestamp: string;
}

export const DEFAULT_ANTIGRAVITY_CONFIG: AntigravityConfig = {
  maxDrawdownPct: 5.0,
  targetLeverage: 1.0,
  expandedLeverage: 1.5,
  cooldownHours: 24,
  coreSatelliteDefault: 70,
};

export class AntigravityEngine {
  constructor(private config: AntigravityConfig = DEFAULT_ANTIGRAVITY_CONFIG) {}

  calculateState(
    currentValue: number,
    peakValue: number,
    tbdRealizedPnL: number,
    lastCooldownUntil: string | null
  ): AntigravityState {
    const drawdown = peakValue > 0
      ? ((peakValue - currentValue) / peakValue) * 100
      : 0;

    const now = new Date();

    // ── Gestione Cooldown TBD ──────────────────────────────────────────────
    let tbdInCooldown = false;
    let cooldownUntil = lastCooldownUntil;

    if (lastCooldownUntil) {
      const until = new Date(lastCooldownUntil);
      if (until > now) {
        tbdInCooldown = true;
      } else {
        cooldownUntil = null; // Cooldown scaduto
      }
    }

    // ── Default: stato NORMAL ──────────────────────────────────────────────
    let status: AntigravityState['status'] = 'NORMAL';
    let coreTargetPct = this.config.coreSatelliteDefault;
    let satelliteTargetPct = 100 - coreTargetPct;
    let tbdTargetPct = 0;
    let actionRequired = '✅ Allocazione normale. Nessuna azione richiesta.';

    // ── Logica stati (priorità: PROTEZIONE > COOLDOWN > ESPANSIONE) ───────

    // 1. PROTEZIONE — Drawdown critico
    if (drawdown >= this.config.maxDrawdownPct) {
      status = 'PROTECTION';
      coreTargetPct = Math.min(95, coreTargetPct + 15);
      satelliteTargetPct = Math.max(0, 100 - coreTargetPct);
      tbdTargetPct = 0;
      tbdInCooldown = true;

      const cd = new Date(now.getTime() + this.config.cooldownHours * 60 * 60 * 1000);
      cooldownUntil = cd.toISOString();

      actionRequired = `🛡️ PROTEZIONE ATTIVA — Drawdown ${drawdown.toFixed(1)}%. ` +
        `Riduci leva a ${this.config.targetLeverage}x, aumenta Core al ${coreTargetPct}%. ` +
        `TBD bloccato fino a ${cd.toLocaleString('it-IT')}.`;
    }
    // 2. COOLDOWN — Drawdown moderato (60% della soglia)
    else if (drawdown >= this.config.maxDrawdownPct * 0.6) {
      status = 'COOLDOWN';
      tbdTargetPct = Math.max(0, satelliteTargetPct - 10);
      satelliteTargetPct = Math.max(0, satelliteTargetPct - tbdTargetPct);

      actionRequired = `🟡 COOLDOWN — Drawdown ${drawdown.toFixed(1)}%. ` +
        `Riduci esposizione speculativa. TBD ridotto al ${tbdTargetPct}%.`;
    }
    // 3. ESPANSIONE — Nuovi massimi (+2% sopra il peak)
    else if (currentValue >= peakValue * 1.02 && peakValue > 0) {
      status = 'EXPANDED';
      coreTargetPct = Math.max(50, coreTargetPct - 10);
      satelliteTargetPct = Math.min(40, satelliteTargetPct + 5);
      tbdTargetPct = 100 - coreTargetPct - satelliteTargetPct;

      actionRequired = `🚀 ESPANSIONE — Nuovi massimi. Leva espansa a ${this.config.expandedLeverage}x. ` +
        `Aumenta Satellite/TBD. Core ridotto al ${coreTargetPct}%.`;
    }

    return {
      status,
      currentDrawdownPct: drawdown,
      peakValue,
      currentValue,
      tbdInCooldown,
      cooldownUntil,
      coreTargetPct,
      satelliteTargetPct,
      tbdTargetPct,
      actionRequired,
      reason: actionRequired,
      timestamp: now.toISOString(),
    } as AntigravityState & { reason: string };
  }

  // ── Formatter per UI ─────────────────────────────────────────────────────
  formatStatus(state: AntigravityState): {
    title: string;
    emoji: string;
    description: string;
    color: string;
  } {
    const map = {
      NORMAL: {
        title: 'Allocazione Normale',
        emoji: '✅',
        description: 'Il portafoglio opera entro parametri standard. Core/Satellite bilanciato.',
        color: '#00d4aa',
      },
      EXPANDED: {
        title: 'Leva Espansa',
        emoji: '🚀',
        description: 'Nuovi massimi rilevati. Consentita allocazione aggressiva su Satellite e TBD.',
        color: '#3b82f6',
      },
      COOLDOWN: {
        title: 'Raffreddamento',
        emoji: '🟡',
        description: 'Drawdown in aumento. Riduci progressivamente esposizione speculativa.',
        color: '#f59e0b',
      },
      PROTECTION: {
        title: 'Protezione Attiva',
        emoji: '🛡️',
        description: 'Drawdown critico superato. TBD bloccato, aumenta Core, riduci leva.',
        color: '#ef4444',
      },
    };
    return map[state.status];
  }

  // ── Helper allocazione per compatibilità ─────────────────────────────────
  calculateAbsoluteAllocation(
    totalPortfolioValue: number,
    state: AntigravityState
  ): {
    coreValue: number;
    satelliteValue: number;
    tbdValue: number;
  } {
    return {
      coreValue: totalPortfolioValue * (state.coreTargetPct / 100),
      satelliteValue: totalPortfolioValue * (state.satelliteTargetPct / 100),
      tbdValue: totalPortfolioValue * (state.tbdTargetPct / 100),
    };
  }
}

// ─── HELPER PERSISTENZA COOLDOWN ──────────────────────────────────────────────

export const ANTIGRAVITY_COOLDOWN_KEY = 'antigravity:tbd_cooldown_until';

export async function getTbdCooldownUntil(kvGet: (key: string) => Promise<string | null>): Promise<string | null> {
  return await kvGet(ANTIGRAVITY_COOLDOWN_KEY);
}

export async function setTbdCooldownUntil(
  kvSet: (key: string, value: string, exSeconds?: number) => Promise<void>,
  until: string | null
): Promise<void> {
  if (!until) {
    await kvSet(ANTIGRAVITY_COOLDOWN_KEY, '', 1);
    return;
  }
  const ttlSeconds = Math.ceil((new Date(until).getTime() - Date.now()) / 1000);
  await kvSet(ANTIGRAVITY_COOLDOWN_KEY, until, Math.max(1, ttlSeconds));
}
