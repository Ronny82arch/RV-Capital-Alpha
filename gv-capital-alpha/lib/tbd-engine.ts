// lib/tbd-engine.ts
// ─── TRADING BY DAY ENGINE ───────────────────────────────────────────────────
// Genera segnali operativi per colmare il gap giornaliero verso il target annuale.
// Integrato con Antigravity (PROTECTION/COOLDOWN blocca o riduce) e Quontest score.

export interface TBDConfig {
  targetAnnualReturn: number;   // es. 0.25
  tradingDaysPerYear: number;   // es. 252
  maxDailyTrades: number;       // es. 3
  maxDailyLoss: number;         // euro, es. 200
  maxDrawdownPct: number;       // es. 5
  riskPerTradePct: number;      // % capitale per trade, es. 0.02
  minKellyFraction: number;     // es. 0.1
  maxKellyFraction: number;       // es. 0.5
  minQuontestScore: number;     // soglia minima score, es. 55
}

export interface TBDMarketSnapshot {
  symbol: string;
  name: string;
  price: number;
  quontestScore: number;
  regimeAlignment: string;
  volatility24h: number;
  avgVolume: number;
}

export interface TBDSignal {
  id: string;
  symbol: string;
  name: string;
  action: 'BUY';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  quantity: number;
  capitalAllocated: number;
  kellyFraction: number;
  winProbability: number;
  riskRewardRatio: number;
  expectedValue: number;
  timeframe: 'INTRADAY' | 'SWING';
  urgency: 'IMMEDIATE' | 'WITHIN_HOUR';
  reason: string;
  generatedAt: string;
}

export interface TBDState {
  dailyTargetReturn: number;
  currentDayReturn: number;
  remainingTrades: number;
  remainingRisk: number;
  circuitBreaker: 'OPEN' | 'CLOSED';
  circuitBreakerReason: string | null;
  lastUpdated: string;
}

export interface TBDPlan {
  signals: TBDSignal[];
  state: TBDState;
  summary: {
    targetAnnual: number;
    targetDaily: number;
    currentDaily: number;
    gapToTarget: number;
    tradesToday: number;
    pnlToday: number;
  };
}

export const DEFAULT_TBD_CONFIG: TBDConfig = {
  targetAnnualReturn: 0.25,
  tradingDaysPerYear: 252,
  maxDailyTrades: 3,
  maxDailyLoss: 200,
  maxDrawdownPct: 5,
  riskPerTradePct: 0.02,
  minKellyFraction: 0.1,
  maxKellyFraction: 0.5,
  minQuontestScore: 55,
};

// Universo TBD — asset ad alta volatilità / momentum con score Quontest
export const TBD_UNIVERSE: TBDMarketSnapshot[] = [
  { symbol: 'NVDA',  name: 'NVIDIA Corp.',        price: 120.80, quontestScore: 68, regimeAlignment: 'CYCLICAL',    volatility24h: 2.5, avgVolume: 45000000 },
  { symbol: 'TSLA',  name: 'Tesla Inc.',          price: 250.00, quontestScore: 55, regimeAlignment: 'CYCLICAL',    volatility24h: 3.2, avgVolume: 98000000 },
  { symbol: 'AAPL',  name: 'Apple Inc.',          price: 225.50, quontestScore: 70, regimeAlignment: 'GROWTH',      volatility24h: 1.2, avgVolume: 52000000 },
  { symbol: 'AMD',   name: 'AMD',                 price: 140.50, quontestScore: 62, regimeAlignment: 'CYCLICAL',    volatility24h: 2.8, avgVolume: 35000000 },
  { symbol: 'PLTR',  name: 'Palantir',            price: 35.20,  quontestScore: 58, regimeAlignment: 'GROWTH',      volatility24h: 3.5, avgVolume: 28000000 },
  { symbol: 'COIN',  name: 'Coinbase Global',     price: 195.40, quontestScore: 45, regimeAlignment: 'SPECULATIVE', volatility24h: 4.5, avgVolume: 8000000 },
  { symbol: 'MSTR',  name: 'MicroStrategy',       price: 180.20, quontestScore: 42, regimeAlignment: 'SPECULATIVE', volatility24h: 5.1, avgVolume: 5000000 },
  { symbol: 'ARKK',  name: 'ARK Innovation ETF', price: 48.90,  quontestScore: 50, regimeAlignment: 'SPECULATIVE', volatility24h: 2.9, avgVolume: 12000000 },
  { symbol: 'BTC-USD', name: 'Bitcoin',           price: 68500.00, quontestScore: 60, regimeAlignment: 'SPECULATIVE', volatility24h: 3.8, avgVolume: 30000000000 },
  { symbol: 'ETH-USD', name: 'Ethereum',          price: 3450.00,  quontestScore: 58, regimeAlignment: 'SPECULATIVE', volatility24h: 4.2, avgVolume: 15000000000 },
];

export class TBDEngine {
  constructor(private config: TBDConfig = DEFAULT_TBD_CONFIG) {}

  // Target giornaliero composto: (1+annuale)^(1/252) - 1
  calculateDailyTarget(): number {
    return Math.pow(1 + this.config.targetAnnualReturn, 1 / this.config.tradingDaysPerYear) - 1;
  }

  checkCircuitBreaker(
    currentDayReturn: number,
    currentDrawdownPct: number,
    tradesToday: number,
    pnlToday: number,
    agStatus: string
  ): TBDState {
    const dailyTarget = this.calculateDailyTarget();
    let circuitBreaker: 'OPEN' | 'CLOSED' = 'OPEN';
    let reason: string | null = null;

    if (agStatus === 'PROTECTION') {
      circuitBreaker = 'CLOSED';
      reason = '🛡️ Antigravity PROTECTION — TBD bloccato.';
    } else if (agStatus === 'COOLDOWN' && tradesToday >= 1) {
      circuitBreaker = 'CLOSED';
      reason = '🟡 Antigravity COOLDOWN — max 1 trade/giorno raggiunto.';
    } else if (currentDrawdownPct >= this.config.maxDrawdownPct) {
      circuitBreaker = 'CLOSED';
      reason = `🛑 Drawdown ${currentDrawdownPct.toFixed(1)}% ≥ soglia ${this.config.maxDrawdownPct}%.`;
    } else if (pnlToday <= -this.config.maxDailyLoss) {
      circuitBreaker = 'CLOSED';
      reason = `🛑 Perdita giornaliera €${Math.abs(pnlToday).toFixed(0)} ≥ limite €${this.config.maxDailyLoss}.`;
    } else if (tradesToday >= this.config.maxDailyTrades) {
      circuitBreaker = 'CLOSED';
      reason = `🛑 Max ${this.config.maxDailyTrades} trade/giorno raggiunto.`;
    } else if (currentDayReturn >= dailyTarget * 1.5) {
      reason = `⚠️ Target superato (+${(currentDayReturn * 100).toFixed(2)}%). Considera chiusura profitto.`;
    }

    return {
      dailyTargetReturn: dailyTarget,
      currentDayReturn,
      remainingTrades: Math.max(0, this.config.maxDailyTrades - tradesToday),
      remainingRisk: this.config.maxDailyLoss + pnlToday,
      circuitBreaker,
      circuitBreakerReason: reason,
      lastUpdated: new Date().toISOString(),
    };
  }

  generateSignals(
    portfolioValue: number,
    tbdState: TBDState,
    agStatus: string,
    universe: TBDMarketSnapshot[] = TBD_UNIVERSE,
    existingPositions: any[] = []
  ): TBDSignal[] {
    if (tbdState.circuitBreaker === 'CLOSED') return [];

    const gap = Math.max(0, tbdState.dailyTargetReturn - tbdState.currentDayReturn);
    const slots = tbdState.remainingTrades;
    if (slots <= 0) return [];

    let candidates = universe
      .filter(a => a.quontestScore >= this.config.minQuontestScore)
      .filter(a => !(agStatus === 'COOLDOWN' && a.regimeAlignment === 'SPECULATIVE'))
      .sort((a, b) => b.quontestScore - a.quontestScore);

    // Escludi posizioni aperte solo se il portafoglio ha già quell'asset aperto
    const existingSymbols = new Set(existingPositions.filter(p => p.status === 'OPEN').map(p => p.symbol));
    candidates = candidates.filter(c => !existingSymbols.has(c.symbol));

    const signals: TBDSignal[] = [];

    for (let i = 0; i < Math.min(slots, candidates.length); i++) {
      const asset = candidates[i];

      const winProb = asset.quontestScore / 100;
      const lossProb = 1 - winProb;
      const rr = 2.0;

      let kelly = (winProb * rr - lossProb) / rr;
      kelly = Math.max(this.config.minKellyFraction, Math.min(this.config.maxKellyFraction, kelly));

      const maxRiskPerTrade = portfolioValue * this.config.riskPerTradePct;
      let capitalAllocated = Math.min(
        kelly * maxRiskPerTrade * 10,
        tbdState.remainingRisk / slots,
        portfolioValue * 0.05
      );

      if (capitalAllocated < asset.price) {
        capitalAllocated = asset.price * 2;
      }

      const quantity = Math.max(1, Math.floor(capitalAllocated / asset.price));

      const slDist = asset.price * (asset.volatility24h / 100) * 1.5;
      const tpDist = slDist * rr;

      signals.push({
        id: `tbd_${Date.now()}_${asset.symbol}`,
        symbol: asset.symbol,
        name: asset.name,
        action: 'BUY',
        entryPrice: asset.price,
        stopLoss: asset.price - slDist,
        takeProfit: asset.price + tpDist,
        quantity,
        capitalAllocated: quantity * asset.price,
        kellyFraction: kelly,
        winProbability: winProb,
        riskRewardRatio: rr,
        expectedValue: (winProb * tpDist - lossProb * slDist) * quantity,
        timeframe: asset.volatility24h > 3.5 ? 'INTRADAY' : 'SWING',
        urgency: i === 0 ? 'IMMEDIATE' : 'WITHIN_HOUR',
        reason: `Gap target: ${(gap * 100).toFixed(3)}% | Quontest: ${asset.quontestScore}/100 | Vol: ${asset.volatility24h}% | Kelly: ${(kelly * 100).toFixed(1)}% | Rischio residuo: €${tbdState.remainingRisk.toFixed(0)}.`,
        generatedAt: new Date().toISOString(),
      });
    }

    return signals;
  }

  buildPlan(
    portfolioValue: number,
    currentDayReturn: number,
    currentDrawdownPct: number,
    tradesToday: number,
    pnlToday: number,
    agStatus: string,
    existingPositions: any[] = [],
    universe: TBDMarketSnapshot[] = TBD_UNIVERSE
  ): TBDPlan {
    const state = this.checkCircuitBreaker(currentDayReturn, currentDrawdownPct, tradesToday, pnlToday, agStatus);
    const signals = this.generateSignals(portfolioValue, state, agStatus, universe, existingPositions);
    const dailyTarget = this.calculateDailyTarget();

    return {
      signals,
      state,
      summary: {
        targetAnnual: this.config.targetAnnualReturn,
        targetDaily: dailyTarget,
        currentDaily: currentDayReturn,
        gapToTarget: Math.max(0, dailyTarget - currentDayReturn),
        tradesToday,
        pnlToday,
      },
    };
  }
}
