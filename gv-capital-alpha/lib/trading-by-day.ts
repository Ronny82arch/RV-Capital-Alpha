/**
 * CAPITAL ALPHA — TRADING BY DAY ENGINE
 * Liquidità: 5.000 € isolata | Target: 50 € netti/giorno | Max Loss: 100 €
 * Esecuzione: 4 cluster simultanei | Pre-Trigger: 0.6% prima dell'ingresso
 */

// ─── TIPI PUBBLICI ────────────────────────────────────────────────────────────

export type TbdSignalStatus =
  | 'PRE_ALERT'
  | 'ACTIVE'
  | 'TRIGGERED'
  | 'CLOSED_TP'
  | 'CLOSED_SL'
  | 'CANCELLED';

export type TbdDirection = 'BUY' | 'SELL';

export type TbdDayStatus =
  | 'STANDBY'
  | 'ACTIVE'
  | 'COMPLETED_PROFIT'
  | 'COMPLETED_LOSS';

export interface TradingEngineConfig {
  totalCapital: number;            // 5000 €
  dailyTarget: number;             // 50 €
  maxTotalRiskPercent: number;     // 2.0 % → max 100 € perdita/giorno
  activeSlots: number;             // 4 cluster simultanei
  preTriggerBufferPercent: number; // 0.6 % di anticipo notifica
  minRiskRewardRatio: number;      // 1.5 minimo R/R
}

export interface MarketDataSnapshot {
  asset: string;
  currentPrice: number;
  atrH1: number;           // Average True Range orario
  zScoreH1: number;        // Z-Score su serie oraria (≤ -2 = ipervenduto, ≥ +2 = ipercomprato)
  chandeMomentumH1: number;// CMO su 14 periodi orari [-100, +100]
  volumeSpike: boolean;    // Anomalia volume istituzionale
  bollingerSqueeze?: boolean; // Squeeze Bollinger Bands
  assetType: 'CRYPTO' | 'STOCK';
}

export interface TbdSignal {
  id: string;
  asset: string;
  assetType: 'CRYPTO' | 'STOCK';
  direction: TbdDirection;
  timeframe: 'H1' | 'H4';
  preTriggerPx: number;    // Prezzo di pre-allerta (0.6% prima dell'entry)
  entryPrice: number;      // Prezzo limite di ingresso
  stopLoss: number;        // SL calcolato su ATR × 1.5
  takeProfit: number;      // TP calcolato per raggiungere targetPerSlot
  allocatedSize: number;   // Capitale esposto per questo slot (€)
  expectedPnL: number;     // Profitto atteso se TP (€)
  maxLoss: number;         // Perdita massima se SL (€)
  riskReward: number;      // Rapporto R/R
  status: TbdSignalStatus;
  triggeredAt?: string;
  closedAt?: string;
  realizedPnL?: number;
  timestamp: string;
}

export interface TradingDayLog {
  id: string;
  date: string;            // YYYY-MM-DD
  startingCash: number;    // 5000.00
  endingCash: number;
  realizedPnL: number;     // Somma algebrica trade del giorno
  targetReached: boolean;  // true se PnL >= 50 €
  totalTrades: number;
  winningTrades: number;
  status: TbdDayStatus;
  signals: TbdSignal[];
  createdAt: string;
  updatedAt: string;
}

// ─── CONFIGURAZIONE DEFAULT ────────────────────────────────────────────────────

export const DEFAULT_CONFIG: TradingEngineConfig = {
  totalCapital: 5000.00,
  dailyTarget: 50.00,
  maxTotalRiskPercent: 2.0,
  activeSlots: 4,
  preTriggerBufferPercent: 0.6,
  minRiskRewardRatio: 1.5,
};

// ─── ENGINE ───────────────────────────────────────────────────────────────────

export class TradingByDayEngine {
  private config: TradingEngineConfig;

  constructor(config: TradingEngineConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  /**
   * MATRICE DI FRAMMENTAZIONE CLUSTER
   * Divide il capitale e il target in 4 slot bilanciati.
   */
  public calculateClusterAllocation() {
    const sizePerSlot   = this.config.totalCapital / this.config.activeSlots; // 1250 €
    const targetPerSlot = this.config.dailyTarget  / this.config.activeSlots; // 12.50 €
    const maxRiskTotal  = this.config.totalCapital * (this.config.maxTotalRiskPercent / 100); // 100 €
    const maxRiskPerSlot = maxRiskTotal / this.config.activeSlots; // 25 €

    return { sizePerSlot, targetPerSlot, maxRiskTotal, maxRiskPerSlot };
  }

  /**
   * SCANNER SPECULATIVO H1
   * Identifica setup Long e Short su base statistica (Z-Score + CMO + volume).
   * Calcola size sicura, pre-trigger e R/R minimo enforced.
   * Divide dinamicamente il capitale disponibile per il numero di segnali trovati, sfruttando tutta la liquidità.
   */
  public scanMarketForSpeculation(marketData: MarketDataSnapshot[], availableCash?: number): TbdSignal[] {
    const validSetups: { asset: MarketDataSnapshot, direction: TbdDirection }[] = [];

    // 1. Identifica tutti i setup validi
    for (const asset of marketData) {
      const isBullishSetup =
        (asset.zScoreH1 <= -1.2 && (asset.volumeSpike || asset.bollingerSqueeze)) ||
        (asset.zScoreH1 <= -1.8 && asset.chandeMomentumH1 > -65);

      const isBearishSetup =
        (asset.zScoreH1 >= 1.2 && (asset.volumeSpike || asset.bollingerSqueeze)) ||
        (asset.zScoreH1 >= 1.8 && asset.chandeMomentumH1 < 65);

      if (isBullishSetup) {
        validSetups.push({ asset, direction: 'BUY' });
      } else if (isBearishSetup) {
        validSetups.push({ asset, direction: 'SELL' });
      }
    }

    if (validSetups.length === 0) return [];

    // 2. Calcola le allocazioni dinamiche (Tranche Allocation: max 33% della liquidità per singola scansione oraria)
    const rawCash = availableCash !== undefined ? availableCash : this.config.totalCapital;
    const cashToUse = rawCash * 0.33; 
    const activeSetupsCount = validSetups.length;
    const sizePerSlot = cashToUse / activeSetupsCount;
    
    // Il rischio massimo totale per la giornata viene diviso sui setup attuali
    const maxRiskTotal = this.config.totalCapital * (this.config.maxTotalRiskPercent / 100);
    const maxRiskPerSlot = maxRiskTotal / activeSetupsCount;

    const signals: TbdSignal[] = [];

    // 3. Costruisci i segnali allocando il capitale
    for (const setup of validSetups) {
      const asset = setup.asset;
      const direction = setup.direction;
      const entryPrice = asset.currentPrice;
      const atrBuffer  = asset.atrH1 * 1.5;

      // Stop Loss asimmetrico basato su ATR reale
      const stopLoss   = direction === 'BUY'
        ? entryPrice - atrBuffer
        : entryPrice + atrBuffer;

      const lossPercentage = Math.abs(entryPrice - stopLoss) / entryPrice;
      if (lossPercentage === 0) continue;

      // Size sicura: garantisce che la perdita massima non superi maxRiskPerSlot
      const safeSizeForRisk = maxRiskPerSlot / lossPercentage;
      const allocatedSize   = Math.min(sizePerSlot, safeSizeForRisk);

      // Moltiplicatore R/R dinamico basato sull'ampiezza dello Z-Score (più estremo = TP più ampio)
      const zMagnitude = Math.abs(asset.zScoreH1);
      const dynamicRrMultiplier = Math.min(3.5, Math.max(1.5, 1.5 + (zMagnitude - 1.2) * 0.8));
      
      const effectiveProfitPct = lossPercentage * dynamicRrMultiplier;

      const takeProfit = direction === 'BUY'
        ? entryPrice * (1 + effectiveProfitPct)
        : entryPrice * (1 - effectiveProfitPct);

      // Pre-Trigger: avvisa prima che tocchi l'entry
      const bufferPct   = this.config.preTriggerBufferPercent / 100;
      const preTriggerPx = direction === 'BUY'
        ? entryPrice * (1 - bufferPct)   // avvisa sotto il prezzo attuale (rimbalzo verso entry)
        : entryPrice * (1 + bufferPct);  // avvisa sopra il prezzo attuale (short)

      const expectedPnL = allocatedSize * effectiveProfitPct;
      const maxLoss     = allocatedSize * lossPercentage;
      const riskReward  = Number(dynamicRrMultiplier.toFixed(2));

      signals.push({
        id:            `${asset.asset}-${direction}-${Date.now()}`,
        asset:         asset.asset,
        assetType:     asset.assetType,
        direction,
        timeframe:     'H1',
        preTriggerPx:  Number(preTriggerPx.toFixed(4)),
        entryPrice:    Number(entryPrice.toFixed(4)),
        stopLoss:      Number(stopLoss.toFixed(4)),
        takeProfit:    Number(takeProfit.toFixed(4)),
        allocatedSize: Number(allocatedSize.toFixed(2)),
        expectedPnL:   Number(expectedPnL.toFixed(2)),
        maxLoss:       Number(maxLoss.toFixed(2)),
        riskReward,
        status:        'PRE_ALERT',
        timestamp:     new Date().toISOString(),
      });
    }

    return signals;
  }

  /**
   * CIRCUIT BREAKER GIORNALIERO
   * Blocca nuovi segnali se target raggiunto o max loss toccata.
   */
  public evaluateDailyCircuitBreaker(
    currentRealizedPnL: number
  ): { stopTrading: boolean; reason: 'TARGET' | 'MAX_LOSS' | 'NONE'; message: string } {
    if (currentRealizedPnL >= this.config.dailyTarget) {
      return {
        stopTrading: true,
        reason: 'TARGET',
        message: `🎯 TARGET RAGGIUNTO +${currentRealizedPnL.toFixed(2)}€ / ${this.config.dailyTarget}€. Motore congelato fino al reset di domani.`,
      };
    }

    const maxLossThreshold = -(this.config.totalCapital * (this.config.maxTotalRiskPercent / 100));
    if (currentRealizedPnL <= maxLossThreshold) {
      return {
        stopTrading: true,
        reason: 'MAX_LOSS',
        message: `🛑 MAX LOSS RAGGIUNTA ${currentRealizedPnL.toFixed(2)}€ (limite ${maxLossThreshold.toFixed(2)}€). Operatività inibita fino a domani.`,
      };
    }

    const remaining = this.config.dailyTarget - currentRealizedPnL;
    return {
      stopTrading: false,
      reason: 'NONE',
      message: `✅ Motore attivo. Scansione cluster in corso. Mancano ${remaining.toFixed(2)}€ al target.`,
    };
  }

  /**
   * CALCOLO P&L GIORNALIERO AGGIORNATO
   * Aggiunge un trade chiuso al log del giorno.
   */
  public updateDayLog(log: TradingDayLog, closedSignal: TbdSignal): TradingDayLog {
    const pnl = closedSignal.realizedPnL ?? 0;
    const updated: TradingDayLog = {
      ...log,
      realizedPnL:   log.realizedPnL + pnl,
      totalTrades:   log.totalTrades + 1,
      winningTrades: pnl > 0 ? log.winningTrades + 1 : log.winningTrades,
      updatedAt:     new Date().toISOString(),
    };

    const breaker = this.evaluateDailyCircuitBreaker(updated.realizedPnL);
    updated.targetReached = breaker.reason === 'TARGET';
    updated.endingCash    = this.config.totalCapital + updated.realizedPnL;
    updated.status        = breaker.reason === 'TARGET'
      ? 'COMPLETED_PROFIT'
      : breaker.reason === 'MAX_LOSS'
        ? 'COMPLETED_LOSS'
        : 'ACTIVE';

    return updated;
  }

  /**
   * CREA LOG GIORNALIERO VUOTO
   */
  public createEmptyDayLog(date: string): TradingDayLog {
    return {
      id:            `tbd-${date}`,
      date,
      startingCash:  this.config.totalCapital,
      endingCash:    this.config.totalCapital,
      realizedPnL:   0,
      targetReached: false,
      totalTrades:   0,
      winningTrades: 0,
      status:        'STANDBY',
      signals:       [],
      createdAt:     new Date().toISOString(),
      updatedAt:     new Date().toISOString(),
    };
  }

  /**
   * VALIDA SE UN NUOVO SEGNALE PUÒ STARE ENTRO LA LIQUIDITÀ
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
      reason = `❌ Liquidità insufficiente: serve ${newSignalSize}€, disponibili ${availableLiquidity.toFixed(2)}€`;
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
   * FILTRA SEGNALI: Mantiene solo quelli che rientrano nel limite di liquidità
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
   * CALCULA STRESS TEST: Cosa succede se un segnale viene triggato?
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
    const activeAllocated = currentSignals.reduce((sum, s) => sum + s.allocatedSize, 0);
    const maxLossFromActive = currentSignals.reduce((sum, s) => sum + s.maxLoss, 0);
    const maxLossFromTrigger = triggeringSignal.maxLoss;
    
    const totalMaxLoss = maxLossFromActive + maxLossFromTrigger;
    const totalExposed = activeAllocated + triggeringSignal.allocatedSize;
    
    const maxDrawdownPercent = (totalMaxLoss / this.config.totalCapital) * 100;
    const remainingCash = this.config.totalCapital - totalMaxLoss;
    const riskLimit = (this.config.totalCapital * this.config.maxTotalRiskPercent) / 100;
    
    const canHandle = totalMaxLoss <= riskLimit;

    let message = '';
    if (canHandle) {
      message = `✅ Drawdown massimo: -${maxLossFromTrigger.toFixed(2)}€ (${maxDrawdownPercent.toFixed(2)}% del capital)`;
    } else {
      message = `❌ RISCHIO ECCESSIVO: Perdita totale potenziale ${totalMaxLoss.toFixed(2)}€ supera limite ${riskLimit.toFixed(2)}€`;
    }

    return {
      maxDrawdownPercent,
      remainingCash,
      canHandle,
      message,
    };
  }
}

// ─── HELPER FUNCTIONS PER UI ──────────────────────────────────────

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
  if (utilizationPct >= 90) {
    warningLevel = 'CRITICAL';
  } else if (utilizationPct >= 75) {
    warningLevel = 'CAUTION';
  } else {
    warningLevel = 'NORMAL';
  }

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
  const map = {
    NORMAL: '#10b981',
    CAUTION: '#f59e0b',
    CRITICAL: '#ef4444',
  };
  return map[warningLevel];
}

export function getLiquidityWarningText(metrics: LiquidityMetrics): string {
  if (metrics.warningLevel === 'NORMAL') {
    return `Liquidità ottimale: ${metrics.availableLiquidity.toFixed(0)}€ disponibili`;
  } else if (metrics.warningLevel === 'CAUTION') {
    return `⚠️ Liquidità scarsa: ${metrics.availableLiquidity.toFixed(0)}€ rimasti`;
  } else {
    return `🚨 Liquidità CRITICA: ${metrics.availableLiquidity.toFixed(0)}€ rimasti. Nuovi segnali in standby`;
  }
}
