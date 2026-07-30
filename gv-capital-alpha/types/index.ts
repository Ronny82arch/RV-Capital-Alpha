export type AssetType = 'ETF' | 'STOCK' | 'CRYPTO';
export type SignalAction = 'BUY' | 'SELL';
export type SignalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'OPEN' | 'CLOSED' | 'CANCELLED';
export type Urgency = 'LOW' | 'MEDIUM' | 'HIGH';
export type PositionStatus = 'OPEN' | 'CLOSED';
export type AiMode = 'STRICT' | 'DYNAMIC';
export type AlertType = 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';

// ─── RISK BUDGETING V2 ───────────────────────────────────────────────────────

export interface RiskProfile {
  maxDrawdownPct: number;      // Quanto può scendere questo bucket (es. 8%)
  maxVolatility: number;       // Volatilità annualizzata max (es. 10%)
  maxDailyLoss: number;        // Perdita max giornaliera in € (es. 0 per Core)
  maxTradesPerDay: number;     // Max trade/giorno (0 per Core)
  maxLeverage: number;         // Leva max (1.0 = nessuna)
  kellyCap: number;            // Massima frazione Kelly 0-1 (es. 0.15)
  minQuontestScore: number;    // Soglia minima score Quontest (es. 70)
  riskPerTradePct: number;     // % del bucket per singolo trade (es. 0.02)
}

export interface PortfolioBucket {
  name: 'CORE' | 'SATELLITE' | 'TBD';
  riskProfile: RiskProfile;
  currentValue: number;
  targetAllocationPct: number;   // % del totale portfolio (70, 25, 5, ecc.)
  expectedReturn: number;      // CALCOLATO dal motore, NON editato dall'utente
  realizedReturn: number;      // Ritorno realizzato finora
}

export interface Technicals {
  rsi: number;
  momentum: number;
  sma20: number;
  sma50: number;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  correlationMax?: number;
}

export interface Signal {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  action: SignalAction;
  suggestedPrice: number;
  entryPrice?: number;
  quantity: number;
  capitalToAllocate: number;
  stopLoss: number;
  takeProfit: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  kellyFraction: number;
  winProbability: number;
  winProbabilitySampleSize?: number;
  winProbabilityTrusted?: boolean;
  expectedReturn: number;
  riskRewardRatio?: number;
  reasoning: string;
  strategy: string;
  urgency: Urgency;
  technicals: Technicals;
  createdAt: string;
  date?: string;
  status: SignalStatus;
  approvedAt?: string;
  executedAt?: string;
  executedPrice?: number;
  positionId?: string;
  portfolio?: string;
  tags?: string[];
  source?: string;
}

export interface Position {
  id: string;
  signalId?: string;
  symbol: string;
  name: string;
  type: AssetType;
  action: SignalAction;
  entryPrice: number;
  quantity: number;
  capitalAllocated: number;
  stopLoss: number;
  takeProfit: number;
  entryDate: string;
  status: PositionStatus;
  closePrice?: number;
  closeDate?: string;
  realizedPnl?: number;
  realizedPnlPercent?: number;
  currentPrice?: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  portfolio?: string;
  tags?: string[];
  logoUrl?: string;
}

export interface PerformanceSnapshot {
  date: string;
  totalValue: number;
  pnlPercent: number;
  dailyReturn?: number;
  cumulativeReturn?: number;
}

export interface Alert {
  id: string;
  title: string;
  message: string;
  date: string;
  type: AlertType;
  read: boolean;
}

export interface CustomPortfolio {
  name: string;
  targetAllocationPct: number;
  currentValue: number;
  color?: string;
}

export interface BucketProjection {
  p10: number;
  p50: number;
  p90: number;
  mean: number;
  successRate: number;
  maxDrawdown: number;
}

export interface PortfolioState {
  id?: string;
  capitalBase: number;
  capitalAvailable: number;
  depositedFunds: number;
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  targetAnnualReturn?: number;
  startDate: string;
  updatedAt: string;

  // ── RISK BUDGETING: profili per bucket ───────────────────────────────────
  buckets?: {
    CORE: PortfolioBucket;
    SATELLITE: PortfolioBucket;
    TBD: PortfolioBucket;
  };

  // ── ANTIGRAVITY V2 ────────────────────────────────────────────────────────
  antigravityTargetLeverage?: number;
  antigravityCooldownUntil?: string | null;
  antigravityState?: any;

  // ── TBD LINK ─────────────────────────────────────────────────────────────
  tbdRealizedPnL?: number;

  // ── POSIZIONI & SEGNALI ─────────────────────────────────────────────────
  positions: Position[];
  signals: Signal[];
  performanceHistory: PerformanceSnapshot[];
  perTagHistory?: Record<string, PerformanceSnapshot[]>;
  portfolioPerformances?: Record<string, { totalValue: number; invested: number; pnl: number; pnlPercent: number }>;
  alerts: Alert[];
  customPortfolios?: any[];
  aiManagedTags?: string[];
  aiMode?: AiMode;
  coreSatelliteTarget?: number;
  excludeCopyTrading?: boolean;
  _version?: number;

  // Legacy — mantenuto per compatibilità ma ignorato dai motori nuovi
  targets?: Record<string, number>;
  riskBudgets?: Record<string, { maxDrawdownPct: number; maxAllocationPct: number }>;
  bucketProjections?: any;
}

// ── DEFAULT RISK PROFILES ─────────────────────────────────────────────────
export const DEFAULT_RISK_PROFILES = {
  CORE: {
    maxDrawdownPct: 8,
    maxVolatility: 10,
    maxDailyLoss: 0,
    maxTradesPerDay: 0,
    maxLeverage: 1.0,
    kellyCap: 0.15,
    minQuontestScore: 70,
    riskPerTradePct: 0.02,
  } as RiskProfile,

  SATELLITE: {
    maxDrawdownPct: 15,
    maxVolatility: 20,
    maxDailyLoss: 100,
    maxTradesPerDay: 1,
    maxLeverage: 1.2,
    kellyCap: 0.25,
    minQuontestScore: 60,
    riskPerTradePct: 0.03,
  } as RiskProfile,

  TBD: {
    maxDrawdownPct: 25,
    maxVolatility: 35,
    maxDailyLoss: 200,
    maxTradesPerDay: 3,
    maxLeverage: 1.5,
    kellyCap: 0.50,
    minQuontestScore: 45,
    riskPerTradePct: 0.05,
  } as RiskProfile,
};

export interface MarketData {
  symbol: string;
  name: string;
  type: AssetType;
  price: number;
  change: number;
  changePercent: number;
  high24h: number;
  low24h: number;
  volume: number;
  history: { date: string; close: number; high?: number; low?: number }[];
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  type: AssetType;
  coinId?: string;
  yahooSymbol?: string;
}

export interface PacConfig {
  portfolioMonthlyBudgets: Record<string, number>;
  assetTargetWeights?: Record<string, Record<string, number>>;
}

// ─── TIPI TBD (nuovi) ───────────────────────────────────────────────────────

export type TbdSignalStatus = 'PRE_ALERT' | 'ACTIVE' | 'TRIGGERED' | 'CLOSED_TP' | 'CLOSED_SL' | 'CANCELLED';
export type TbdDirection = 'BUY' | 'SELL';

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
  qualityScore: number;
  status: TbdSignalStatus;
  triggeredAt?: string;
  closedAt?: string;
  realizedPnL?: number;
  timestamp: string;
}

export interface TbdLog {
  date: string;
  startingCash: number;
  endingCash: number;
  realizedPnL: number;
  targetReached: boolean;
  totalTrades: number;
  winningTrades: number;
  status: string;
  signals: TbdSignal[];
}

// ─── TIPI ANTIGRAVITY (nuovi) ───────────────────────────────────────────────

export type AntigravityStatus = 'NORMAL' | 'BOOST_TBD' | 'CAUTION' | 'PROTECT';

export interface AntigravityState {
  status: AntigravityStatus;
  coreTargetPct: number;
  satelliteTargetPct: number;
  tbdTargetPct: number;
  tbdCapitalToday: number;
  reason: string;
  tbdInCooldown: boolean;
  cooldownUntil: string | null;
  currentDrawdownPct: number;
}

export interface RiskBudget {
  maxDrawdownPct: number;
  maxAllocationPct: number;
}
