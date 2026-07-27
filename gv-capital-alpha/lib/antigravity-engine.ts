/**
 * ANTIGRAVITY ENGINE v2 — Risk Transfer Allocator
 * 
 * Principi:
 * 1. ZERO leverage finanziario (>1x). Solo spostamento di capitale tra bucket.
 * 2. Il TBD riceve "boost" di capitale SOLO quando il mercato offre setup 
 *    di alta qualità (quality score) E il portafoglio non è in drawdown.
 * 3. Se il TBD perde il risk budget giornaliero → cooldown 48h.
 * 4. In drawdown >10% tutto va in Core (protezione capitale).
 */

// ─── TIPI ───────────────────────────────────────────────────────────────────

export interface AntigravityConfig {
  /** Allocazione base Core (%) */
  coreBasePct: number;
  /** Allocazione base Satellite (%) */
  satelliteBasePct: number;
  /** Allocazione base TBD (%) */
  tbdBasePct: number;
  /** Max allocazione TBD in boost mode (%) */
  tbdMaxBoostPct: number;
  /** Soglia drawdown per PROTECT (%) */
  protectDrawdownPct: number;
  /** Soglia drawdown per CAUTION (%) */
  cautionDrawdownPct: number;
  /** Min quality score per attivare boost TBD (0-100) */
  minQualityScoreForBoost: number;
  /** Ore di cooldown dopo che TBD ha bruciato il daily budget */
  tbdCooldownHours: number;
}

export type AntigravityStatus = 
  | 'NORMAL' 
  | 'BOOST_TBD' 
  | 'CAUTION' 
  | 'PROTECT';

export interface AntigravityState {
  status: AntigravityStatus;
  coreTargetPct: number;
  satelliteTargetPct: number;
  tbdTargetPct: number;
  /** Capitale effettivo da allocare a TBD oggi (€) */
  tbdCapitalToday: number;
  /** Motivo dell'ultima decisione */
  reason: string;
  /** Se TBD è in cooldown */
  tbdInCooldown: boolean;
  /** Quando scade il cooldown (ISO string o null) */
  cooldownUntil: string | null;
  /** Drawdown calcolato (%) */
  currentDrawdownPct: number;
}

export interface TbdDailyResult {
  date: string;           // YYYY-MM-DD
  realizedPnL: number;    // può essere negativo
  riskBudget: number;     // es. 100
  tradesTaken: number;
}

// ─── CONFIGURAZIONE DEFAULT ─────────────────────────────────────────────────

export const DEFAULT_ANTIGRAVITY_CONFIG: AntigravityConfig = {
  coreBasePct: 70,
  satelliteBasePct: 25,
  tbdBasePct: 5,
  tbdMaxBoostPct: 15,
  protectDrawdownPct: 10.0,
  cautionDrawdownPct: 5.0,
  minQualityScoreForBoost: 70,
  tbdCooldownHours: 48,
};

// ─── ENGINE ─────────────────────────────────────────────────────────────────

export class AntigravityEngine {
  private config: AntigravityConfig;

  constructor(config: Partial<AntigravityConfig> = {}) {
    this.config = { ...DEFAULT_ANTIGRAVITY_CONFIG, ...config };
  }

  /**
   * Calcola lo stato completo di Antigravity.
   * 
   * @param totalPortfolioValue Valore attuale totale
   * @param peakValue Picco storico (max totalValue mai raggiunto)
   * @param tbdQualityScore Score medio qualità setup trovati oggi (0-100)
   * @param tbdCooldownUntil Se c'è un cooldown attivo, timestamp ISO; altrimenti null
   */
  public calculateState(
    totalPortfolioValue: number,
    peakValue: number,
    tbdQualityScore: number,
    tbdCooldownUntil: string | null
  ): AntigravityState {
    const drawdown = peakValue > 0 
      ? ((peakValue - totalPortfolioValue) / peakValue) * 100 
      : 0;

    const now = new Date().toISOString();
    const inCooldown = tbdCooldownUntil ? now < tbdCooldownUntil : false;

    // 1. PROTECT: drawdown grave → tutto in Core, TBD spento
    if (drawdown >= this.config.protectDrawdownPct) {
      return {
        status: 'PROTECT',
        coreTargetPct: 95,
        satelliteTargetPct: 5,
        tbdTargetPct: 0,
        tbdCapitalToday: 0,
        reason: `🛡️ PROTECT: Drawdown ${drawdown.toFixed(1)}% ≥ ${this.config.protectDrawdownPct}%. TBD congelato, capitale in shelter.`,
        tbdInCooldown: inCooldown,
        cooldownUntil: tbdCooldownUntil,
        currentDrawdownPct: drawdown,
      };
    }

    // 2. CAUTION: drawdown moderato → TBD minimo, nessun boost
    if (drawdown >= this.config.cautionDrawdownPct) {
      return {
        status: 'CAUTION',
        coreTargetPct: 80,
        satelliteTargetPct: 18,
        tbdTargetPct: 2,
        tbdCapitalToday: 0, // base troppo piccola per operare oggi
        reason: `⚠️ CAUTION: Drawdown ${drawdown.toFixed(1)}%. TBD ridotto al minimo, nessun boost.`,
        tbdInCooldown: inCooldown,
        cooldownUntil: tbdCooldownUntil,
        currentDrawdownPct: drawdown,
      };
    }

    // 3. BOOST TBD: mercato offre setup di qualità, nessun cooldown
    if (!inCooldown && tbdQualityScore >= this.config.minQualityScoreForBoost) {
      const boostTbd = this.config.tbdMaxBoostPct;
      const remaining = 100 - boostTbd;
      // Il boost prende SOLO dal Satellite, mai dal Core
      const satPct = Math.max(5, remaining - this.config.coreBasePct);
      const corePct = 100 - boostTbd - satPct;

      return {
        status: 'BOOST_TBD',
        coreTargetPct: corePct,
        satelliteTargetPct: satPct,
        tbdTargetPct: boostTbd,
        tbdCapitalToday: 0, // calcolato dal chiamante in base a totalPortfolioValue * boostTbd/100
        reason: `🎯 BOOST TBD: Quality score ${tbdQualityScore.toFixed(0)}/100. Capitale TBD aumentato al ${boostTbd}% (prelevato dal Satellite).`,
        tbdInCooldown: false,
        cooldownUntil: null,
        currentDrawdownPct: drawdown,
      };
    }

    // 4. NORMAL
    return {
      status: 'NORMAL',
      coreTargetPct: this.config.coreBasePct,
      satelliteTargetPct: this.config.satelliteBasePct,
      tbdTargetPct: this.config.tbdBasePct,
      tbdCapitalToday: 0,
      reason: `✅ NORMAL: Drawdown ${drawdown.toFixed(1)}%. Allocazione base. TBD operativo a ${this.config.tbdBasePct}%.`,
      tbdInCooldown: inCooldown,
      cooldownUntil: tbdCooldownUntil,
      currentDrawdownPct: drawdown,
    };
  }

  /**
   * Calcola i valori assoluti (€) da allocare per ogni bucket.
   */
  public calculateAbsoluteAllocation(
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

  /**
   * Valuta se un risultato giornaliero del TBD deve attivare il cooldown.
   * Ritorna il nuovo timestamp di cooldown (o null se non attivato).
   */
  public evaluateCooldown(
    todayResult: TbdDailyResult
  ): string | null {
    const budgetLost = todayResult.realizedPnL <= -todayResult.riskBudget;
    
    if (budgetLost) {
      const until = new Date();
      until.setHours(until.getHours() + this.config.tbdCooldownHours);
      return until.toISOString();
    }
    
    return null;
  }

  /**
   * Formatta lo stato per le notifiche/UI.
   */
  public formatStatus(state: AntigravityState): {
    emoji: string;
    title: string;
    color: string;
    description: string;
  } {
    const map: Record<AntigravityStatus, { emoji: string; title: string; color: string }> = {
      NORMAL:      { emoji: '✅', title: 'Allocazione Normale',       color: '#10b981' },
      BOOST_TBD:   { emoji: '🎯', title: 'Boost TBD Attivo',          color: '#8b5cf6' },
      CAUTION:     { emoji: '⚠️', title: 'Modalità Cautelativa',      color: '#f59e0b' },
      PROTECT:     { emoji: '🛡️', title: 'Protezione Capitale',       color: '#ef4444' },
    };

    const m = map[state.status];
    return {
      emoji: m.emoji,
      title: m.title,
      color: m.color,
      description: state.reason,
    };
  }
}

// ─── HELPER PERSISTENZA ──────────────────────────────────────────────────────

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
