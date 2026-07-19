import { PortfolioState, Signal, Position, PerformanceSnapshot } from '@/types';

const CAPITAL_BASE = 30000;
const TARGET_RETURN = 0.25;

// ─── KV ABSTRACTION ───────────────────────────────────────────────────────────
// Uses Vercel KV (Redis) in production via REST API
// Falls back to in-memory for local dev if KV_REST_API_URL is not set

let memoryStore: Record<string, string> = {};
import fs from 'fs';
import path from 'path';

const LOCAL_STORE_FILE = process.env.VERCEL
  ? path.join('/tmp', '.local_store.json')
  : path.join(process.cwd(), '.local_store.json');

function getLocalStore() {
  try {
    if (fs.existsSync(LOCAL_STORE_FILE)) {
      return JSON.parse(fs.readFileSync(LOCAL_STORE_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading local store', err);
  }
  return memoryStore;
}

function saveLocalStore(store: any) {
  try {
    fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(store, null, 2));
  } catch (err) {
    console.error('Error writing local store', err);
  }
}

async function kvGet(key: string): Promise<string | null> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    const store = getLocalStore();
    return store[key] ?? null;
  }
  try {
    const res = await fetch(`${process.env.KV_REST_API_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
    });
    const data = await res.json();
    return data.result ?? null;
  } catch {
    const store = getLocalStore();
    return store[key] ?? null;
  }
}

async function kvSet(key: string, value: string): Promise<void> {
  const store = getLocalStore();
  store[key] = value;
  memoryStore = store;
  
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    saveLocalStore(store);
    return;
  }
  
  try {
    await fetch(`${process.env.KV_REST_API_URL}/set/${key}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: value,
    });
  } catch {
    saveLocalStore(store);
  }
}

async function acquireLock(key: string, maxWaitMs = 5000): Promise<boolean> {
  const lockKey = `${key}_lock`;
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const isLocked = await kvGet(lockKey);
    // Auto-release stale locks older than 15 seconds (handles crashed serverless functions)
    const lockAge = isLocked ? Date.now() - parseInt(isLocked) : Infinity;
    if (!isLocked || lockAge > 15000) {
      await kvSet(lockKey, Date.now().toString());
      return true;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  // If we can't acquire, proceed anyway (don't block saves)
  return false;
}

async function releaseLock(key: string): Promise<void> {
  const lockKey = `${key}_lock`;
  await kvSet(lockKey, '');
}

// ─── DEFAULT PORTFOLIO ────────────────────────────────────────────────────────
export function defaultPortfolio(): PortfolioState {
  // Se non c'è eToro o database collegato, mostriamo un portafoglio fittizio per far provare l'app
  // Simuliamo tre portafogli diversi usando i tag: Core, Satellite, e PAC Figlia
  const dateStr = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const today = dateStr.split('T')[0];

  return {
    capitalBase: CAPITAL_BASE,
    capitalAvailable: 0,
    positions: [],
    signals: [],
    totalValue: CAPITAL_BASE,
    totalPnL: 0,
    totalPnLPercent: 0,
    targetAnnualReturn: TARGET_RETURN,
    startDate: today,
    performanceHistory: [
      { date: today, totalValue: CAPITAL_BASE, pnlPercent: 0 },
    ],
    alerts: [],
    aiManagedTags: [],
    customPortfolios: [],
    updatedAt: dateStr,
    depositedFunds: 6000,
  };
}

// ─── PORTFOLIO CRUD ───────────────────────────────────────────────────────────
export async function getPortfolio(): Promise<PortfolioState> {
  const raw = await kvGet('portfolio');
  let portfolio: PortfolioState;
  if (!raw) {
    portfolio = defaultPortfolio();
  } else {
    try {
      portfolio = JSON.parse(raw) as PortfolioState;
    } catch {
      portfolio = defaultPortfolio();
    }
  }

  // Ensure arrays exist
  if (!portfolio.customPortfolios) {
    portfolio.customPortfolios = [];
  }
  if (!portfolio.positions) {
    portfolio.positions = [];
  }
  if (!portfolio.signals) {
    portfolio.signals = [];
  }
  if (!portfolio.performanceHistory) {
    portfolio.performanceHistory = [];
  }
  if (!portfolio.alerts) {
    portfolio.alerts = [];
  }
  if (!portfolio.aiManagedTags) {
    portfolio.aiManagedTags = [];
  }

  if (portfolio.depositedFunds === undefined) {
    portfolio.depositedFunds = 6000;
  }

  if (portfolio.excludeCopyTrading === undefined) {
    portfolio.excludeCopyTrading = false;
  }

  // Ensure every position has a portfolio assigned
  portfolio.positions.forEach(p => {
    if (!p.portfolio) {
      p.portfolio = 'Da Assegnare';
    }
  });

  return portfolio;
}

export async function savePortfolio(state: PortfolioState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  await kvSet('portfolio', JSON.stringify(state));
}

export async function mutatePortfolio<T>(fn: (p: PortfolioState) => Promise<T> | T): Promise<T> {
  const portfolio = await getPortfolio();
  const result = await fn(portfolio);
  portfolio.updatedAt = new Date().toISOString();
  await kvSet('portfolio', JSON.stringify(portfolio));
  return result;
}

export async function updatePositionPortfolio(positionId: string, portfolioName: string): Promise<void> {
  const portfolio = await getPortfolio();
  const idx = portfolio.positions.findIndex(p => p.id === positionId);
  if (idx !== -1) {
    portfolio.positions[idx].portfolio = portfolioName;
    await savePortfolio(portfolio);
  }
}

export async function updateCustomPortfolios(portfolios: string[]): Promise<void> {
  const portfolio = await getPortfolio();
  portfolio.customPortfolios = portfolios;
  await savePortfolio(portfolio);
}

export async function deleteCustomPortfolio(portfolioName: string): Promise<void> {
  const portfolio = await getPortfolio();
  if (portfolio.customPortfolios) {
    portfolio.customPortfolios = portfolio.customPortfolios.filter(name => name !== portfolioName);
  }
  // Sposta tutti gli asset di questo portafoglio in "Da Assegnare"
  portfolio.positions.forEach(pos => {
    if (pos.portfolio === portfolioName) {
      pos.portfolio = 'Da Assegnare';
    }
  });
  await savePortfolio(portfolio);
}

export async function renameCustomPortfolio(oldName: string, newName: string): Promise<void> {
  const portfolio = await getPortfolio();
  if (portfolio.customPortfolios) {
    portfolio.customPortfolios = portfolio.customPortfolios.map(name => name === oldName ? newName : name);
  }
  // Rinomina la destinazione di tutti gli asset assegnati a questo portafoglio
  portfolio.positions.forEach(pos => {
    if (pos.portfolio === oldName) {
      pos.portfolio = newName;
    }
  });
  await savePortfolio(portfolio);
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
  const openPositions = portfolio.positions.filter(p => {
    if (p.status !== 'OPEN') return false;
    if (portfolio.excludeCopyTrading && p.id.startsWith('etoro_mirror_')) return false;
    return true;
  });

  const openValue = openPositions.reduce((sum, p) => {
    const currentVal = p.capitalAllocated + (p.unrealizedPnl || 0);
    return sum + currentVal;
  }, 0);

  // P&L: sum directly from positions (accurate for leveraged CFD positions)
  const totalUnrealizedPnL = openPositions.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0);
  const totalRealizedPnL = portfolio.positions
    .filter(p => p.status === 'CLOSED')
    .reduce((sum, p) => sum + ((p as any).realizedPnl || 0), 0);

  portfolio.capitalBase = openPositions.reduce((sum, p) => sum + (p.capitalAllocated || 0), 0);
  portfolio.totalValue = portfolio.capitalAvailable + openValue;
  portfolio.totalPnL = totalUnrealizedPnL + totalRealizedPnL;
  
  const baseForPnL = (portfolio.depositedFunds && portfolio.depositedFunds > 0)
    ? portfolio.depositedFunds
    : (portfolio.capitalBase > 0 ? portfolio.capitalBase : 1);

  portfolio.totalPnLPercent = (portfolio.totalPnL / baseForPnL) * 100;

  // Clean up initial mock refuso (30k) if we have synced real values
  if (portfolio.performanceHistory && portfolio.performanceHistory.length === 1 && portfolio.performanceHistory[0].totalValue === 30000 && portfolio.totalValue !== 30000) {
    portfolio.performanceHistory[0].totalValue = portfolio.totalValue;
    portfolio.performanceHistory[0].pnlPercent = portfolio.totalPnLPercent;
  }

  // Snapshot for performance chart (max once per day, updating today's value dynamically)
  const today = new Date().toISOString().split('T')[0];
  const lastSnapshot = portfolio.performanceHistory ? portfolio.performanceHistory[portfolio.performanceHistory.length - 1] : null;
  if (lastSnapshot && lastSnapshot.date === today) {
    lastSnapshot.totalValue = portfolio.totalValue;
    lastSnapshot.pnlPercent = portfolio.totalPnLPercent;
  } else {
    if (!portfolio.performanceHistory) {
      portfolio.performanceHistory = [];
    }
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

  // Create a map of existing tags and portfolios to preserve them
  const existingTags = new Map<string, string[]>();
  const existingPortfolios = new Map<string, string>();
  portfolio.positions.forEach(p => {
    if (p.tags) existingTags.set(p.symbol, p.tags);
    if (p.portfolio) existingPortfolios.set(p.symbol, p.portfolio);
  });

  // Attach tags and portfolios
  const finalPositions: import('@/types').Position[] = ePositions.map(p => {
    const isCopy = p.symbol.startsWith('COPY:') || p.name.startsWith('Copia ');
    
    let assignedPortfolio = existingPortfolios.get(p.symbol);
    if (!assignedPortfolio) {
      assignedPortfolio = 'Da Assegnare';
    }

    return {
      ...p,
      tags: existingTags.get(p.symbol) || (isCopy ? ['Copia', 'Da Assegnare'] : ['Da Assegnare']),
      portfolio: assignedPortfolio
    };
  });

  // Preserve ONLY truly manual assets: exclude eToro-imported ones (etoro_*)
  // AND exclude old mock/demo positions (id starting with 'd' followed by a digit)
  const manualPositions = portfolio.positions.filter(p => 
    !p.id.startsWith('etoro_') && 
    !/^d\d+$/.test(p.id)
  );

  // Merge: manual first, then fresh eToro positions
  portfolio.positions = [...manualPositions, ...finalPositions];

  // capitalBase = total capital invested in open positions (meaningful for % P&L)
  // Only set if still at default 30000 or zero (preserve user-set value)
  const totalInvested = finalPositions.reduce((sum, p) => sum + (p.capitalAllocated || 0), 0);
  if (portfolio.capitalBase === 30000 || portfolio.capitalBase <= 0) {
    portfolio.capitalBase = totalInvested;
  }

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
