import type { TbdSignalStatus } from './tbd-signal-status';

/**
 * CAPITAL ALPHA — TRADING BY DAY ENGINE v2 (Hunter Mode)
 * 
 * Principi:
 * - NO target return giornaliero. Il mercato decide quando offrire un setup.
 * - Risk Budget: max 100€ perdita/giorno, max 50€/trade.
 * - Qualità minima: |Z-score| ≥ 2.0, Volume Sigma ≥ 1.5, R/R ≥ 2.0.
 * - Max 3 trade/giorno. Streak di 2 loss → congelamento 24h.
 * - Sizing risk-based: rischi 1% del capitale TBD per trade (max 30% del bucket).
 * - Profitto atteso minimo: 5€ (anche piccoli profitto vanno bene).
 */

// ─── TIPI PUBBLICI ────────────────────────────────────────────────────────

export type TbdDirection = 'BUY' | 'SELL';

export type TbdDayStatus =
  | 'STANDBY'
  | 'ACTIVE'
  | 'COMPLETED_PROFIT'
  | 'COMPLETED_LOSS'
  | 'CIRCUIT_STREAK';

export interface TradingEngineConfig {
  totalCapital: number;            // Capitale allocato al TBD (base + boost)
  dailyRiskBudget: number;         // Max perdita giornaliera assoluta (€)
  maxLossPerTrade: number;         // Max perdita per singolo trade (€)
  activeSlots: number;             // Max trade simultanei/giorno
  preTriggerBufferPercent: number; // 0.3% di buffer pre-alert
  minRiskRewardRatio: number;      // 2.0 minimo R/R
  minZScore: number;               // |Z| ≥ 2.0
  minVolumeSigma: number;          // Volume ≥ 1.5 sigma
  maxTradesPerDay: number;         // 3 max
  consecutiveLossCircuit: number;  // 2 loss di fila → stop
  minExpectedProfit: number;       // 5.00 € minimo atteso per trade
  maxPositionPct: number;          // 30% del capitale TBD per trade
}

export interface MarketDataSnapshot {
  asset: string;
  currentPrice: number;
  atrH1: number;
  zScoreH1: number;
  chandeMomentumH1: number;
  volumeSpike: boolean;
  volumeSigma: number;             // NUOVO: deviazioni standard del volume
  bollingerSqueeze?: boolean;
  assetType: 'CRYPTO' | 'STOCK';
}

export interface TbdSignal {
  id: string;
  asset: string;
  assetType: 'CRYPTO' | 'STOCK';
  direction: TbdDirection;
  timeframe: 'H1' | 'H4';
  preTriggerPx: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  allocatedSize: number;
  expectedPnL: number;
  maxLoss: number;
  riskReward: number;
  qualityScore: number;            // NUOVO: 0-100
  status: TbdSignalStatus;
  triggeredAt?: string;
  closedAt?: string;
  realizedPnL?: number;
  timestamp: string;
}

export interface TradingDayLog {
  id: string;
  date: string;            // YYYY-MM-DD
  startingCash: number;
  endingCash: number;
  realizedPnL: number;
  targetReached: boolean;  // Ora: true se PnL ≥ 1.5× dailyRiskBudget (soft cap)
  totalTrades: number;
  winningTrades: number;
  status: TbdDayStatus;
  signals: TbdSignal[];
  createdAt: string;
  updatedAt: string;
}

export interface CircuitBreakerResult {
  stopTrading: boolean;
  reason: 'BUDGET' | 'STREAK' | 'MAX_TRADES' | 'PROFIT_CAP' | 'NONE';
  message: string;
}

// ─── CONFIGURAZIONE DEFAULT (Hunter Mode) ────────────────────────────────────

export const DEFAULT_CONFIG: TradingEngineConfig = {
  totalCapital: 5000.00,
  dailyRiskBudget: 100.00,
  maxLossPerTrade: 50.00,
  activeSlots: 3,
  preTriggerBufferPercent: 0.3,
  minRiskRewardRatio: 2.0,
  minZScore: 2.0,
  minVolumeSigma: 1.5,
  maxTradesPerDay: 3,
  consecutiveLossCircuit: 2,
  minExpectedProfit: 5.00,
  maxPositionPct: 30.0,
};

// ─── ENGINE ──────────────────────────────────────────────────────────

export class TradingByDayEngine {
  private config: TradingEngineConfig;

  constructor(config: TradingEngineConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  /**
   * SCANNER H1 — Hunter Mode
   * Caccia solo setup estremi con conferma volume. Mean-reversion.
   * Ritorna segnali ordinati per quality score (top = migliore).
   */
  public scanMarketForSpeculation(
    marketData: MarketDataSnapshot[],
    availableCash: number,
    todayLog: TradingDayLog
  ): TbdSignal[] {
    // 1. Filtro qualità: Z-score estremo + volume confermato
    const rawSetups = marketData.filter(m => {
      const z = Math.abs(m.zScoreH1);
      const volOk = m.volumeSpike && m.volumeSigma >= this.config.minVolumeSigma;
      return z >= this.config.minZScore && volOk;
    });

    if (rawSetups.length === 0) return [];

    // 2. Costruisci segnali con quality score
    const scored: TbdSignal[] = [];

    for (const asset of rawSetups) {
      const direction: TbdDirection = asset.zScoreH1 < 0 ? 'BUY' : 'SELL';
      const entryPrice = asset.currentPrice;
      const atr = asset.atrH1;

      if (atr <= 0 || entryPrice <= 0) continue;

      // Stop Loss: 1.5× ATR (asimmetrico ma semplice per H1)
      const stopLoss = direction === 'BUY'
        ? entryPrice - (atr * 1.5)
        : entryPrice + (atr * 1.5);

      const lossPct = Math.abs(entryPrice - stopLoss) / entryPrice;
      if (lossPct === 0) continue;

      // Take Profit: min R/R 2.0, dinamico fino a 3.5 in base a |Z|
      const zMag = Math.abs(asset.zScoreH1);
      const rrMultiplier = Math.min(
        3.5,
        Math.max(this.config.minRiskRewardRatio, 2.0 + (zMag - 2.0) * 0.6)
      );

      const tpPct = lossPct * rrMultiplier;
      const takeProfit = direction === 'BUY'
        ? entryPrice * (1 + tpPct)
        : entryPrice * (1 - tpPct);

      // Quality Score: 50% Z-score, 50% R/R
      const zQuality = Math.min(50, (zMag / 3.5) * 50);
      const rrQuality = Math.min(50, (rrMultiplier / 4.0) * 50);
      const qualityScore = Math.round(zQuality + rrQuality);

      // Sizing: risk-based fixed
      // Rischi il minore tra maxLossPerTrade e 1% del capitale TBD
      const riskBudgetPerTrade = Math.min(
        this.config.maxLossPerTrade,
        this.config.totalCapital * 0.01
      );
      const maxSize = this.config.totalCapital * (this.config.maxPositionPct / 100);
      const allocatedSize = Math.min(riskBudgetPerTrade / lossPct, maxSize, availableCash);

      // Minimo operativo
      if (allocatedSize < 200) continue;

      const expectedPnL = allocatedSize * tpPct;
      if (expectedPnL < this.config.minExpectedProfit) continue;

      const maxLoss = allocatedSize * lossPct;

      // Pre-Trigger: avvicinati al prezzo di mercato
      const bufferPct = this.config.preTriggerBufferPercent / 100;
      const preTriggerPx = direction === 'BUY'
        ? entryPrice * (1 + bufferPct)   // sopra entry (mercato scende verso buy)
        : entryPrice * (1 - bufferPct);  // sotto entry (mercato sale verso sell)

      scored.push({
        id: `${asset.asset}-${direction}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        asset: asset.asset,
        assetType: asset.assetType,
        direction,
        timeframe: 'H1',
        preTriggerPx: Number(preTriggerPx.toFixed(4)),
        entryPrice: Number(entryPrice.toFixed(4)),
        stopLoss: Number(stopLoss.toFixed(4)),
        takeProfit: Number(takeProfit.toFixed(4)),
        allocatedSize: Number(allocatedSize.toFixed(2)),
        expectedPnL: Number(expectedPnL.toFixed(2)),
        maxLoss: Number(maxLoss.toFixed(2)),
        riskReward: Number(rrMultiplier.toFixed(2)),
        qualityScore,
        status: 'PRE_ALERT',
        timestamp: new Date().toISOString(),
      });
    }

    // 3. Ordina per quality score discendente, prendi top activeSlots
    scored.sort((a, b) => b.qualityScore - a.qualityScore);
    return scored.slice(0, this.config.activeSlots);
  }

  /**
   * CIRCUIT BREAKER GIORNALIERO EVOLUTO
   * Budget, streak, max trades, profit cap.
   */
  public evaluateDailyCircuitBreaker(
    log: TradingDayLog
  ): CircuitBreakerResult {
    // A. Max trades
    if (log.totalTrades >= this.config.maxTradesPerDay) {
      return {
        stopTrading: true,
        reason: 'MAX_TRADES',
        message: `🚫 MAX TRADES: ${log.totalTrades}/${this.config.maxTradesPerDay} raggiunti. Motore in standby fino a domani.`,
      };
    }

    // B. Streak di loss consecutive
    const recent = log.signals.slice(-this.config.consecutiveLossCircuit);
    if (
      recent.length >= this.config.consecutiveLossCircuit &&
      recent.every(s => (s.realizedPnL ?? 0) < 0)
    ) {
      return {
        stopTrading: true,
        reason: 'STREAK',
        message: `🥶 STREAK BREAKER: ${this.config.consecutiveLossCircuit} loss consecutive. Congelamento 24h per reset psicologico.`,
      };
    }

    // C. Budget perso
    if (log.realizedPnL <= -this.config.dailyRiskBudget) {
      return {
        stopTrading: true,
        reason: 'BUDGET',
        message: `🛑 DAILY BUDGET BURNED: ${log.realizedPnL.toFixed(2)}€ / -${this.config.dailyRiskBudget}€. Stop loss protettivo.`,
      };
    }

    // D. Profit cap soft (proteggi guadagni)
    const profitCap = this.config.dailyRiskBudget * 1.5;
    if (log.realizedPnL >= profitCap) {
      return {
        stopTrading: true,
        reason: 'PROFIT_CAP',
        message: `🎯 PROFIT CAP: +${log.realizedPnL.toFixed(2)}€. Capitale protetto, si ricomincia domani.`,
      };
    }

    // E. Attivo
    const remainingTrades = this.config.maxTradesPerDay - log.totalTrades;
    const remainingBudget = this.config.dailyRiskBudget + log.realizedPnL; // log.realizedPnL può essere negativo
    return {
      stopTrading: false,
      reason: 'NONE',
      message: `✅ Hunter attivo. Trade rimasti: ${remainingTrades}. Risk budget residuo: ${Math.max(0, remainingBudget).toFixed(2)}€.`,
    };
  }

  /**
   * AGGIORNA LOG GIORNALIERO CON TRADE CHIUSO
   */
  public updateDayLog(log: TradingDayLog, closedSignal: TbdSignal): TradingDayLog {
    const pnl = closedSignal.realizedPnL ?? 0;
    const updated: TradingDayLog = {
      ...log,
      realizedPnL: log.realizedPnL + pnl,
      totalTrades: log.totalTrades + 1,
      winningTrades: pnl > 0 ? log.winningTrades + 1 : log.winningTrades,
      updatedAt: new Date().toISOString(),
    };

    const breaker = this.evaluateDailyCircuitBreaker(updated);

    updated.targetReached = breaker.reason === 'PROFIT_CAP';
    updated.endingCash = this.config.totalCapital + updated.realizedPnL;

    if (breaker.reason === 'PROFIT_CAP') {
      updated.status = 'COMPLETED_PROFIT';
    } else if (breaker.reason === 'BUDGET' || breaker.reason === 'STREAK') {
      updated.status = 'COMPLETED_LOSS';
    } else if (breaker.reason === 'MAX_TRADES') {
      updated.status = 'COMPLETED_PROFIT'; // neutrale, fine giornata
    } else {
      updated.status = 'ACTIVE';
    }

    return updated;
  }

  /**
   * LOG VUOTO
   */
  public createEmptyDayLog(date: string): TradingDayLog {
    return {
      id: `tbd-${date}`,
      date,
      startingCash: this.config.totalCapital,
      endingCash: this.config.totalCapital,
      realizedPnL: 0,
      targetReached: false,
      totalTrades: 0,
      winningTrades: 0,
      status: 'STANDBY',
      signals: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * VALIDA LIQUIDITÀ PER NUOVO SEGNALE
   */
  public validateLiquidityForNewSignal(
    activeSignals: Array<{ allocatedSize: number; status: string }>,
    newSignalSize: number
  ): {
    canAdd: boolean;
    reason: string;
    totalExposed: number;
    availableLiquidity: number;
    utilizationPct: number;
  } {
    const activeCount = activeSignals.filter(s =>
      ['PRE_ALERT', 'ACTIVE', 'TRIGGERED'].includes(s.status)
    ).length;

    const totalAllocated = activeSignals.reduce((sum, s) => sum + s.allocatedSize, 0);
    const availableLiquidity = this.config.totalCapital - totalAllocated;
    const utilizationPct = (totalAllocated / this.config.totalCapital) * 100;

    const hasSlotAvailable = activeCount < this.config.activeSlots;
    const hasLiquidityForNew = newSignalSize <= availableLiquidity;
    const utilizationOk = (totalAllocated + newSignalSize) <= this.config.totalCapital;

    const canAdd = hasSlotAvailable && hasLiquidityForNew && utilizationOk;

    let reason = '';
    if (!hasSlotAvailable) {
      reason = `❌ Slot pieno: ${activeCount}/${this.config.activeSlots} attivi`;
    } else if (!hasLiquidityForNew) {
      reason = `❌ Liquidità insufficiente: serve ${newSignalSize.toFixed(0)}€, disponibili ${availableLiquidity.toFixed(0)}€`;
    } else if (!utilizationOk) {
      reason = `❌ Superamento limite capitale totale`;
    } else {
      reason = `✅ Slot e liquidità disponibili`;
    }

    return {
      canAdd,
      reason,
      totalExposed: totalAllocated,
      availableLiquidity,
      utilizationPct,
    };
  }

  /**
   * FILTRA SEGNALI PER LIQUIDITÀ
   */
  public filterSignalsByLiquidity(signals: TbdSignal[]): {
    valid: TbdSignal[];
    pending: TbdSignal[];
    totalLiquidityUsed: number;
  } {
    const valid: TbdSignal[] = [];
    const pending: TbdSignal[] = [];
    let totalUsed = 0;

    for (const signal of signals) {
      const newTotal = totalUsed + signal.allocatedSize;
      if (valid.length < this.config.activeSlots && newTotal <= this.config.totalCapital) {
        valid.push(signal);
        totalUsed += signal.allocatedSize;
      } else {
        pending.push(signal);
      }
    }

    return { valid, pending, totalLiquidityUsed: totalUsed };
  }

  /**
   * STRESS TEST: cosa succede se un segnale viene triggerato?
   */
  public stressTestSignalTrigger(
    currentSignals: TbdSignal[],
    triggeringSignal: TbdSignal
  ): {
    maxDrawdownPercent: number;
    remainingCash: number;
    canHandle: boolean;
    message: string;
  } {
    const activeSignals = currentSignals.filter(s =>
      ['ACTIVE', 'TRIGGERED'].includes(s.status)
    );

    const activeAllocated = activeSignals.reduce((sum, s) => sum + s.allocatedSize, 0);
    const activeMaxLoss = activeSignals.reduce((sum, s) => sum + s.maxLoss, 0);
    const triggerMaxLoss = triggeringSignal.maxLoss;

    const totalMaxLoss = activeMaxLoss + triggerMaxLoss;
    const totalExposed = activeAllocated + triggeringSignal.allocatedSize;

    const maxDrawdownPercent = (totalMaxLoss / this.config.totalCapital) * 100;
    const remainingCash = this.config.totalCapital - totalExposed;
    const riskLimit = this.config.dailyRiskBudget;

    const canHandle = totalMaxLoss <= riskLimit;

    let message = '';
    if (canHandle) {
      message = `✅ Drawdown massimo scenario worst-case: -${triggerMaxLoss.toFixed(2)}€ (${maxDrawdownPercent.toFixed(2)}% del bucket)`;
    } else {
      message = `❌ RISCHIO ECCESSIVO: Perdita totale potenziale ${totalMaxLoss.toFixed(2)}€ supera il daily budget ${riskLimit.toFixed(2)}€`;
    }

    return {
      maxDrawdownPercent,
      remainingCash,
      canHandle,
      message,
    };
  }
}

// ─── HELPER UI ─────────────────────────────────────────────────────────

export interface LiquidityMetrics {
  totalCapital: number;
  allocatedTotal: number;
  availableLiquidity: number;
  utilizationPct: number;
  activeSignalCount: number;
  canAddMore: boolean;
  maxCapacityReached: boolean;
  warningLevel: 'NORMAL' | 'CAUTION' | 'CRITICAL';
}

export function calculateLiquidityMetrics(
  config: { totalCapital: number; activeSlots: number },
  signals: TbdSignal[]
): LiquidityMetrics {
  const activeSignals = signals.filter(s =>
    ['PRE_ALERT', 'ACTIVE', 'TRIGGERED'].includes(s.status)
  );

  const allocatedTotal = activeSignals.reduce((sum, s) => sum + s.allocatedSize, 0);
  const availableLiquidity = config.totalCapital - allocatedTotal;
  const utilizationPct = (allocatedTotal / config.totalCapital) * 100;
  const activeCount = activeSignals.length;

  const sizePerSlot = config.totalCapital / config.activeSlots;
  const canAddMore = activeCount < config.activeSlots && availableLiquidity >= sizePerSlot * 0.5;
  const maxCapacityReached = activeCount >= config.activeSlots || utilizationPct >= 95;

  let warningLevel: 'NORMAL' | 'CAUTION' | 'CRITICAL';
  if (utilizationPct >= 90) warningLevel = 'CRITICAL';
  else if (utilizationPct >= 75) warningLevel = 'CAUTION';
  else warningLevel = 'NORMAL';

  return {
    totalCapital: config.totalCapital,
    allocatedTotal,
    availableLiquidity: Math.max(0, availableLiquidity),
    utilizationPct,
    activeSignalCount: activeCount,
    canAddMore,
    maxCapacityReached,
    warningLevel,
  };
}

export function getLiquidityColor(warningLevel: 'NORMAL' | 'CAUTION' | 'CRITICAL'): string {
  return { NORMAL: '#10b981', CAUTION: '#f59e0b', CRITICAL: '#ef4444' }[warningLevel];
}

export function getLiquidityWarningText(metrics: LiquidityMetrics): string {
  if (metrics.warningLevel === 'NORMAL') {
    return `Liquidità ottimale: ${metrics.availableLiquidity.toFixed(0)}€ disponibili`;
  } else if (metrics.warningLevel === 'CAUTION') {
    return `⚠️ Liquidità scarsa: ${metrics.availableLiquidity.toFixed(0)}€ rimasti`;
  } else {
    return `🚨 Liquidità CRITICA: ${metrics.availableLiquidity.toFixed(0)}€ rimasti. Hunter in standby`;
  }
}

