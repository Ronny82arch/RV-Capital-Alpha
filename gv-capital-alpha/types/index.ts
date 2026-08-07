// ─── STATUS / ENUM-LIKE TYPES ─────────────────────────────────────────────

export type TbdSignalStatus =
  | 'PRE_ALERT' | 'PENDING' | 'APPROVED' | 'ACTIVE' | 'TRIGGERED'
  | 'CLOSED_TP' | 'CLOSED_SL' | 'CANCELLED';

export type SignalStatus =
  | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'EXPIRED' | 'CANCELLED';

export type PositionStatus = 'OPEN' | 'CLOSED';

export type ActionType = 'BUY' | 'SELL';

export type AssetType = 'ETF' | 'STOCK' | 'CRYPTO';

export type Urgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'IMMEDIATE';

export type AlertType = 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS' | 'ERROR';

export type AiMode = 'STRICT' | 'DYNAMIC';

// ─── MARKET DATA ───────────────────────────────────────────────────────────

export interface WatchlistItem {
  symbol: string;
  name: string;
  type: AssetType;
  yahooSymbol?: string;
  coinId?: string;
}

export interface MarketDataHistoryPoint {
  date: string;
  close: number;
  high?: number;
  low?: number;
}

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
  history: MarketDataHistoryPoint[];
}

// ─── RISK PROFILE / BUCKETS ────────────────────────────────────────────────

export interface RiskProfile {
  maxDrawdownPct: number;
  maxVolatility: number;
  minQuontestScore: number;
  maxLeverage: number;
  maxDailyLoss?: number;
  maxTradesPerDay?: number;
}

export const DEFAULT_RISK_PROFILES: Record<'CORE' | 'SATELLITE' | 'TBD', RiskProfile> = {
  CORE: { maxDrawdownPct: 8, maxVolatility: 10, minQuontestScore: 70, maxLeverage: 1.0 },
  SATELLITE: { maxDrawdownPct: 15, maxVolatility: 20, minQuontestScore: 60, maxLeverage: 1.2, maxDailyLoss: 100 },
  TBD: { maxDrawdownPct: 25, maxVolatility: 35, minQuontestScore: 45, maxLeverage: 1.5, maxDailyLoss: 200, maxTradesPerDay: 3 },
};

export interface PortfolioBucket {
  name: string;
  riskProfile: RiskProfile;
  currentValue: number;
  targetAllocationPct: number;
  expectedReturn: number;
  realizedReturn: number;
}

// ─── POSITIONS / SIGNALS / ALERTS ──────────────────────────────────────────

export interface Position {
  id: string;
  signalId?: string;
  symbol: string;
  name: string;
  type: AssetType;
  action: ActionType;
  entryPrice: number;
  quantity: number;
  capitalAllocated: number;
  stopLoss: number;
  takeProfit: number;
  entryDate: string;
  status: PositionStatus;
  closePrice?: number;
  closeDate?: string;
  realizedPnl: number;
  realizedPnlPercent: number;
  currentPrice?: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  tags?: string[];
  portfolio: string;
  logoUrl?: string;
}

export interface Signal {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  action: ActionType;
  suggestedPrice: number;
  quantity: number;
  capitalToAllocate: number;
  stopLoss: number;
  takeProfit: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  kellyFraction: number;
  winProbability: number;
  winProbabilitySampleSize: number;
  winProbabilityTrusted: boolean;
  expectedReturn: number;
  reasoning: string;
  strategy: string;
  urgency: Urgency;
  technicals?: any;
  createdAt: string;
  status: SignalStatus;
  approvedAt?: string;
  executedAt?: string;
  executedPrice?: number;
  positionId?: string;
  portfolio?: string;
  source?: string;
  tags?: string[];
  entryPrice?: number;
  riskRewardRatio?: number;
}

export interface Alert {
  id: string;
  title: string;
  message: string;
  date: string;
  type: AlertType;
  read: boolean;
}

export interface PerformanceSnapshot {
  date: string;
  totalValue: number;
  pnlPercent: number;
}

// ─── PAC CONFIG ────────────────────────────────────────────────────────────

export interface PacConfig {
  portfolioMonthlyBudgets: Record<string, number>;
  assetTargetWeights: Record<string, Record<string, number>>;
}

export interface CustomPortfolio {
  name: string;
  targetAllocationPct: number;
  currentValue: number;
  color: string;
}

export interface BucketProjection {
  p10: number;
  p50: number;
  p90: number;
  successRate: number;
}

// ─── PORTFOLIO STATE (root) ─────────────────────────────────────────────────

export interface PortfolioState {
  id?: string;
  excludeCopyTrading?: boolean;
  tbdRealizedPnL?: number;
  antigravityCooldownUntil?: string | null;
  portfolioPerformances?: Record<string, { totalValue: number; [key: string]: any }>;
  capitalBase: number;
  capitalAvailable: number;
  depositedFunds: number;
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  targetAnnualReturn: number;
  aiMode: AiMode;
  antigravityTargetLeverage: number;
  startDate: string;
  aiManagedTags: string[];
  customPortfolios: any[];
  coreSatelliteTarget?: number;
  targets: Record<string, any>;
  buckets: Record<'CORE' | 'SATELLITE' | 'TBD', PortfolioBucket> & Record<string, PortfolioBucket>;
  bucketProjections: Record<string, any>;
  _version: number;
  updatedAt: string;

  positions: Position[];
  signals: Signal[];
  performanceHistory: PerformanceSnapshot[];
  perTagHistory: Record<string, PerformanceSnapshot[]>;
  alerts: Alert[];
}
