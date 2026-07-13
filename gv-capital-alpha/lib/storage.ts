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

async function acquireLock(key: string, maxWaitMs = 5000): Promise<boolean> {
  const lockKey = `${key}_lock`;
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const isLocked = await kvGet(lockKey);
    if (!isLocked) {
      await kvSet(lockKey, Date.now().toString());
      return true;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

async function releaseLock(key: string): Promise<void> {
  const lockKey = `${key}_lock`;
  await kvSet(lockKey, '');
}

// ─── DEFAULT PORTFOLIO ────────────────────────────────────────────────────────
function defaultPortfolio(): PortfolioState {
  // Se non c'è eToro o database collegato, mostriamo un portafoglio fittizio per far provare l'app
  // Simuliamo tre portafogli diversi usando i tag: Core, Satellite, e PAC Figlia
  const dateStr = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const today = dateStr.split('T')[0];

  return {
    capitalBase: CAPITAL_BASE,
    capitalAvailable: 8000,
    positions: [
      // --- PORTAFOGLIO: Core ---
      { id: 'd1', signalId: 'd', symbol: 'SPY', name: 'S&P 500 ETF', type: 'ETF', action: 'BUY', entryPrice: 500, quantity: 20, capitalAllocated: 10000, stopLoss: 450, takeProfit: 600, entryDate: dateStr, status: 'OPEN', currentPrice: 520, unrealizedPnl: 400, unrealizedPnlPercent: 4.0, tags: ['Core'] },
      { id: 'd2', signalId: 'd', symbol: 'GLD', name: 'Gold ETF', type: 'ETF', action: 'BUY', entryPrice: 180, quantity: 20, capitalAllocated: 3600, stopLoss: 170, takeProfit: 210, entryDate: dateStr, status: 'OPEN', currentPrice: 195, unrealizedPnl: 300, unrealizedPnlPercent: 8.3, tags: ['Core'] },
      
      // --- PORTAFOGLIO: Satellite ---
      { id: 'd3', signalId: 'd', symbol: 'AAPL', name: 'Apple Inc', type: 'STOCK', action: 'BUY', entryPrice: 170, quantity: 15, capitalAllocated: 2550, stopLoss: 150, takeProfit: 220, entryDate: dateStr, status: 'OPEN', currentPrice: 185, unrealizedPnl: 225, unrealizedPnlPercent: 8.8, tags: ['Satellite'] },
      { id: 'd4', signalId: 'd', symbol: 'TSLA', name: 'Tesla Inc', type: 'STOCK', action: 'BUY', entryPrice: 200, quantity: 10, capitalAllocated: 2000, stopLoss: 180, takeProfit: 280, entryDate: dateStr, status: 'OPEN', currentPrice: 170, unrealizedPnl: -300, unrealizedPnlPercent: -15.0, tags: ['Satellite'] },
      { id: 'd5', signalId: 'd', symbol: 'BTC', name: 'Bitcoin', type: 'CRYPTO', action: 'BUY', entryPrice: 60000, quantity: 0.05, capitalAllocated: 3000, stopLoss: 50000, takeProfit: 90000, entryDate: dateStr, status: 'OPEN', currentPrice: 68000, unrealizedPnl: 400, unrealizedPnlPercent: 13.3, tags: ['Satellite'] },
      { id: 'd6', signalId: 'd', symbol: 'ETH', name: 'Ethereum', type: 'CRYPTO', action: 'BUY', entryPrice: 3000, quantity: 1.5, capitalAllocated: 4500, stopLoss: 2500, takeProfit: 5000, entryDate: dateStr, status: 'OPEN', currentPrice: 3400, unrealizedPnl: 600, unrealizedPnlPercent: 13.3, tags: ['Satellite'] },

      // --- PORTAFOGLIO: PAC Ginevra ---
      { id: 'd7', signalId: 'd', symbol: 'VWCE', name: 'Vanguard All-World', type: 'ETF', action: 'BUY', entryPrice: 100, quantity: 30, capitalAllocated: 3000, stopLoss: 0, takeProfit: 0, entryDate: dateStr, status: 'OPEN', currentPrice: 110, unrealizedPnl: 300, unrealizedPnlPercent: 10.0, tags: ['PAC Ginevra'] },
      { id: 'd8', signalId: 'd', symbol: 'BND', name: 'Vanguard Total Bond', type: 'ETF', action: 'BUY', entryPrice: 70, quantity: 10, capitalAllocated: 700, stopLoss: 0, takeProfit: 0, entryDate: dateStr, status: 'OPEN', currentPrice: 72, unrealizedPnl: 20, unrealizedPnlPercent: 2.8, tags: ['PAC Ginevra'] },

      // --- PORTAFOGLIO: PAC Sofia ---
      { id: 'd9', signalId: 'd', symbol: 'SWDA', name: 'iShares Core MSCI World', type: 'ETF', action: 'BUY', entryPrice: 80, quantity: 40, capitalAllocated: 3200, stopLoss: 0, takeProfit: 0, entryDate: dateStr, status: 'OPEN', currentPrice: 88, unrealizedPnl: 320, unrealizedPnlPercent: 10.0, tags: ['PAC Sofia'] },
      { id: 'd10', signalId: 'd', symbol: 'AGGH', name: 'iShares Core Global Aggregate', type: 'ETF', action: 'BUY', entryPrice: 50, quantity: 15, capitalAllocated: 750, stopLoss: 0, takeProfit: 0, entryDate: dateStr, status: 'OPEN', currentPrice: 51, unrealizedPnl: 15, unrealizedPnlPercent: 2.0, tags: ['PAC Sofia'] }
    ],
    signals: [],
    totalValue: 33435,
    totalPnL: 2435,
    totalPnLPercent: 7.85,
    targetAnnualReturn: TARGET_RETURN,
    startDate: today,
    performanceHistory: [
      { date: yesterday, totalValue: CAPITAL_BASE, pnlPercent: 0 },
      { date: today, totalValue: 33435, pnlPercent: 7.85 }
    ],
    alerts: [{ id: '1', title: 'Portafoglio Multiplo Generato', message: 'Troverai asset etichettati come Core, Satellite, PAC Ginevra e PAC Sofia.', date: dateStr, type: 'SUCCESS', read: false }],
    aiManagedTags: ['Core', 'Satellite'],
    updatedAt: dateStr,
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
  const locked = await acquireLock('portfolio');
  try {
    state.updatedAt = new Date().toISOString();
    await kvSet('portfolio', JSON.stringify(state));
  } finally {
    if (locked) await releaseLock('portfolio');
  }
}

export async function mutatePortfolio<T>(fn: (p: PortfolioState) => Promise<T> | T): Promise<T> {
  const locked = await acquireLock('portfolio');
  try {
    const portfolio = await getPortfolio();
    const result = await fn(portfolio);
    portfolio.updatedAt = new Date().toISOString();
    await kvSet('portfolio', JSON.stringify(portfolio));
    return result;
  } finally {
    if (locked) await releaseLock('portfolio');
  }
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
  await mutatePortfolio(p => {
    p.signals = [signal, ...p.signals].slice(0, 50);
  });
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

export async function deletePosition(positionId: string): Promise<Position | null> {
  const portfolio = await getPortfolio();
  const idx = portfolio.positions.findIndex(p => p.id === positionId);
  if (idx === -1) return null;

  const pos = portfolio.positions[idx];
  
  // Remove position
  portfolio.positions.splice(idx, 1);
  
  // Restore capital
  portfolio.capitalAvailable += pos.capitalAllocated;
  
  // Update original signal status to REJECTED if it exists
  if (pos.signalId) {
    const sIdx = portfolio.signals.findIndex(s => s.id === pos.signalId);
    if (sIdx !== -1) {
      portfolio.signals[sIdx].status = 'REJECTED';
    }
  }

  await recalcPortfolio(portfolio);
  await savePortfolio(portfolio);
  return pos;
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
  await mutatePortfolio(async (p) => {
    let changed = false;
    for (const update of updates) {
      const idx = p.positions.findIndex(pos => pos.id === update.positionId);
      if (idx === -1 || p.positions[idx].status !== 'OPEN') continue;

      const pos = p.positions[idx];
      const unrealizedPnl = (update.currentPrice - pos.entryPrice) * pos.quantity;
      const unrealizedPnlPercent = ((update.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;

      p.positions[idx] = {
        ...pos,
        currentPrice: update.currentPrice,
        unrealizedPnl,
        unrealizedPnlPercent,
      };
      changed = true;
    }
    if (changed) {
      await recalcPortfolio(p);
    }
  });
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
  if (!process.env.ETORO_API_KEY || !process.env.ETORO_USER_KEY) {
    throw new Error('Chiavi API eToro non configurate');
  }
  const { getEtoroBalance, getEtoroPositions } = await import('./etoro');
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
}

export function generateId(): string {
  return crypto.randomUUID();
}

// ─── CALIBRATION TABLE ────────────────────────────────────────────────────────
// Persistita su Vercel KV. Ricostruita ogni giorno da /api/cron/calibrate
// (ore 6:00 UTC), letta ad ogni scan (ore 8:00 UTC).
export async function getCalibrationTable(): Promise<import('./backtest').CalibrationTable | null> {
  const raw = await kvGet('calibration_table');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function saveCalibrationTable(table: import('./backtest').CalibrationTable): Promise<void> {
  try {
    await kvSet('calibration_table', JSON.stringify(table));
    await kvSet('calibration_updated_at', new Date().toISOString());
  } catch (error) {
    console.error('Failed to save calibration table:', error);
  }
}

export async function getCalibrationUpdatedAt(): Promise<string | null> {
  return kvGet('calibration_updated_at');
}
