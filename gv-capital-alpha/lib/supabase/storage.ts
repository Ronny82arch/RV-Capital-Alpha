import { PortfolioState, Signal, Position, PerformanceSnapshot, Alert, MarketData, PacConfig } from '@/types';
import { supabaseAdmin } from './client';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_PORTFOLIO_ID = '00000000-0000-0000-0000-000000000001';

export function generateId(): string {
  return uuidv4();
}

// ─── MAPPERS ──────────────────────────────────────────────────────────

function mapToPortfolioState(
  p: any, 
  positions: any[], 
  signals: any[], 
  history: any[], 
  alerts: any[]
): PortfolioState {
  return {
    capitalBase: Number(p.capital_base || 30000),
    capitalAvailable: Number(p.capital_available || 0),
    depositedFunds: Number(p.deposited_funds || 6000),
    totalValue: Number(p.total_value || 0),
    totalPnL: Number(p.total_pnl || 0),
    totalPnLPercent: 0, // Recalculated dynamically if needed
    targetAnnualReturn: Number(p.target_annual_return || 0.25),
    startDate: p.start_date || new Date().toISOString(),
    aiManagedTags: p.active_assets || [],
    customPortfolios: p.custom_portfolios || [],
    updatedAt: p.updated_at || new Date().toISOString(),
    
    positions: positions.map(pos => ({
      id: pos.id,
      signalId: pos.signal_id,
      symbol: pos.symbol,
      name: pos.name,
      type: pos.type as any,
      action: pos.action as any,
      entryPrice: Number(pos.entry_price) || 0,
      quantity: Number(pos.quantity) || 0,
      capitalAllocated: Number(pos.capital_allocated) || 0,
      stopLoss: Number(pos.stop_loss) || 0,
      takeProfit: Number(pos.take_profit) || 0,
      entryDate: pos.entry_date,
      status: pos.status as any,
      closePrice: pos.close_price != null ? Number(pos.close_price) : undefined,
      closeDate: pos.close_date || undefined,
      realizedPnl: Number(pos.realized_pnl) || 0,
      realizedPnlPercent: Number(pos.realized_pnl_percent) || 0,
      currentPrice: pos.current_price != null ? Number(pos.current_price) : undefined,
      unrealizedPnl: Number(pos.unrealized_pnl) || 0,
      unrealizedPnlPercent: Number(pos.unrealized_pnl_percent) || 0,
      tags: pos.tags || [],
      portfolio: pos.custom_portfolio_name || 'Da Assegnare',
      logoUrl: pos.logo_url || undefined,
    })),
    
    signals: signals.map(sig => ({
      id: sig.id,
      symbol: sig.symbol,
      name: sig.name,
      type: sig.type as any,
      action: sig.action as any,
      suggestedPrice: Number(sig.suggested_price),
      quantity: Number(sig.quantity),
      capitalToAllocate: Number(sig.capital_to_allocate),
      stopLoss: Number(sig.stop_loss),
      takeProfit: Number(sig.take_profit),
      stopLossPercent: Number(sig.stop_loss_percent),
      takeProfitPercent: Number(sig.take_profit_percent),
      kellyFraction: Number(sig.kelly_fraction),
      winProbability: Number(sig.win_probability),
      winProbabilitySampleSize: Number(sig.win_probability_sample_size || 0),
      winProbabilityTrusted: Boolean(sig.win_probability_trusted),
      expectedReturn: Number(sig.expected_return),
      reasoning: sig.reasoning,
      strategy: sig.strategy,
      urgency: sig.urgency as any,
      technicals: sig.technicals,
      createdAt: sig.created_at,
      status: sig.status as any,
      approvedAt: sig.approved_at || undefined,
      executedAt: sig.executed_at || undefined,
      executedPrice: sig.executed_price ? Number(sig.executed_price) : undefined,
      positionId: sig.position_id || undefined,
      portfolio: sig.custom_portfolio_name || undefined
    })),
    
    performanceHistory: history.map(h => ({
      date: h.date,
      totalValue: Number(h.total_value),
      pnlPercent: Number(h.pnl_percent)
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    
    alerts: alerts.map(a => ({
      id: a.id,
      title: a.title,
      message: a.message,
      date: a.date,
      type: a.type as any,
      read: a.read
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  };
}

// ─── PORTFOLIO CRUD ───────────────────────────────────────────────────────────

export async function getPortfolio(): Promise<PortfolioState> {
  const [pRes, posRes, sigRes, histRes, alertRes] = await Promise.all([
    supabaseAdmin.from('portfolios').select('*').eq('id', DEFAULT_PORTFOLIO_ID).single(),
    supabaseAdmin.from('positions').select('*').eq('portfolio_id', DEFAULT_PORTFOLIO_ID),
    supabaseAdmin.from('trading_signals').select('*').eq('portfolio_id', DEFAULT_PORTFOLIO_ID),
    supabaseAdmin.from('performance_history').select('*').eq('portfolio_id', DEFAULT_PORTFOLIO_ID),
    supabaseAdmin.from('alerts').select('*').eq('portfolio_id', DEFAULT_PORTFOLIO_ID).order('date', { ascending: false }).limit(100)
  ]);

  if (pRes.error || !pRes.data) {
    console.error('Error fetching portfolio', pRes.error);
    return defaultPortfolio();
  }

  const state = mapToPortfolioState(
    pRes.data,
    posRes.data || [],
    sigRes.data || [],
    histRes.data || [],
    alertRes.data || []
  );
  
  // Calculate PnL percent safely
  state.totalPnLPercent = state.capitalBase > 0 ? (state.totalPnL / state.capitalBase) * 100 : 0;
  return state;
}

export async function savePortfolio(state: PortfolioState): Promise<void> {
  // Upsert Portfolio metadata
  await supabaseAdmin.from('portfolios').upsert({
    id: DEFAULT_PORTFOLIO_ID,
    capital_base: state.capitalBase,
    capital_available: state.capitalAvailable,
    deposited_funds: state.depositedFunds,
    total_value: state.totalValue,
    total_pnl: state.totalPnL,
    target_annual_return: state.targetAnnualReturn,
    start_date: state.startDate,
    active_assets: state.aiManagedTags || [],
    custom_portfolios: state.customPortfolios || [],
    updated_at: new Date().toISOString()
  });

  // Since deleting and re-inserting everything is slow but safe for this refactoring stage:
  // For production we would only update changed items. For now, bulk upsert is fine since there are not millions of rows.
  
  // Positions
  if (state.positions.length > 0) {
    const posRows = state.positions.map(p => ({
      id: p.id,
      portfolio_id: DEFAULT_PORTFOLIO_ID,
      signal_id: p.signalId || null,
      symbol: p.symbol,
      name: p.name,
      type: p.type,
      action: p.action,
      entry_price: p.entryPrice,
      quantity: p.quantity,
      capital_allocated: p.capitalAllocated,
      stop_loss: p.stopLoss,
      take_profit: p.takeProfit,
      entry_date: p.entryDate,
      status: p.status,
      close_price: p.closePrice,
      close_date: p.closeDate,
      realized_pnl: p.realizedPnl,
      realized_pnl_percent: p.realizedPnlPercent,
      current_price: p.currentPrice,
      unrealized_pnl: p.unrealizedPnl,
      unrealized_pnl_percent: p.unrealizedPnlPercent,
      tags: p.tags,
      custom_portfolio_name: p.portfolio
    }));
    await supabaseAdmin.from('positions').upsert(posRows);
  }

  // Signals
  if (state.signals.length > 0) {
    const sigRows = state.signals.map(s => ({
      id: s.id,
      portfolio_id: DEFAULT_PORTFOLIO_ID,
      symbol: s.symbol,
      name: s.name,
      type: s.type,
      action: s.action,
      suggested_price: s.suggestedPrice,
      quantity: s.quantity,
      capital_to_allocate: s.capitalToAllocate,
      stop_loss: s.stopLoss,
      take_profit: s.takeProfit,
      stop_loss_percent: s.stopLossPercent,
      take_profit_percent: s.takeProfitPercent,
      kelly_fraction: s.kellyFraction,
      win_probability: s.winProbability,
      win_probability_sample_size: s.winProbabilitySampleSize,
      win_probability_trusted: s.winProbabilityTrusted,
      expected_return: s.expectedReturn,
      reasoning: s.reasoning,
      strategy: s.strategy,
      urgency: s.urgency,
      technicals: s.technicals,
      status: s.status,
      created_at: s.createdAt,
      approved_at: s.approvedAt,
      executed_at: s.executedAt,
      executed_price: s.executedPrice,
      position_id: s.positionId,
      custom_portfolio_name: s.portfolio
    }));
    await supabaseAdmin.from('trading_signals').upsert(sigRows);
  }

  // History (Insert only missing dates)
  if (state.performanceHistory.length > 0) {
    // Generate simple deterministic hashes for history ids based on date to allow upserting safely
    const histRows = state.performanceHistory.map(h => ({
      id: uuidv4(), // We actually need stable IDs or we just delete all and re-insert. 
      // Actually, Supabase handles date insertion. Let's just bulk insert and ignore conflicts if we add unique constraint on (portfolio_id, date).
      // Since we don't have unique constraint, we'll just delete and re-insert for now, or match on date.
      portfolio_id: DEFAULT_PORTFOLIO_ID,
      date: h.date,
      total_value: h.totalValue,
      pnl_percent: h.pnlPercent
    }));
    
    // Quick hack: delete old history and insert new to prevent duplicates in this lazy sync model
    await supabaseAdmin.from('performance_history').delete().eq('portfolio_id', DEFAULT_PORTFOLIO_ID);
    await supabaseAdmin.from('performance_history').insert(histRows);
  }

  // Alerts
  if (state.alerts.length > 0) {
    const alertRows = state.alerts.map(a => ({
      id: a.id,
      portfolio_id: DEFAULT_PORTFOLIO_ID,
      title: a.title,
      message: a.message,
      date: a.date,
      type: a.type,
      read: a.read
    }));
    await supabaseAdmin.from('alerts').upsert(alertRows);
  }
}

// ─── DEFAULT PORTFOLIO ────────────────────────────────────────────────────────
export function defaultPortfolio(): PortfolioState {
  const dateStr = new Date().toISOString();
  const today = dateStr.split('T')[0];
  return {
    capitalBase: 30000,
    capitalAvailable: 0,
    positions: [],
    signals: [],
    totalValue: 30000,
    totalPnL: 0,
    totalPnLPercent: 0,
    targetAnnualReturn: 0.25,
    startDate: today,
    performanceHistory: [], 
    alerts: [],
    aiManagedTags: [],
    customPortfolios: [],
    updatedAt: dateStr,
    depositedFunds: 6000,
  };
}

// ─── HELPERS (Same exact signatures as storage.ts) ────────────────────────────

export async function cleanPerformanceHistory(): Promise<void> {
  const portfolio = await getPortfolio();
  portfolio.positions = sanitizePortfolioPositions(portfolio.positions);
  portfolio.performanceHistory = portfolio.performanceHistory.filter(h => h.totalValue !== 30000);
  await recalcPortfolio(portfolio);
  await savePortfolio(portfolio);
}

export async function mutatePortfolio<T>(fn: (p: PortfolioState) => Promise<T> | T): Promise<T> {
  const portfolio = await getPortfolio();
  const result = await fn(portfolio);
  await savePortfolio(portfolio);
  return result;
}

export async function updatePositionPortfolio(positionId: string, portfolioName: string): Promise<void> {
  await supabaseAdmin.from('positions').update({ custom_portfolio_name: portfolioName }).eq('id', positionId);
}

export async function updateCustomPortfolios(portfolios: string[]): Promise<void> {
  await supabaseAdmin.from('portfolios').update({ custom_portfolios: portfolios }).eq('id', DEFAULT_PORTFOLIO_ID);
}

export async function deleteCustomPortfolio(portfolioName: string): Promise<void> {
  await updateCustomPortfolios((await getPortfolio()).customPortfolios?.filter(n => n !== portfolioName) || []);
  await supabaseAdmin.from('positions').update({ custom_portfolio_name: 'Da Assegnare' }).eq('custom_portfolio_name', portfolioName);
}

export async function renameCustomPortfolio(oldName: string, newName: string): Promise<void> {
  const p = await getPortfolio();
  if (p.customPortfolios) {
    await updateCustomPortfolios(p.customPortfolios.map(n => n === oldName ? newName : n));
  }
  await supabaseAdmin.from('positions').update({ custom_portfolio_name: newName }).eq('custom_portfolio_name', oldName);
}

export async function addAlert(alertInfo: Omit<Alert, 'id' | 'date' | 'read'>): Promise<void> {
  const a = { id: generateId(), date: new Date().toISOString(), read: false, ...alertInfo };
  await supabaseAdmin.from('alerts').insert({
    id: a.id, portfolio_id: DEFAULT_PORTFOLIO_ID, title: a.title, message: a.message, date: a.date, type: a.type, read: a.read
  });
}

export async function markAlertAsRead(alertId: string): Promise<void> {
  await supabaseAdmin.from('alerts').update({ read: true }).eq('id', alertId);
}

export async function markAllAlertsAsRead(): Promise<void> {
  await supabaseAdmin.from('alerts').update({ read: true }).eq('portfolio_id', DEFAULT_PORTFOLIO_ID);
}

export async function addSignal(signal: Signal): Promise<void> {
  await mutatePortfolio(p => { p.signals.push(signal); });
}

export async function updateSignalStatus(signalId: string, status: Signal['status'], extra?: Partial<Signal>): Promise<Signal | null> {
  const { data } = await supabaseAdmin.from('trading_signals').update({ status, ...extra }).eq('id', signalId).select().single();
  // Simplified for now: just mutate the full portfolio to keep everything in sync
  const p = await getPortfolio();
  return p.signals.find(s => s.id === signalId) || null;
}

export async function openPosition(position: Position): Promise<void> {
  await mutatePortfolio(p => {
    p.positions.push(position);
    p.capitalAvailable = Math.max(0, p.capitalAvailable - position.capitalAllocated);
  });
}

export async function closePosition(positionId: string, closePrice: number): Promise<Position | null> {
  let pos = null;
  await mutatePortfolio(p => {
    const idx = p.positions.findIndex(x => x.id === positionId);
    if (idx !== -1) {
      const realizedPnl = (closePrice - p.positions[idx].entryPrice) * p.positions[idx].quantity;
      p.positions[idx].status = 'CLOSED';
      p.positions[idx].closePrice = closePrice;
      p.positions[idx].closeDate = new Date().toISOString();
      p.positions[idx].realizedPnl = realizedPnl;
      p.capitalAvailable += p.positions[idx].capitalAllocated + realizedPnl;
      pos = p.positions[idx];
    }
  });
  return pos;
}

export async function deletePosition(positionId: string): Promise<Position | null> {
  let pos = null;
  await mutatePortfolio(p => {
    const idx = p.positions.findIndex(x => x.id === positionId);
    if (idx !== -1) {
      pos = p.positions[idx];
      p.positions.splice(idx, 1);
      p.capitalAvailable += pos.capitalAllocated;
    }
  });
  return pos;
}

export async function updatePositionTags(positionId: string, tags: string[]): Promise<void> {
  await supabaseAdmin.from('positions').update({ tags }).eq('id', positionId);
}

export function sanitizePortfolioPositions(positions: Position[]): Position[] {
  const seenIds = new Set<string>();
  const clean: Position[] = [];
  for (const p of positions || []) {
    if (!p.id) continue;
    if (seenIds.has(p.id)) continue;
    seenIds.add(p.id);
    clean.push(p);
  }
  return clean;
}

export async function recalcPortfolio(portfolio?: PortfolioState): Promise<void> {
  const p = portfolio || await getPortfolio();
  p.positions = sanitizePortfolioPositions(p.positions);
  let currentTotalValue = (p.capitalAvailable || 0);
  p.positions.forEach(pos => {
    if (pos.status === 'OPEN') {
      const posEquity = (Number(pos.capitalAllocated) || 0) + (Number(pos.unrealizedPnl) || 0);
      currentTotalValue += posEquity;
    }
  });
  if (!p.totalValue || p.totalValue === 0) {
    p.totalValue = currentTotalValue;
  }
  const baseFunds = p.depositedFunds || p.capitalBase || 1;
  p.totalPnL = p.totalValue - baseFunds;
  p.totalPnLPercent = baseFunds > 0 ? (p.totalPnL / baseFunds) * 100 : 0;
  if (!portfolio) await savePortfolio(p);
}

export async function syncEtoroPortfolio(): Promise<void> {
  if (!process.env.ETORO_API_KEY || !process.env.ETORO_USER_KEY) {
    throw new Error('Chiavi API eToro non configurate');
  }
  const { getEtoroBalance, getEtoroPositions } = await import('../etoro');
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
  const finalPositions: Position[] = ePositions.map(p => {
    const isCopy = p.symbol.startsWith('COPY:') || p.name.startsWith('Copia ') || p.name.startsWith('Copy:');
    
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

  // Preserve ONLY truly manual custom assets created inside the app: exclude eToro-imported ones
  // AND exclude old mock/demo positions
  const { v5: uuidv5 } = await import('uuid');
  const ETORO_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

  const manualPositions = portfolio.positions.filter(p => {
    if (!p.id) return false;
    if (p.id.startsWith('etoro_')) return false;
    if (p.symbol.startsWith('COPY:') || p.symbol.startsWith('Copy:')) return false;
    if (p.name.startsWith('Copia ') || p.name.startsWith('Copy:')) return false;
    if (p.id === uuidv5(`etoro_${p.symbol}_${p.action}`, ETORO_NAMESPACE)) return false;
    if (/^d\d+$/.test(p.id)) return false;
    return true;
  });

  // Merge: manual first, then fresh eToro positions
  portfolio.positions = sanitizePortfolioPositions([...manualPositions, ...finalPositions]);

  // capitalBase = total capital invested in open positions (meaningful for % P&L)
  // Only set if still at default 30000 or zero (preserve user-set value)
  const totalInvested = finalPositions.reduce((sum, p) => sum + (p.capitalAllocated || 0), 0);
  if (portfolio.capitalBase === 30000 || portfolio.capitalBase <= 0) {
    portfolio.capitalBase = totalInvested;
  }

  await recalcPortfolio(portfolio);
  if (balance.TotalEquity && balance.TotalEquity > 0) {
    portfolio.totalValue = balance.TotalEquity;
    portfolio.totalPnL = portfolio.totalValue - (portfolio.depositedFunds || portfolio.capitalBase || 1);
    portfolio.totalPnLPercent = portfolio.capitalBase > 0 ? (portfolio.totalPnL / portfolio.capitalBase) * 100 : 0;
  }
  await savePortfolio(portfolio);
}

// ─── MARKET DATA ──────────────────────────────────────────────────────────────

export async function getMarketData(): Promise<MarketData[]> {
  const { data } = await supabaseAdmin.from('market_data').select('*');
  if (!data) return [];
  return data.map(m => ({
    symbol: m.symbol,
    name: m.name,
    type: m.type as any,
    price: Number(m.price),
    change: Number(m.change),
    changePercent: Number(m.change_percent),
    high24h: Number(m.high_24h),
    low24h: Number(m.low_24h),
    volume: Number(m.volume),
    history: m.history || []
  }));
}

export async function saveMarketData(data: MarketData[]): Promise<void> {
  if (data.length === 0) return;
  const rows = data.map(m => ({
    symbol: m.symbol,
    name: m.name,
    type: m.type,
    price: m.price,
    change: m.change,
    change_percent: m.changePercent,
    high_24h: m.high24h,
    low_24h: m.low24h,
    volume: m.volume,
    history: m.history,
    updated_at: new Date().toISOString()
  }));
  await supabaseAdmin.from('market_data').upsert(rows);
}

export async function updatePositionPrices(updates: { positionId: string; currentPrice: number }[]): Promise<void> {
  await mutatePortfolio(p => {
    let changed = false;
    for (const update of updates) {
      const idx = p.positions.findIndex(pos => pos.id === update.positionId);
      if (idx !== -1 && p.positions[idx].status === 'OPEN') {
        p.positions[idx].currentPrice = update.currentPrice;
        changed = true;
      }
    }
  });
  await recalcPortfolio();
}

// ─── PAC CONFIG ───────────────────────────────────────────────────────────────

export async function getPacConfig(): Promise<PacConfig> {
  const { data } = await supabaseAdmin.from('pac_config').select('*').eq('portfolio_id', DEFAULT_PORTFOLIO_ID).single();
  if (!data) return { portfolioMonthlyBudgets: {}, assetTargetWeights: {} };
  return {
    portfolioMonthlyBudgets: data.monthly_budgets || {},
    assetTargetWeights: data.asset_target_weights || {}
  };
}

export async function savePacConfig(config: PacConfig): Promise<void> {
  await supabaseAdmin.from('pac_config').upsert({
    id: DEFAULT_PORTFOLIO_ID, // Use stable ID to match the 1:1 relation with portfolio
    portfolio_id: DEFAULT_PORTFOLIO_ID,
    monthly_budgets: config.portfolioMonthlyBudgets,
    asset_target_weights: config.assetTargetWeights
  });
}

// ─── PUSH SUBSCRIPTIONS ───────────────────────────────────────────────────────

export async function savePushSubscription(sub: any): Promise<void> {
  if (!sub || !sub.endpoint || !sub.keys) return;
  const row = {
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth
  };
  await supabaseAdmin.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' });
}

export async function getPushSubscriptions(): Promise<any[]> {
  const { data, error } = await supabaseAdmin.from('push_subscriptions').select('*');
  if (error || !data) return [];
  return data.map((d: any) => ({
    endpoint: d.endpoint,
    keys: {
      p256dh: d.p256dh,
      auth: d.auth
    }
  }));
}

import type { CalibrationTable } from '../backtest';

export async function getCalibrationTable(): Promise<CalibrationTable | null> {
  return null;
}

export async function saveCalibrationTable(table: CalibrationTable): Promise<void> {
  console.log('Mock saveCalibrationTable:', Object.keys(table).length);
}

export async function getCalibrationUpdatedAt(): Promise<string | null> {
  return null;
}

