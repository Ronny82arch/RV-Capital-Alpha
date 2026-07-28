export type AssetType = 'ETF' | 'STOCK' | 'CRYPTO';
export type SignalAction = 'BUY' | 'SELL';
export type SignalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED';
export type Urgency = 'LOW' | 'MEDIUM' | 'HIGH';
export type PositionStatus = 'OPEN' | 'CLOSED';
export type AiMode = 'STRICT' | 'DYNAMIC';
export type AlertType = 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';

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
  technicals: Technicals;
  createdAt: string;
  status: SignalStatus;
  approvedAt?: string;
  executedAt?: string;
  executedPrice?: number;
  positionId?: string;
  portfolio?: string;
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
  realizedPnl: number;
  realizedPnlPercent: number;
  currentPrice?: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  tags?: string[];
  logoUrl?: string;
  portfolio?: string;
}

export interface PerformanceSnapshot {
  date: string;
  totalValue: number;
  pnlPercent: number;
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
  targetAnnualReturn: number;
  aiMode?: AiMode;
  coreSatelliteTarget?: number;
  startDate: string;
  positions: Position[];
  signals: Signal[];
  alerts: Alert[];
  performanceHistory: PerformanceSnapshot[];
  perTagHistory?: Record<string, PerformanceSnapshot[]>;
  portfolioPerformances?: Record<string, { totalValue: number; invested: number; pnl: number; pnlPercent: number }>;
  customPortfolios?: any[]; // Typed as any[] to support string[] in DB and CustomPortfolio[] in new UI
  aiManagedTags?: string[];
  targets?: Record<string, number>;
  riskBudgets?: Record<string, { maxDrawdownPct: number; maxAllocationPct: number }>;
  bucketProjections?: Record<string, BucketProjection>;
  antigravityTargetLeverage?: number;
  _version?: number;
  updatedAt: string;
  excludeCopyTrading?: boolean;
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
