'use client';

import React, { useState, useEffect } from 'react';
import { AppProviders, useApp, formatCurrency, formatPercent } from '@/components/providers';
import { ProjectionCard } from '@/components/projection-card';
import { usePortfolio } from '@/hooks/use-portfolio';
import { useTbd } from '@/hooks/use-tbd';
import { useSatellite } from '@/hooks/use-satellite';
import { Position, CustomPortfolio } from '@/lib/types';

export type Tab = 'dashboard' | 'signals' | 'positions' | 'market' | 'quontest' | 'trading' | 'pac';

// ─── ICONE ──────────────────────────────────────────────────────────────────

const IconMoon = () => <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>;
const IconSun = () => <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
const IconEyeOff = () => <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>;
const IconEye = () => <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
const IconPlus = () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const IconTrash = () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const IconTrendingUp = () => <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
const IconTrendingDown = () => <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>;
const IconBell = () => <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
const IconRefresh = () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
const IconScan = () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const IconLoading = () => <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>;

// ─── COMPONENTI ─────────────────────────────────────────────────────────────

function Header({ onRefresh, refreshing, portfolio }: { onRefresh: () => void; refreshing: boolean; portfolio: any }) {
  const { theme, toggleTheme, hideValues, toggleHideValues } = useApp();
  const [alertsOpen, setAlertsOpen] = useState(false);

  const unreadAlerts = portfolio?.alerts?.filter((a: any) => !a.read) || [];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-lg">α</div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Capital Alpha</h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">Risk Budget Framework</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onRefresh} disabled={refreshing} className="rounded-lg p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50" title="Aggiorna">
            <IconRefresh />
          </button>
          <button onClick={toggleHideValues} className="rounded-lg p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title={hideValues ? 'Mostra cifre' : 'Nascondi cifre'}>
            {hideValues ? <IconEyeOff /> : <IconEye />}
          </button>
          <button onClick={toggleTheme} className="rounded-lg p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Cambia tema">
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          <button onClick={() => setAlertsOpen(!alertsOpen)} className="relative rounded-lg p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <IconBell />
            {unreadAlerts.length > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {alertsOpen && portfolio && (
        <div className="absolute right-4 top-14 z-50 w-80 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl max-h-64 overflow-y-auto">
          <div className="border-b border-slate-100 dark:border-slate-800 px-4 py-3">
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">Notifiche</h3>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {portfolio.alerts?.length > 0 ? (
              portfolio.alerts.map((a: any) => (
                <div key={a.id} className={`px-4 py-3 ${!a.read ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${a.type === 'SUCCESS' ? 'bg-emerald-500' : a.type === 'WARNING' ? 'bg-amber-500' : a.type === 'ERROR' ? 'bg-rose-500' : 'bg-blue-500'}`} />
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{a.title}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{a.message}</p>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-center text-xs text-slate-400">Nessuna notifica.</div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function GlobalCard({ portfolio }: { portfolio: any }) {
  const { hideValues } = useApp();
  const isPositive = (portfolio.totalPnL || 0) >= 0;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <div className="mb-1 text-sm text-slate-500 dark:text-slate-400">Valore totale portafoglio</div>
      <div className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">{formatCurrency(portfolio.totalValue || 0, hideValues)}</div>
      <div className="mt-3 flex items-center gap-4">
        <div className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${isPositive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400'}`}>
          {isPositive ? <IconTrendingUp /> : <IconTrendingDown />}
          {formatPercent(portfolio.totalPnLPercent || 0, hideValues)}
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          P&L: <span className={isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>{formatCurrency(portfolio.totalPnL || 0, hideValues)}</span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Capitale base</div>
          <div className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(portfolio.capitalBase || 0, hideValues)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Liquidità</div>
          <div className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(portfolio.capitalAvailable || 0, hideValues)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Posizioni aperte</div>
          <div className="font-semibold text-slate-800 dark:text-slate-200">{(portfolio.positions || []).filter((x: any) => x.status === 'OPEN').length}</div>
        </div>
      </div>
    </div>
  );
}

function PortfolioManager({ portfolios, onAdd, onRemove, loading }: {
  portfolios: CustomPortfolio[];
  onAdd: (name: string, pct: number) => Promise<boolean>;
  onRemove: (name: string) => Promise<boolean>;
  loading: boolean;
}) {
  const { hideValues } = useApp();
  const [newName, setNewName] = useState('');
  const [newPct, setNewPct] = useState(10);
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const total = portfolios.reduce((s, p) => s + p.targetAllocationPct, 0);
    if (total + newPct > 100) { alert('Allocazione totale supera 100%'); return; }
    setAdding(true);
    const ok = await onAdd(newName.trim(), newPct);
    setAdding(false);
    if (ok) { setNewName(''); setNewPct(10); }
  };

  const totalPct = portfolios.reduce((s, p) => s + p.targetAllocationPct, 0);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-200">Gestione Portfolio</h2>
      <div className="mb-4 flex gap-2">
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome portfolio..."
          className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500" />
        <input type="number" min={1} max={100} value={newPct} onChange={e => setNewPct(Number(e.target.value))}
          className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500" />
        <span className="self-center text-sm text-slate-500">%</span>
        <button onClick={handleAdd} disabled={adding || loading}
          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50">
          {adding ? <IconLoading /> : <IconPlus />} Aggiungi
        </button>
      </div>
      <div className="space-y-2">
        {portfolios.map(p => (
          <div key={p.name} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{p.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">{p.targetAllocationPct}%</span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{formatCurrency(p.currentValue, hideValues)}</span>
              <button onClick={() => onRemove(p.name)} className="text-slate-400 hover:text-rose-500 transition-colors"><IconTrash /></button>
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

function PositionsTable({ positions }: { positions: Position[] }) {
  const { hideValues } = useApp();
  const open = positions.filter(p => p.status === 'OPEN');

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm font-mono">
      <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-200">Posizioni Aperte</h2>
      {open.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">Nessuna posizione aperta</div>
      ) : (
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
              {open.map(pos => {
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
                    <td className="py-3 text-right text-slate-700 dark:text-slate-300">{hideValues ? '••••' : (pos.currentPrice || 0).toFixed(2)} €</td>
                    <td className={`py-3 text-right font-medium ${isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{formatCurrency(pos.unrealizedPnl || 0, hideValues)}</td>
                    <td className={`py-3 text-right text-xs ${isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{formatPercent(pos.unrealizedPnlPercent || 0, hideValues)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TbdPanel({ tbdHook }: { tbdHook: ReturnType<typeof useTbd> }) {
  const { hideValues } = useApp();
  const { scanning, lastScan, triggerScan, tbdLog } = tbdHook;

  const realizedPnL = tbdLog?.today?.realizedPnL ?? lastScan?.tbdCapitalToday ?? 0;
  const totalCapital = tbdLog?.config?.totalCapital ?? lastScan?.tbdCapitalToday ?? 5000;
  const maxDailyTrades = tbdLog?.config?.maxDailyTrades ?? 3;
  const todayTradesCount = tbdLog?.today?.tradesCount ?? lastScan?.newSignals ?? 0;
  const lossStreak = tbdLog?.today?.consecutiveLossStreak ?? 0;
  const antigravityStatus = lastScan?.antigravityStatus ?? (tbdLog?.today?.protectActive ? 'PROTECTED' : 'NORMAL');

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-400 font-mono">🎯 TBD Hunter</h2>
        <button onClick={triggerScan} disabled={scanning}
          className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors disabled:opacity-50">
          {scanning ? <IconLoading /> : <IconScan />} Scan
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 font-mono">
        <div>
          <div className="text-xs text-amber-700/70 dark:text-amber-400/70">Risk Budget</div>
          <div className="font-semibold text-amber-900 dark:text-amber-300">{formatCurrency(totalCapital, hideValues)}</div>
        </div>
        <div>
          <div className="text-xs text-amber-700/70 dark:text-amber-400/70">Trade Oggi</div>
          <div className="font-semibold text-amber-900 dark:text-amber-300">{todayTradesCount} / {maxDailyTrades}</div>
        </div>
        <div>
          <div className="text-xs text-amber-700/70 dark:text-amber-400/70">Streak Loss</div>
          <div className="font-semibold text-amber-900 dark:text-amber-300">{lossStreak}</div>
        </div>
        <div>
          <div className="text-xs text-amber-700/70 dark:text-amber-400/70">Stato AG</div>
          <div className="font-semibold text-amber-900 dark:text-amber-300">{antigravityStatus}</div>
        </div>
      </div>
      {lastScan?.signals && lastScan.signals.length > 0 && (
        <div className="mt-3 rounded-lg bg-white dark:bg-slate-800 p-3 text-xs font-mono">
          <div className="font-medium text-slate-700 dark:text-slate-300 mb-1">Nuovi segnali:</div>
          {lastScan.signals.map((s, i) => (
            <div key={i} className="flex justify-between py-0.5">
              <span>{s.asset} {s.direction} (Q:{s.qualityScore})</span>
              <span className="text-emerald-600 font-bold">+{s.expectedPnL.toFixed(2)}€</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SatellitePanel({ satHook }: { satHook: ReturnType<typeof useSatellite> }) {
  const { loading, lastResult, triggerScan } = satHook;

  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-900/10 p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-indigo-800 dark:text-indigo-400 font-mono">🛰️ Satellite</h2>
        <button onClick={triggerScan} disabled={loading}
          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50">
          {loading ? <IconLoading /> : <IconScan />} Scan
        </button>
      </div>
      {lastResult?.success && lastResult.signalsGenerated ? (
        <div className="text-sm text-indigo-700 dark:text-indigo-300 font-mono">
          {lastResult.signalsGenerated} segnali generati
          {lastResult.topSignal && (
            <div className="mt-1 text-xs text-indigo-600/70 dark:text-indigo-400/70">
              Top: {lastResult.topSignal.symbol} ({lastResult.topSignal.action})
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-indigo-600/70 dark:text-indigo-400/70 font-mono">Clicca Scan per analizzare il mercato</div>
      )}
    </div>
  );
}

// ─── PAGINA ─────────────────────────────────────────────────────────────────

function Dashboard() {
  const { portfolio, loading, error, refresh, addCustomPortfolio, removeCustomPortfolio } = usePortfolio();
  const tbd = useTbd();
  const satellite = useSatellite();

  if (loading && !portfolio) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 font-mono">
        <IconLoading />
        <p className="mt-4 text-xs tracking-widest">CARICAMENTO PORTFOLIO IN CORSO...</p>
      </div>
    );
  }

  if (error && !portfolio) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 font-mono">
        <div className="text-center max-w-md">
          <p className="text-rose-500 font-bold">ERRORE CARICAMENTO</p>
          <p className="text-xs text-slate-500 mt-1">{error}</p>
          <button onClick={refresh} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white uppercase tracking-wider">Riprova</button>
        </div>
      </div>
    );
  }

  const p = portfolio!;
  const buckets = p.customPortfolios || [];
  const positions = p.positions || [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Header onRefresh={refresh} refreshing={loading} portfolio={p} />

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Riga 1: Globale + Manager */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2"><GlobalCard portfolio={p} /></div>
          <div>
            <PortfolioManager
              portfolios={buckets}
              onAdd={addCustomPortfolio}
              onRemove={removeCustomPortfolio}
              loading={loading}
            />
          </div>
        </div>

        {/* Riga 2: Proiezioni */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-200 font-mono tracking-wide">
            PROIEZIONI ANNALI (RISK BUDGET)
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {buckets.map(b => (
              <ProjectionCard
                key={b.name}
                name={b.name}
                allocationPct={b.targetAllocationPct}
                currentValue={b.currentValue}
                projection={p.bucketProjections?.[b.name]}
                color={b.color || '#6366f1'}
              />
            ))}
          </div>
        </div>

        {/* Riga 3: TBD + Satellite */}
        <div className="grid gap-6 lg:grid-cols-2">
          <TbdPanel tbdHook={tbd} />
          <SatellitePanel satHook={satellite} />
        </div>

        {/* Riga 4: Posizioni */}
        <PositionsTable positions={positions} />
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
