'use client';

import React, { useState, useEffect } from 'react';
import { AppProviders, useApp, formatCurrency, formatPercent } from '@/components/providers';
import { ProjectionCard } from '@/components/projection-card';
import { PortfolioState, CustomPortfolio, Position, Alert } from '@/lib/types';

export type Tab = 'dashboard' | 'signals' | 'positions' | 'market' | 'quontest' | 'trading' | 'pac';

// ─── ICONE (inline SVG) ─────────────────────────────────────────────────────

const IconMoon = () => <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>;
const IconSun = () => <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
const IconEyeOff = () => <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>;
const IconEye = () => <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
const IconPlus = () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const IconTrash = () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const IconTrendingUp = () => <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
const IconTrendingDown = () => <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>;
const IconBell = () => <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;

// ─── COMPONENTI INTERNI ─────────────────────────────────────────────────────

interface HeaderProps {
  portfolio: PortfolioState | null;
}

function Header({ portfolio }: HeaderProps) {
  const { theme, toggleTheme, hideValues, toggleHideValues } = useApp();
  const [alertsOpen, setAlertsOpen] = useState(false);

  const unreadAlerts = portfolio?.alerts.filter(a => !a.read) || [];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-lg">
            α
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Capital Alpha</h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">Risk Budget Framework</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleHideValues}
            className="rounded-lg p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={hideValues ? 'Mostra cifre' : 'Nascondi cifre'}
          >
            {hideValues ? <IconEyeOff /> : <IconEye />}
          </button>
          <button
            onClick={toggleTheme}
            className="rounded-lg p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Cambia tema"
          >
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          <button
            onClick={() => setAlertsOpen(!alertsOpen)}
            className="relative rounded-lg p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <IconBell />
            {unreadAlerts.length > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {alertsOpen && portfolio && <AlertsDropdown portfolio={portfolio} />}
    </header>
  );
}

function AlertsDropdown({ portfolio }: { portfolio: PortfolioState }) {
  return (
    <div className="absolute right-4 top-14 z-50 w-80 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl max-h-[400px] overflow-hidden flex flex-col">
      <div className="border-b border-slate-100 dark:border-slate-800 px-4 py-3 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
        <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">Notifiche</h3>
      </div>
      <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
        {portfolio.alerts && portfolio.alerts.length > 0 ? (
          portfolio.alerts.map(a => (
            <div key={a.id} className={`px-4 py-3 ${!a.read ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${a.type === 'SUCCESS' ? 'bg-emerald-500' : a.type === 'WARNING' ? 'bg-amber-500' : a.type === 'ERROR' ? 'bg-rose-500' : 'bg-blue-500'}`} />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{a.title}</span>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{a.message}</p>
              <div className="mt-1 text-[10px] text-slate-400">{new Date(a.date).toLocaleDateString('it-IT')}</div>
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-xs text-slate-400">Nessuna notifica presente.</div>
        )}
      </div>
    </div>
  );
}

function GlobalCard({ portfolio }: { portfolio: PortfolioState }) {
  const { hideValues } = useApp();
  const isPositive = portfolio.totalPnL >= 0;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <div className="mb-1 text-sm text-slate-500 dark:text-slate-400">Valore totale portafoglio</div>
      <div className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
        {formatCurrency(portfolio.totalValue, hideValues)}
      </div>
      <div className="mt-3 flex items-center gap-4">
        <div className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${isPositive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400'}`}>
          {isPositive ? <IconTrendingUp /> : <IconTrendingDown />}
          {formatPercent(portfolio.totalPnLPercent, hideValues)}
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          P&L: <span className={isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>{formatCurrency(portfolio.totalPnL, hideValues)}</span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Capitale base</div>
          <div className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(portfolio.capitalBase, hideValues)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Liquidità</div>
          <div className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(portfolio.capitalAvailable, hideValues)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Posizioni aperte</div>
          <div className="font-semibold text-slate-800 dark:text-slate-200">{portfolio.positions.filter(x => x.status === 'OPEN').length}</div>
        </div>
      </div>
    </div>
  );
}

interface PortfolioManagerProps {
  portfolios: CustomPortfolio[];
  portfolioState: PortfolioState | null;
  onAddPortfolio: (name: string, pct: number) => Promise<void>;
  onRemovePortfolio: (name: string) => Promise<void>;
}

function PortfolioManager({ portfolios, portfolioState, onAddPortfolio, onRemovePortfolio }: PortfolioManagerProps) {
  const { hideValues } = useApp();
  const [newName, setNewName] = useState('');
  const [newPct, setNewPct] = useState(10);
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!newName.trim() || loading) return;
    setLoading(true);
    try {
      await onAddPortfolio(newName, newPct);
      setNewName('');
      setNewPct(10);
    } finally {
      setLoading(false);
    }
  };

  const totalPct = portfolios.reduce((s, p) => s + p.targetAllocationPct, 0);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-200">Gestione Portfolio</h2>

      <div className="mb-4 flex gap-2">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Nome portfolio..."
          disabled={loading}
          className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
        />
        <input
          type="number"
          min={1} max={100}
          value={newPct}
          onChange={e => setNewPct(Number(e.target.value))}
          disabled={loading}
          className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
        />
        <span className="self-center text-sm text-slate-500">%</span>
        <button
          onClick={handleAdd}
          disabled={loading}
          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          <IconPlus /> Aggiungi
        </button>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {portfolios.map(p => (
          <div key={p.name} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{p.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">{p.targetAllocationPct}%</span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{formatCurrency(p.currentValue, hideValues)}</span>
              <button
                onClick={() => onRemovePortfolio(p.name)}
                disabled={loading}
                className="text-slate-400 hover:text-rose-500 transition-colors disabled:opacity-50"
              >
                <IconTrash />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-between text-xs text-slate-500">
        <span>Totale allocazione:</span>
        <span className={totalPct === 100 ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>{totalPct}% / 100%</span>
      </div>
    </div>
  );
}

function PositionsTable({ portfolio }: { portfolio: PortfolioState }) {
  const { hideValues } = useApp();
  const positions = portfolio.positions.filter(p => p.status === 'OPEN');

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-200">Posizioni Aperte</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs text-slate-500 dark:text-slate-400">
              <th className="pb-2 font-medium">Asset</th>
              <th className="pb-2 font-medium">Portfolio</th>
              <th className="pb-2 font-medium text-right">Prezzo</th>
              <th className="pb-2 font-medium text-right">P&L</th>
              <th className="pb-2 font-medium text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {positions.map(pos => {
              const isPos = (pos.unrealizedPnl || 0) >= 0;
              return (
                <tr key={pos.id} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                  <td className="py-3">
                    <div className="font-medium text-slate-800 dark:text-slate-200">{pos.symbol}</div>
                    <div className="text-xs text-slate-500">{pos.name}</div>
                  </td>
                  <td className="py-3">
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400">{pos.portfolio || 'N/D'}</span>
                  </td>
                  <td className="py-3 text-right text-slate-700 dark:text-slate-300 font-mono">
                    {hideValues ? '••••' : pos.currentPrice?.toFixed(2)} €
                  </td>
                  <td className={`py-3 text-right font-medium font-mono ${isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {formatCurrency(pos.unrealizedPnl || 0, hideValues)}
                  </td>
                  <td className={`py-3 text-right text-xs font-mono ${isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {formatPercent(pos.unrealizedPnlPercent || 0, hideValues)}
                  </td>
                </tr>
              );
            })}
            {positions.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-xs text-slate-400">Nessuna posizione aperta.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TbdStatus({ externalTbdData }: { externalTbdData: any }) {
  const { hideValues } = useApp();

  const realizedPnL = externalTbdData?.today?.realizedPnL ?? 0;
  const totalCapital = externalTbdData?.config?.totalCapital ?? 5000;
  const maxDailyTrades = externalTbdData?.config?.maxDailyTrades ?? 3;
  const todayTradesCount = externalTbdData?.today?.tradesCount ?? 0;
  const lossStreak = externalTbdData?.today?.consecutiveLossStreak ?? 0;

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-400 font-mono">🎯 TBD Hunter</h2>
        <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400 animate-pulse">ATTIVO</span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-2">
        <div>
          <div className="text-xs text-amber-700/70 dark:text-amber-400/70">Risk Budget</div>
          <div className="font-semibold text-amber-900 dark:text-amber-300 font-mono">{formatCurrency(totalCapital, hideValues)}</div>
        </div>
        <div>
          <div className="text-xs text-amber-700/70 dark:text-amber-400/70">Trade Oggi</div>
          <div className="font-semibold text-amber-900 dark:text-amber-300 font-mono">{todayTradesCount} / {maxDailyTrades}</div>
        </div>
        <div>
          <div className="text-xs text-amber-700/70 dark:text-amber-400/70">Streak Loss</div>
          <div className="font-semibold text-amber-900 dark:text-amber-300 font-mono">{lossStreak}</div>
        </div>
        <div>
          <div className="text-xs text-amber-700/70 dark:text-amber-400/70">P&L Oggi</div>
          <div className={`font-semibold font-mono ${realizedPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {realizedPnL >= 0 ? '+' : ''}{formatCurrency(realizedPnL, hideValues)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PAGINA ─────────────────────────────────────────────────────────────────

function Dashboard() {
  const [portfolio, setPortfolio] = useState<PortfolioState | null>(null);
  const [portfolios, setPortfolios] = useState<CustomPortfolio[]>([]);
  const [tbdData, setTbdData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchPortfolioData = async () => {
    try {
      const [pRes, tbdRes] = await Promise.allSettled([
        fetch('/api/portfolio'),
        fetch('/api/tbd/log'),
      ]);

      let pData: any = {};
      if (pRes.status === 'fulfilled') {
        pData = await pRes.value.json().catch(() => ({}));
        if (pData.success && pData.data) {
          setPortfolio(pData.data);
          
          // Map DB string[] to UI CustomPortfolio[]
          const rawPortfolios = pData.data.customPortfolios || [];
          const mapped = rawPortfolios.map((item: any, idx: number) => {
            if (typeof item === 'string') {
              const openPositions = pData.data.positions?.filter((pos: any) => pos.portfolio === item && pos.status === 'OPEN') || [];
              const val = openPositions.reduce((acc: number, pos: any) => acc + ((pos.capitalAllocated || 0) + (pos.unrealizedPnl || 0)), 0);
              const target = pData.data.targets?.[item] ?? 10;
              const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#06b6d4'];
              return {
                name: item,
                targetAllocationPct: target,
                currentValue: val,
                color: colors[idx % colors.length]
              };
            }
            return item;
          });
          setPortfolios(mapped);
        }
      }

      if (tbdRes.status === 'fulfilled') {
        const tData = await tbdRes.value.json().catch(() => ({}));
        if (tData.success) {
          setTbdData(tData.data);
        }
      }
    } catch (e) {
      console.error('[Dashboard fetch error]', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolioData();
  }, []);

  const handleAddPortfolio = async (name: string, pct: number) => {
    const total = portfolios.reduce((s, p) => s + p.targetAllocationPct, 0);
    if (total + pct > 100) {
      alert('Allocazione totale supera 100%');
      return;
    }

    const newTargets = { ...portfolio?.targets, [name]: pct };
    const newList = [...portfolios.map(x => x.name), name];

    // Save changes to DB
    await fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'update_portfolio_targets', targets: newTargets })
    });

    await fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'update_portfolios', customPortfolios: newList })
    });

    await fetchPortfolioData();
  };

  const handleRemovePortfolio = async (name: string) => {
    if (!confirm(`Sei sicuro di voler eliminare il portafoglio "${name}"?`)) return;
    const newList = portfolios.filter(p => p.name !== name).map(x => x.name);

    await fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'update_portfolios', customPortfolios: newList })
    });

    await fetchPortfolioData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4" />
        <span className="text-sm font-mono tracking-widest">CARICAMENTO DATI PORTFOLIO...</span>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <span className="text-sm font-mono text-rose-500">ERRORE: IMPOSSIBILE CARICARE IL PORTAFOGLIO</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Header portfolio={portfolio} />

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Riga 1: Globale + Manager */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <GlobalCard portfolio={portfolio} />
          </div>
          <div>
            <PortfolioManager
              portfolios={portfolios}
              portfolioState={portfolio}
              onAddPortfolio={handleAddPortfolio}
              onRemovePortfolio={handleRemovePortfolio}
            />
          </div>
        </div>

        {/* Riga 2: Proiezioni p10/p50/p90 */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-200 font-mono tracking-wide">
            PROIEZIONI ANNALI (RISK BUDGET)
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {portfolios.map(b => (
              <ProjectionCard
                key={b.name}
                name={b.name}
                allocationPct={b.targetAllocationPct}
                currentValue={b.currentValue}
                projection={portfolio.bucketProjections?.[b.name]}
                color={b.color || '#6366f1'}
              />
            ))}
            {portfolios.length === 0 && (
              <div className="col-span-3 text-center py-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                Nessun portafoglio configurato per le proiezioni.
              </div>
            )}
          </div>
        </div>

        {/* Riga 3: TBD + Posizioni */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PositionsTable portfolio={portfolio} />
          </div>
          <div>
            <TbdStatus externalTbdData={tbdData} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <AppProviders>
      <Dashboard />
    </AppProviders>
  );
}
