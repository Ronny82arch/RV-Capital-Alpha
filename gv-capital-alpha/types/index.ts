export type AssetType = 'ETF' | 'STOCK' | 'CRYPTO';
export type SignalAction = 'BUY' | 'SELL';
export type SignalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED';
export type Urgency = 'LOW' | 'MEDIUM' | 'HIGH';
export type PositionStatus = 'OPEN' | 'CLOSED';

export interface Technicals {
  rsi: number;
  momentum: number;
  sma20: number;
  sma50: number;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
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
  winProbabilitySampleSize: number;   // NEW: n. osservazioni storiche usate
  winProbabilityTrusted: boolean;     // NEW: true se campione >= 30
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
  signalId: string;
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
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  read: boolean;
}

export interface PortfolioState {
  capitalBase: number;
  capitalAvailable: number;
  positions: Position[];
  signals: Signal[];
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  targetAnnualReturn: number;
  startDate: string;
  performanceHistory: PerformanceSnapshot[];
  perTagHistory?: Record<string, PerformanceSnapshot[]>;
  alerts: Alert[];
  updatedAt: string;
  aiManagedTags: string[];
  customPortfolios?: string[];
  depositedFunds?: number;
  excludeCopyTrading?: boolean;
  targets?: Record<string, number>;
  aiMode?: 'STRICT' | 'DYNAMIC';
  antigravityTargetLeverage?: number; // ✅ FIX: target leva persistito, non più hardcoded
  portfolioPerformances?: Record<string, { totalValue: number, invested: number, pnl: number, pnlPercent: number }>;
  _version?: number;
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
  // high/low inclusi per backtest realistico (stop/target H+L invece di solo close)
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
  /** Budget mensile in € per ogni portafoglio (chiave = nome portafoglio) */
  portfolioMonthlyBudgets: Record<string, number>;
  /** Pesi target personalizzati per asset dentro ogni portafoglio.
   *  Se assente per un asset usa peso uguale (1/N). */
  assetTargetWeights?: Record<string, Record<string, number>>;
}

