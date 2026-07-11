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
  realizedPnl?: number;
  realizedPnlPercent?: number;
  currentPrice?: number;
  unrealizedPnl?: number;
  unrealizedPnlPercent?: number;
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
  alerts: Alert[];
  updatedAt: string;
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
  history: { date: string; close: number }[];
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  type: AssetType;
  coinId?: string;
  yahooSymbol?: string;
}
