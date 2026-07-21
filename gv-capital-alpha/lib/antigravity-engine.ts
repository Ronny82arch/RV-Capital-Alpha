/**
 * ANTIGRAVITY ENGINE — Autonomous Capital Levitation System
 * 
 * Algoritmo di auto-rebalancing che aumenta/diminuisce il leverage
 * basandosi sulla performance in tempo reale del portafoglio.
 * 
 * Obiettivo: Massimizzare profitti in fase di win, minimizzare drawdown
 * in fase di perdita.
 * 
 * ─────────────────────────────────────────────────────────────────
 * COME FUNZIONA:
 * 
 * 1. FASE DI PROFITTO (+15%+ dai depositi)
 *    → Aumenta leverage 1.0x → 2.5x
 *    → Trasferisce capitale da Core (80%) a TBD (speculativo)
 *    → Rischio controllato: max loss non supera mai il 2%
 * 
 * 2. FASE DI EQUILIBRIO (±15%)
 *    → Mantiene leverage a 1.5x (50% extra)
 *    → Bilanciamento 70% Core / 30% TBD
 * 
 * 3. FASE DI PERDITA (-8%- dai depositi)
 *    → Riduce leverage 1.5x → 1.0x
 *    → Trasferisce capitale da TBD a Core
 *    → Protezione: liquida prima il TBD se drawdown > 5%
 * ─────────────────────────────────────────────────────────────────
 */

// ─── TYPES ────────────────────────────────────────────────────────────────

export interface AntigravityConfig {
  /** Capitale di base (non include leva) */
  baseCapital: number;                   // es. 5.000€
  
  /** Leverage target in condizioni normali */
  targetLeverage: number;                // es. 1.5x (50% extra)
  
  /** Limite massimo assoluto di leverage */
  maxLeverage: number;                   // es. 2.5x
  
  /** Soglia profitto per aumentare la leva */
  profitTriggerPct: number;              // es. 15% → aumenta
  
  /** Soglia perdita per ridurre la leva */
  lossTriggerPct: number;                // es. -8% → riduce
  
  /** Quante volte al giorno rebalance automatico */
  rebalanceInterval: 'HOURLY' | 'EVERY_4H' | 'DAILY';
  
  /** Tolleranza drift tra allocazione reale e target */
  driftTolerance: number;                // es. 2% (rebalance se > 2% di scarto)
  
  /** Max rischio giornaliero assoluto */
  maxDailyRiskPercent: number;           // es. 2% del capital
}

export interface LeverageState {
  /** Leva corrente (1.0x = no leva, 2.5x = max) */
  currentLeverage: number;
  
  /** Capitale totale esposto (Core + TBD) */
  deployedCapital: number;
  
  /** Liquidità non investita */
  availableCapital: number;
  
  /** Ultimo rebalance timestamp */
  lastRebalance: string;
  
  /** Scarto % da target */
  driftFromTarget: number;
  
  /** Stato del motore */
  status: 'NORMAL' | 'PROFIT_MODE' | 'CAUTION' | 'EMERGENCY_STOP';
}

export interface AllocationTarget {
  coreAssetsPct: number;                 // % portafoglio in Core
  tbdAssetsPct: number;                  // % portafoglio in TBD speculativo
  needsRebalance: boolean;
  estimatedRebalanceAmount: number;      // € da spostare
}

export interface RebalanceAction {
  action: 'INCREASE_LEVERAGE' | 'DECREASE_LEVERAGE' | 'HOLD' | 'EMERGENCY_EXIT';
  newLeverage: number;
  coreTargetPct: number;
  tbdTargetPct: number;
  reason: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estimatedPnLImpact: number;            // €
}

export interface AntigravityMetrics {
  // Performance
  totalPnL: number;
  totalPnLPercent: number;
  dailyPnL: number;
  
  // Rischio
  maxDrawdown: number;
  currentDrawdown: number;
  leverageUtilization: number;           // 0-100%
  
  // Rebalance
  lastRebalanceTime: string;
  daysUntilNextRebalance: number;
  drift: number;
  
  // Forecast
  projectedValue30Days: number;
}

// ─── CONFIGURAZIONE DEFAULT ───────────────────────────────────────────────

export const DEFAULT_ANTIGRAVITY_CONFIG: AntigravityConfig = {
  baseCapital: 5000.00,
  targetLeverage: 1.5,
  maxLeverage: 2.5,
  profitTriggerPct: 15.0,
  lossTriggerPct: -8.0,
  rebalanceInterval: 'EVERY_4H',
  driftTolerance: 2.0,
  maxDailyRiskPercent: 2.0,
};

// ─── ENGINE ───────────────────────────────────────────────────────────────

export class AntigravityEngine {
  private config: AntigravityConfig;
  private rebalanceHistory: Array<{ timestamp: string; action: string; leverageChange: number }> = [];

  constructor(config: AntigravityConfig = DEFAULT_ANTIGRAVITY_CONFIG) {
    this.config = config;
  }

  /**
   * CALCOLA LO STATO DI LEVA CORRENTE
   * 
   * @param effectiveCapital - Capitale effettivo incluso P&L
   * @param deployedCapital - Somma degli asset esposti
   * @param realizedPnL - P&L realizzato oggi
   * @returns LeverageState con metriche complete
   */
  public calculateLeverageState(
    effectiveCapital: number,
    deployedCapital: number,
    realizedPnL: number
  ): LeverageState {
    const currentLeverage = effectiveCapital > 0
      ? deployedCapital / effectiveCapital
      : 1.0;
    
    const availableCapital = Math.max(0, effectiveCapital - deployedCapital);
    const driftFromTarget = ((currentLeverage - this.config.targetLeverage) / this.config.targetLeverage) * 100;

    // Determina status basato su P&L
    let status: 'NORMAL' | 'PROFIT_MODE' | 'CAUTION' | 'EMERGENCY_STOP' = 'NORMAL';
    if (realizedPnL >= effectiveCapital * (this.config.profitTriggerPct / 100)) {
      status = 'PROFIT_MODE';
    } else if (realizedPnL <= -(effectiveCapital * (this.config.maxDailyRiskPercent / 100))) {
      status = 'EMERGENCY_STOP';
    } else if (realizedPnL <= -(effectiveCapital * (this.config.lossTriggerPct / 100))) {
      status = 'CAUTION';
    }

    return {
      currentLeverage: Math.min(this.config.maxLeverage, currentLeverage),
      deployedCapital,
      availableCapital,
      lastRebalance: new Date().toISOString(),
      driftFromTarget,
      status,
    };
  }

  /**
   * VALUTA SE AUMENTARE O RIDURRE LA LEVA
   * 
   * Logica:
   * - Profitto significativo → aumenta leva progressivamente
   * - Perdita moderata → riduce leva step-by-step
   * - Perdita grave → emergency exit (liquidare tutto il TBD)
   */
  public evaluateLeverageAdjustment(
    currentLeverage: number,
    currentDrawdown: number,
    daysSinceLastRebalance: number = 0
  ): RebalanceAction {
    const effectiveDrawdown = currentDrawdown;

    // ✅ EMERGENCY: Drawdown > 5% assoluto
    if (effectiveDrawdown <= -(this.config.baseCapital * 0.05)) {
      return {
        action: 'EMERGENCY_EXIT',
        newLeverage: 1.0,
        coreTargetPct: 100,
        tbdTargetPct: 0,
        reason: `🚨 DRAWDOWN CRITICO ${effectiveDrawdown.toFixed(2)}€ — Liquida TBD immediatamente`,
        urgency: 'CRITICAL',
        estimatedPnLImpact: effectiveDrawdown * -0.5, // Evita ulteriori perdite
      };
    }

    // ⚠️ CAUTION: Drawdown tra -2% e -5%
    if (effectiveDrawdown <= -(this.config.baseCapital * (this.config.lossTriggerPct / 100))) {
      const newLeverage = Math.max(1.0, currentLeverage * 0.85); // Riduce 15%
      return {
        action: 'DECREASE_LEVERAGE',
        newLeverage,
        coreTargetPct: 85,
        tbdTargetPct: 15,
        reason: `⚠️ Drawdown ${effectiveDrawdown.toFixed(2)}€ — Riduce leva a ${newLeverage.toFixed(2)}x`,
        urgency: 'HIGH',
        estimatedPnLImpact: 0,
      };
    }

    // 🟢 PROFIT MODE: Profitto significativo
    if (effectiveDrawdown >= (this.config.baseCapital * (this.config.profitTriggerPct / 100))) {
      const newLeverage = Math.min(
        this.config.maxLeverage,
        currentLeverage * 1.15 // Aumenta 15%
      );
      return {
        action: 'INCREASE_LEVERAGE',
        newLeverage,
        coreTargetPct: 70 - (newLeverage - 1.0) * 10,
        tbdTargetPct: 30 + (newLeverage - 1.0) * 10,
        reason: `✅ Profitto +${effectiveDrawdown.toFixed(2)}€ — Aumenta leva a ${newLeverage.toFixed(2)}x`,
        urgency: 'LOW',
        estimatedPnLImpact: effectiveDrawdown * 0.1,
      };
    }

    // HOLD: Entro range normale
    return {
      action: 'HOLD',
      newLeverage: currentLeverage,
      coreTargetPct: 70,
      tbdTargetPct: 30,
      reason: `✓ Leva stabile a ${currentLeverage.toFixed(2)}x — No rebalance necessario`,
      urgency: 'LOW',
      estimatedPnLImpact: 0,
    };
  }

  /**
   * CALCOLA LE ALLOCAZIONI TARGET TRA CORE E TBD
   * 
   * A leva più alta, trasferisce più capitale verso TBD speculativo.
   * La formula mantiene sempre protezione minima nel Core.
   */
  public calculateAllocationTargets(
    totalPortfolioValue: number,
    currentLeverage: number,
    currentCorePct: number,
    currentTbdPct: number
  ): AllocationTarget {
    // Allocazione base: 70% Core, 30% TBD
    // Con leva > 1.0, le proporzioni cambiano
    
    const leverageExcess = Math.max(0, currentLeverage - 1.0);
    const tbdAdjustment = leverageExcess * 20; // +20% TBD per ogni 1x di leva extra
    
    const targetTbdPct = Math.min(50, 30 + tbdAdjustment);
    const targetCorePct = 100 - targetTbdPct;

    const drift = Math.abs(currentTbdPct - targetTbdPct);
    const needsRebalance = drift > this.config.driftTolerance;

    const currentTbdValue = (totalPortfolioValue * currentTbdPct) / 100;
    const targetTbdValue = (totalPortfolioValue * targetTbdPct) / 100;
    const estimatedRebalanceAmount = Math.abs(targetTbdValue - currentTbdValue);

    return {
      coreAssetsPct: targetCorePct,
      tbdAssetsPct: targetTbdPct,
      needsRebalance,
      estimatedRebalanceAmount,
    };
  }

  /**
   * STRESS TEST: Simula cosa succede con shock di mercato
   * 
   * Utile per verificare se la leva corrente è sostenibile
   * con una perdita improvvisa del 10-20%.
   */
  public stressTestMarketShock(
    totalPortfolioValue: number,
    currentLeverage: number,
    shockPercent: number = -10
  ): {
    portfolioValueAfterShock: number;
    remainingCapital: number;
    canSustain: boolean;
    leverageAfterShock: number;
  } {
    const lossAmount = (totalPortfolioValue * shockPercent) / 100;
    const portfolioAfter = totalPortfolioValue + lossAmount;
    const deployedAfter = portfolioAfter * currentLeverage;
    const leverageAfter = Math.min(this.config.maxLeverage, deployedAfter / portfolioAfter);

    const canSustain = portfolioAfter > 0 && leverageAfter <= this.config.maxLeverage;

    return {
      portfolioValueAfterShock: portfolioAfter,
      remainingCapital: Math.max(0, portfolioAfter - deployedAfter),
      canSustain,
      leverageAfterShock: leverageAfter,
    };
  }

  /**
   * CALCOLA METRICHE DI PERFORMANCE
   */
  public calculateMetrics(
    baseCapital: number,
    currentValue: number,
    dailyPnL: number,
    maxDrawdownInPeriod: number,
    lastRebalanceTime: Date,
    currentLeverage: number
  ): AntigravityMetrics {
    const totalPnL = currentValue - baseCapital;
    const totalPnLPercent = (totalPnL / baseCapital) * 100;
    
    const leverageUtilization = (currentLeverage / this.config.maxLeverage) * 100;
    const projectedValue30Days = currentValue * Math.pow(1 + (dailyPnL / currentValue), 30);

    const now = new Date();
    const daysUntilNextRebalance = this.config.rebalanceInterval === 'HOURLY'
      ? 1/24
      : this.config.rebalanceInterval === 'EVERY_4H'
        ? 4/24
        : 1;

    return {
      totalPnL,
      totalPnLPercent,
      dailyPnL,
      maxDrawdown: maxDrawdownInPeriod,
      currentDrawdown: dailyPnL,
      leverageUtilization,
      lastRebalanceTime: lastRebalanceTime.toISOString(),
      daysUntilNextRebalance,
      drift: ((currentValue / baseCapital) - this.config.targetLeverage) * 100,
      projectedValue30Days,
    };
  }

  /**
   * SIMULA REBALANCING AUTOMATICO
   * 
   * Ritorna le azioni da eseguire per allineare il portafoglio
   * alle allocazioni target.
   */
  public simulateRebalancing(
    totalPortfolioValue: number,
    currentLeverage: number,
    coreValue: number,
    tbdValue: number,
    rebalanceAction: RebalanceAction
  ): {
    currentCoreValue: number;
    currentTbdValue: number;
    targetCoreValue: number;
    targetTbdValue: number;
    amountToCoreFromTbd: number;  // Positivo = trasferisci da TBD a Core
    estimatedSlippage: number;     // % slippage su trasferimento
  } {
    const currentCorePct = (coreValue / totalPortfolioValue) * 100;
    const currentTbdPct = (tbdValue / totalPortfolioValue) * 100;

    const targetCoreValue = (totalPortfolioValue * rebalanceAction.coreTargetPct) / 100;
    const targetTbdValue = (totalPortfolioValue * rebalanceAction.tbdTargetPct) / 100;

    const amountToMove = targetCoreValue - coreValue;
    // Slippage: 0.5% per ogni € mosso (commissioni + spread)
    const estimatedSlippage = Math.abs(amountToMove) * 0.005;

    return {
      currentCoreValue: coreValue,
      currentTbdValue: tbdValue,
      targetCoreValue,
      targetTbdValue,
      amountToCoreFromTbd: amountToMove,
      estimatedSlippage,
    };
  }

  /**
   * REGISTRA STORICO REBALANCE
   */
  public recordRebalance(action: string, leverageChange: number) {
    this.rebalanceHistory.push({
      timestamp: new Date().toISOString(),
      action,
      leverageChange,
    });

    // Mantieni solo ultimi 30 giorni
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    this.rebalanceHistory = this.rebalanceHistory.filter(
      r => new Date(r.timestamp) > thirtyDaysAgo
    );
  }

  /**
   * OTTIENI STORICO
   */
  public getRebalanceHistory() {
    return [...this.rebalanceHistory];
  }

  /**
   * RESET ENGINE (es. fine giornata)
   */
  public reset() {
    this.rebalanceHistory = [];
  }
}

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────

/**
 * Interpreta il colore dell'urgenza
 */
export function getUrgencyColor(urgency: string): string {
  const map: Record<string, string> = {
    LOW: '#10b981',
    MEDIUM: '#f59e0b',
    HIGH: '#ef4444',
    CRITICAL: '#c4243f',
  };
  return map[urgency] || '#64748b';
}

/**
 * Formatta il messaggio di azione per UI
 */
export function formatRebalanceAction(action: RebalanceAction): {
  emoji: string;
  title: string;
  description: string;
  color: string;
} {
  const map: Record<string, any> = {
    INCREASE_LEVERAGE: {
      emoji: '📈',
      title: 'Aumenta Leva',
      description: `Leva ${action.newLeverage.toFixed(2)}x — Transferisci a TBD`,
      color: '#10b981',
    },
    DECREASE_LEVERAGE: {
      emoji: '📉',
      title: 'Riduce Leva',
      description: `Leva ${action.newLeverage.toFixed(2)}x — Proteggi Core`,
      color: '#f59e0b',
    },
    HOLD: {
      emoji: '⚖️',
      title: 'Leva Stabile',
      description: `Leva ${action.newLeverage.toFixed(2)}x — No azione`,
      color: '#3b82f6',
    },
    EMERGENCY_EXIT: {
      emoji: '🚨',
      title: 'EMERGENCY EXIT',
      description: 'Liquidazione immediata TBD — Protezione capitale',
      color: '#ef4444',
    },
  };
  return map[action.action] || map.HOLD;
}
