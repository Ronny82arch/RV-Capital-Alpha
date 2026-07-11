import { PortfolioState, Signal, Position, PerformanceSnapshot } from '@/types';

const CAPITAL_BASE = 30000;
const TARGET_RETURN = 0.25;

// ─── KV ABSTRACTION ───────────────────────────────────────────────────────────
// Uses Vercel KV (Redis) in production via REST API
// Falls back to in-memory for local dev if KV_REST_API_URL is not set

let memoryStore: Record<string, string> = {};

async function kvGet(key: string): Promise<string | null> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return memoryStore[key] ?? null;
  }
  try {
    const res = await fetch(`${process.env.KV_REST_API_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
    });
    const data = await res.json();
    return data.result ?? null;
  } catch {
    return memoryStore[key] ?? null;
  }
}

async function kvSet(key: string, value: string): Promise<void> {
  memoryStore[key] = value;
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return;
  try {
    await fetch(`${process.env.KV_REST_API_URL}/set/${key}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value }),
    });
  } catch {}
}

// ─── DEFAULT PORTFOLIO ────────────────────────────────────────────────────────
function defaultPortfolio(): PortfolioState {
  // Se non c'è eToro o database collegato, mostriamo un portafoglio fittizio per far provare l'app
  return {
    capitalBase: CAPITAL_BASE,
    capitalAvailable: 15000,
    positions: [
      {
        id: 'dummy_1', signalId: 'dummy', symbol: 'BTC', name: 'Bitcoin', type: 'CRYPTO', action: 'BUY',
        entryPrice: 60000, quantity: 0.1, capitalAllocated: 6000, stopLoss: 55000, takeProfit: 80000,
        entryDate: new Date().toISOString(), status: 'OPEN', currentPrice: 65000, unrealizedPnl: 500, unrealizedPnlPercent: 8.33, tags: ['Cripto', 'Core']
      },
      {
        id: 'dummy_2', signalId: 'dummy', symbol: 'AAPL', name: 'Apple', type: 'STOCK', action: 'BUY',
        entryPrice: 150, quantity: 20, capitalAllocated: 3000, stopLoss: 140, takeProfit: 200,
        entryDate: new Date().toISOString(), status: 'OPEN', currentPrice: 145, unrealizedPnl: -100, unrealizedPnlPercent: -3.33, tags: ['Azioni', 'Satellite']
      },
      {
        id: 'dummy_3', signalId: 'dummy', symbol: 'SPY', name: 'S&P 500 ETF', type: 'ETF', action: 'BUY',
        entryPrice: 500, quantity: 12, capitalAllocated: 6000, stopLoss: 480, takeProfit: 600,
        entryDate: new Date().toISOString(), status: 'OPEN', currentPrice: 510, unrealizedPnl: 120, unrealizedPnlPercent: 2.4, tags: ['Fondo', 'PAC']
      }
    ],
    signals: [],
    totalValue: 30520,
    totalPnL: 520,
    totalPnLPercent: 1.73,
    targetAnnualReturn: TARGET_RETURN,
    startDate: new Date().toISOString().split('T')[0],
    performanceHistory: [
      { date: new Date(Date.now() - 86400000).toISOString().split('T')[0], totalValue: CAPITAL_BASE, pnlPercent: 0 },
      { date: new Date().toISOString().split('T')[0], totalValue: 30520, pnlPercent: 1.73 }
    ],
    alerts: [{ id: '1', title: 'Benvenuto', message: 'Questo è un portafoglio di simulazione. Collega eToro aggiungendo ETORO_API_KEY su Vercel.', date: new Date().toISOString(), type: 'INFO', read: false }],
    aiManagedTags: ['Core', 'Satellite'],
    updatedAt: new Date().toISOString(),
  };
}

// ─── PORTFOLIO CRUD ───────────────────────────────────────────────────────────
export async function getPortfolio(): Promise<PortfolioState> {
  const raw = await kvGet('portfolio');
  if (!raw) return defaultPortfolio();
  try {
    return JSON.parse(raw) as PortfolioState;
  } catch {
    return defaultPortfolio();
  }
}

export async function savePortfolio(state: PortfolioState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  await kvSet('portfolio', JSON.stringify(state));
}

// ─── ALERTS ───────────────────────────────────────────────────────────────────
export async function addAlert(alertInfo: Omit<import('@/types').Alert, 'id' | 'date' | 'read'>): Promise<void> {
  const portfolio = await getPortfolio();
  const newAlert: import('@/types').Alert = {
    id: generateId(),
    date: new Date().toISOString(),
    read: false,
    ...alertInfo,
  };
  portfolio.alerts = [newAlert, ...(portfolio.alerts || [])].slice(0, 100);
  await savePortfolio(portfolio);
}

export async function markAlertAsRead(alertId: string): Promise<void> {
  const portfolio = await getPortfolio();
  const alert = portfolio.alerts?.find(a => a.id === alertId);
  if (alert) {
    alert.read = true;
    await savePortfolio(portfolio);
  }
}

export async function markAllAlertsAsRead(): Promise<void> {
  const portfolio = await getPortfolio();
  if (portfolio.alerts) {
    portfolio.alerts.forEach(a => { a.read = true; });
    await savePortfolio(portfolio);
  }
}

// ─── SIGNAL OPERATIONS ────────────────────────────────────────────────────────
export async function addSignal(signal: Signal): Promise<void> {
  const portfolio = await getPortfolio();

  // Keep max 50 signals in history
  const signals = [signal, ...portfolio.signals].slice(0, 50);
  portfolio.signals = signals;
  await savePortfolio(portfolio);
}

export async function updateSignalStatus(
  signalId: string,
  status: Signal['status'],
  extra?: Partial<Signal>
): Promise<Signal | null> {
  const portfolio = await getPortfolio();
  const idx = portfolio.signals.findIndex(s => s.id === signalId);
  if (idx === -1) return null;

  portfolio.signals[idx] = { ...portfolio.signals[idx], status, ...extra };
  await savePortfolio(portfolio);
  return portfolio.signals[idx];
}

// ─── POSITION OPERATIONS ──────────────────────────────────────────────────────
export async function openPosition(position: Position): Promise<void> {
  const portfolio = await getPortfolio();
  portfolio.positions.push(position);
  portfolio.capitalAvailable = Math.max(0, portfolio.capitalAvailable - position.capitalAllocated);
  await recalcPortfolio(portfolio);
  await savePortfolio(portfolio);
}

export async function closePosition(
  positionId: string,
  closePrice: number
): Promise<Position | null> {
  const portfolio = await getPortfolio();
  const idx = portfolio.positions.findIndex(p => p.id === positionId);
  if (idx === -1) return null;

  const pos = portfolio.positions[idx];
  const realizedPnl = (closePrice - pos.entryPrice) * pos.quantity;
  const realizedPnlPercent = ((closePrice - pos.entryPrice) / pos.entryPrice) * 100;

  portfolio.positions[idx] = {
    ...pos,
    status: 'CLOSED',
    closePrice,
    closeDate: new Date().toISOString(),
    realizedPnl,
    realizedPnlPercent,
    currentPrice: closePrice,
    unrealizedPnl: 0,
    unrealizedPnlPercent: 0,
  };

  portfolio.capitalAvailable += pos.capitalAllocated + realizedPnl;
  await recalcPortfolio(portfolio);
  await savePortfolio(portfolio);

  return portfolio.positions[idx];
}

// ─── RECALCULATE TOTALS ───────────────────────────────────────────────────────
export async function recalcPortfolio(portfolio: PortfolioState): Promise<void> {
  const openPositions = portfolio.positions.filter(p => p.status === 'OPEN');
  const openValue = openPositions.reduce((sum, p) => {
    const currentVal = (p.currentPrice ?? p.entryPrice) * p.quantity;
    return sum + currentVal;
  }, 0);

  portfolio.totalValue = portfolio.capitalAvailable + openValue;
  portfolio.totalPnL = portfolio.totalValue - portfolio.capitalBase;
  portfolio.totalPnLPercent = (portfolio.totalPnL / portfolio.capitalBase) * 100;

  // Snapshot for performance chart (max once per day)
  const today = new Date().toISOString().split('T')[0];
  const lastSnapshot = portfolio.performanceHistory[portfolio.performanceHistory.length - 1];
  if (!lastSnapshot || lastSnapshot.date !== today) {
    portfolio.performanceHistory.push({
      date: today,
      totalValue: portfolio.totalValue,
      pnlPercent: portfolio.totalPnLPercent,
    });
    // Keep max 365 days
    if (portfolio.performanceHistory.length > 365) {
      portfolio.performanceHistory = portfolio.performanceHistory.slice(-365);
    }
  }
}

export async function updatePositionPrices(
  updates: { positionId: string; currentPrice: number }[]
): Promise<void> {
  const portfolio = await getPortfolio();
  let changed = false;

  for (const update of updates) {
    const idx = portfolio.positions.findIndex(p => p.id === update.positionId);
    if (idx === -1 || portfolio.positions[idx].status !== 'OPEN') continue;

    const pos = portfolio.positions[idx];
    const unrealizedPnl = (update.currentPrice - pos.entryPrice) * pos.quantity;
    const unrealizedPnlPercent = ((update.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;

    portfolio.positions[idx] = {
      ...pos,
      currentPrice: update.currentPrice,
      unrealizedPnl,
      unrealizedPnlPercent,
    };
    changed = true;
  }

  if (changed) {
    await recalcPortfolio(portfolio);
    await savePortfolio(portfolio);
  }
}

export async function updatePositionTags(positionId: string, tags: string[]): Promise<void> {
  const portfolio = await getPortfolio();
  const idx = portfolio.positions.findIndex(p => p.id === positionId);
  if (idx !== -1) {
    portfolio.positions[idx].tags = tags;
    await savePortfolio(portfolio);
  }
}

export async function syncEtoroPortfolio(): Promise<void> {
  if (!process.env.ETORO_API_KEY || !process.env.ETORO_USER_KEY) return;
  const { getEtoroBalance, getEtoroPositions } = await import('./etoro');
  try {
    const balance = await getEtoroBalance();
    const ePositions = await getEtoroPositions();
    
    const portfolio = await getPortfolio();
    portfolio.capitalAvailable = balance.AvailableBalance;
    
    // Create a map of existing tags to preserve them
    const existingTags = new Map<string, string[]>();
    portfolio.positions.forEach(p => {
      if (p.tags) existingTags.set(p.symbol, p.tags);
    });

    const newPositions: import('@/types').Position[] = ePositions.map(ep => ({
      id: `etoro_${ep.InstrumentID}`,
      signalId: 'etoro_sync',
      symbol: String(ep.InstrumentID),
      name: `Instrument ${ep.InstrumentID}`,
      type: 'STOCK',
      action: ep.IsBuy ? 'BUY' : 'SELL',
      entryPrice: ep.OpenRate,
      quantity: ep.Invested / ep.OpenRate,
      capitalAllocated: ep.Invested,
      stopLoss: ep.StopLossRate,
      takeProfit: ep.TakeProfitRate,
      entryDate: new Date().toISOString(),
      status: 'OPEN',
      currentPrice: ep.CurrentRate,
      unrealizedPnl: ep.CurrentValue - ep.Invested,
      unrealizedPnlPercent: ((ep.CurrentValue - ep.Invested) / ep.Invested) * 100,
      tags: existingTags.get(String(ep.InstrumentID)) || ['Da Assegnare'],
    }));

    portfolio.positions = newPositions;
    await recalcPortfolio(portfolio);
    await savePortfolio(portfolio);
  } catch (error) {
    console.error('eToro sync failed:', error);
  }
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
