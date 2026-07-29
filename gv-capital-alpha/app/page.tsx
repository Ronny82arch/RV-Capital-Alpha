'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PortfolioState, Signal, Position, MarketData } from '@/types';
import Header from '@/components/Header';
import TabBar from '@/components/TabBar';
import DashboardTab from '@/components/DashboardTab';
import SignalsTab from '@/components/SignalsTab';
import PositionsTab from '@/components/PositionsTab';
import MarketTab from '@/components/MarketTab';
import QuontestTab from '@/components/QuontestTab';
import TradingByDayTab from '@/components/TradingByDayTab';
import PacSimulatorTab from '@/components/PacSimulatorTab';
import ChatWidget from '@/components/ChatWidget';
import { AppProviders } from '@/components/providers';


export type Tab = 'dashboard' | 'signals' | 'positions' | 'market' | 'quontest' | 'trading' | 'pac';

const MOCK_PORTFOLIO: PortfolioState = {
  id: '00000000-0000-0000-0000-000000000001',
  capitalBase: 9771.099,
  capitalAvailable: 414.64,
  depositedFunds: 6000,
  totalValue: 11266.09,
  totalPnL: 5266.09,
  totalPnLPercent: 87.76,
  targetAnnualReturn: 0.25,
  startDate: '2026-07-23T00:00:00Z',
  updatedAt: new Date().toISOString(),

  // ── NUOVI CAMPI ANTIGRAVITY ──────────────────────────────────────────────
  antigravityTargetLeverage: 1.5,
  antigravityCooldownUntil: null,
  tbdRealizedPnL: 0,

  positions: [
    {
      id: 'd1',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      type: 'STOCK',
      action: 'BUY',
      entryPrice: 150,
      quantity: 10,
      capitalAllocated: 1500,
      stopLoss: 140,
      takeProfit: 170,
      entryDate: new Date().toISOString(),
      status: 'OPEN',
      currentPrice: 160,
      unrealizedPnl: 100,
      unrealizedPnlPercent: 6.67,
      portfolio: 'Core',
      realizedPnl: 0,
      realizedPnlPercent: 0
    },
    {
      id: 'd2',
      symbol: 'NVDA',
      name: 'NVIDIA Corporation',
      type: 'STOCK',
      action: 'BUY',
      entryPrice: 120,
      quantity: 20,
      capitalAllocated: 2400,
      stopLoss: 110,
      takeProfit: 160,
      entryDate: new Date().toISOString(),
      status: 'OPEN',
      currentPrice: 140,
      unrealizedPnl: 400,
      unrealizedPnlPercent: 16.67,
      portfolio: 'Satellite',
      realizedPnl: 0,
      realizedPnlPercent: 0
    }
  ],
  signals: [],
  performanceHistory: [
    { date: '2026-07-23T00:00:00Z', totalValue: 10000, pnlPercent: 0 },
    { date: '2026-07-24T00:00:00Z', totalValue: 10500, pnlPercent: 5.0 },
    { date: '2026-07-25T00:00:00Z', totalValue: 11000, pnlPercent: 10.0 },
    { date: '2026-07-26T00:00:00Z', totalValue: 11266, pnlPercent: 12.66 }
  ],
  alerts: [
    {
      id: 'a1',
      title: '🎯 Demo Mode Attiva',
      message: 'Impossibile connettersi al database. Visualizzazione dati di test/demo.',
      date: new Date().toISOString(),
      type: 'WARNING',
      read: false
    }
  ],
  customPortfolios: ['Core', 'Satellite'],
  aiMode: 'DYNAMIC',
  coreSatelliteTarget: 70,
  targets: {
    'Core': 8,
    'Satellite': 25,
    'Tutti': 10
  },
  bucketProjections: {}
};

const MOCK_TBD_DATA = {
  today: {
    date: new Date().toISOString().split('T')[0],
    startingCash: 5000,
    endingCash: 5000,
    realizedPnL: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    status: 'ACTIVE',
    signals: [],
    targetReached: false
  },
  history: [],
  activeSignals: [],
  circuitBreaker: {
    stopTrading: false,
    reason: 'NONE' as const,
    message: ''
  },
  config: {
    totalCapital: 5000,
    dailyTarget: 50,
    maxTotalRiskPercent: 1.5,
    activeSlots: 3,
    preTriggerBufferPercent: 0.5
  }
};

export default function Home() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [portfolio, setPortfolio] = useState<PortfolioState | null>(null);
  const portfolioRef = useRef<PortfolioState | null>(null);
  const lastSignalIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    portfolioRef.current = portfolio;
  }, [portfolio]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [tab]);

  const [market, setMarket] = useState<MarketData[]>([]);
  const [tbdData, setTbdData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);


  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [pRes, mRes, tbdRes] = await Promise.allSettled([
        fetch('/api/portfolio'),
        fetch('/api/market'),
        fetch('/api/tbd/log'),
      ]);
      
      let pLoaded = false;
      if (pRes.status === 'fulfilled') {
        const pData = await pRes.value.json().catch(() => ({}));
        if (pData.success && pData.data) {
          setPortfolio(pData.data);
          pLoaded = true;
          setIsDemoMode(false);
        }
      }
      
      if (!pLoaded) {
        console.warn('[Page] Errore caricamento portfolio, attivo fallback demo');
        setPortfolio(MOCK_PORTFOLIO);
        setIsDemoMode(true);
      }

      if (mRes.status === 'fulfilled') {
        const mData = await mRes.value.json().catch(() => ({}));
        if (mData.success) setMarket(mData.data);
      }
      
      let tbdLoaded = false;
      if (tbdRes.status === 'fulfilled') {
        const tData = await tbdRes.value.json().catch(() => ({}));
        if (tData.success && tData.data) {
          setTbdData(tData.data);
          tbdLoaded = true;
        }
      }
      
      if (!tbdLoaded) {
        setTbdData(MOCK_TBD_DATA);
      }
      
      setLastUpdate(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (e) {
      console.error(e);
      setPortfolio(MOCK_PORTFOLIO);
      setTbdData(MOCK_TBD_DATA);
      setIsDemoMode(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const tickPrices = useCallback(async () => {
    const currentPortfolio = portfolioRef.current;
    if (!currentPortfolio || !currentPortfolio.positions || currentPortfolio.positions.length === 0) return;
    const openPos = currentPortfolio.positions.filter(p => p.status === 'OPEN' && !p.id?.startsWith('etoro_mirror_'));
    if (openPos.length === 0) return;
    const uniqueSymbols = Array.from(new Set(openPos.map(p => p.symbol)));
    try {
      const res = await fetch(`/api/prices?symbols=${uniqueSymbols.join(',')}`);
      const json = await res.json();
      if (json.success && json.prices) {
        setPortfolio(prev => {
          if (!prev) return null;
          const updatedPositions = prev.positions.map(pos => {
            if (pos.status === 'OPEN' && !pos.id?.startsWith('etoro_mirror_')) {
              const livePrice = json.prices[pos.symbol];
              if (livePrice !== undefined) {
                const unrealized = pos.action === 'BUY'
                  ? (livePrice - pos.entryPrice) * pos.quantity
                  : (pos.entryPrice - livePrice) * pos.quantity;
                const unrealizedPct = pos.capitalAllocated > 0 ? (unrealized / pos.capitalAllocated) * 100 : 0;
                return {
                  ...pos,
                  currentPrice: livePrice,
                  unrealizedPnl: unrealized,
                  unrealizedPnlPercent: unrealizedPct
                };
              }
            }
            return pos;
          });

          // Recalculate totals dynamically relative to live eToro anchor
          const openPositions = updatedPositions.filter(pos => {
            if (pos.status !== 'OPEN') return false;
            if (prev.excludeCopyTrading && pos.id?.startsWith('etoro_mirror_')) return false;
            return true;
          });

          const openValue = openPositions.reduce((sum, pos) => {
            const currentVal = (pos.capitalAllocated || 0) + (pos.unrealizedPnl || 0);
            return sum + currentVal;
          }, 0);

          const totalUnrealizedPnL = openPositions.reduce((sum, pos) => sum + (pos.unrealizedPnl || 0), 0);
          const totalRealizedPnL = updatedPositions
            .filter(pos => pos.status === 'CLOSED')
            .reduce((sum, pos) => sum + (pos.realizedPnl || 0), 0);

          const capitalBase = openPositions.reduce((sum, pos) => sum + (pos.capitalAllocated || 0), 0);

          const prevUnrealizedPnL = prev.positions
            .filter(pos => pos.status === 'OPEN' && !(prev.excludeCopyTrading && pos.id?.startsWith('etoro_mirror_')))
            .reduce((sum, pos) => sum + (pos.unrealizedPnl || 0), 0);

          const pnlDelta = totalUnrealizedPnL - prevUnrealizedPnL;
          const totalValue = (prev.totalValue && prev.totalValue > 0)
            ? Math.max(0, prev.totalValue + pnlDelta)
            : ((prev.capitalAvailable || 0) + openValue);
          const totalPnL = totalUnrealizedPnL + totalRealizedPnL;
          
          const baseForPnL = (prev.depositedFunds && prev.depositedFunds > 0)
            ? prev.depositedFunds
            : (capitalBase > 0 ? capitalBase : 1);

          const totalPnLPercent = (totalPnL / baseForPnL) * 100;

          return {
            ...prev,
            positions: updatedPositions,
            capitalBase,
            totalValue,
            totalPnL,
            totalPnLPercent
          };
        });
        setLastUpdate(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (e) {
      console.error('Error ticking prices:', e);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const interval = setInterval(tickPrices, 3000); // Ticker locale ogni 3 secondi (senza chiamate DB!)
    return () => clearInterval(interval);
  }, []);



  const tickMarket = useCallback(async () => {
    try {
      const res = await fetch('/api/market');
      const json = await res.json();
      if (json.success && json.data) {
        setMarket(json.data);
      }
    } catch (e) {
      console.error('Error ticking market:', e);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(tickMarket, 6000); // Ticker mercato ogni 6 secondi (cache a 5s per Yahoo, 15s per Crypto)
    return () => clearInterval(interval);
  }, [tickMarket]);

  const tickTbd = useCallback(async () => {
    try {
      const res = await fetch('/api/tbd/log');
      const json = await res.json();
      if (json.success && json.data) {
        setTbdData(json.data);
      }
    } catch (e) {
      console.error('Error ticking TBD:', e);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(tickTbd, 12000); // Polling automatico TBD ogni 12 secondi
    return () => clearInterval(interval);
  }, [tickTbd]);

  useEffect(() => {
    if (tbdData && tbdData.activeSignals) {
      const activeSignals = tbdData.activeSignals.filter((s: any) =>
        ['PRE_ALERT', 'ACTIVE', 'TRIGGERED'].includes(s.status)
      );

      // Trova i segnali NUOVI confrontando gli ID
      const newSignals = activeSignals.filter((signal: any) => {
        const id = signal.id || `${signal.asset || signal.symbol}-${signal.timestamp || signal.entryPrice}-${signal.direction || signal.action}`;
        return !lastSignalIds.current.has(id);
      });

      // Notifica solo i nuovi
      newSignals.forEach((sig: any) => {
        const id = sig.id || `${sig.asset || sig.symbol}-${sig.timestamp || sig.entryPrice}-${sig.direction || sig.action}`;
        lastSignalIds.current.add(id);

        try {
          if (typeof window !== 'undefined' && 'serviceWorker' in navigator && Notification.permission === 'granted') {
            navigator.serviceWorker.ready.then(reg => {
              reg.showNotification(`🎯 TBD SEGNALE: ${sig.asset || sig.symbol} ${sig.direction || sig.action}`, {
                body: `Entry: ${sig.entryPrice} | SL: ${sig.stopLoss} | TP: ${sig.takeProfit}\nDimensione: ${sig.allocatedSize}€`,
                icon: '/apple-touch-icon.png'
              });
            }).catch(() => {});
          }
        } catch (e) {
          console.warn('Desktop notification skipped:', e);
        }

        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const audioCtx = new AudioContextClass();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.6);
          }
        } catch (e) {
          console.warn('Audio alert error:', e);
        }
      });

      // Pulizia: rimuovi ID di segnali non più attivi per evitare memory leak
      const currentIds = new Set(
        activeSignals.map((s: any) => s.id || `${s.asset || s.symbol}-${s.timestamp || s.entryPrice}-${s.direction || s.action}`)
      );
      lastSignalIds.current.forEach(id => {
        if (!currentIds.has(id)) {
          lastSignalIds.current.delete(id);
        }
      });
    }
  }, [tbdData]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/cron/scan', { method: 'POST' });
      const data = await res.json();
      showToast(data.message || 'Scansione completata', data.success);
      await refresh();
    } catch {
      showToast('Errore scansione', false);
    } finally {
      setScanning(false);
    }
  };

  const handleTbdScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/tbd/scan', { method: 'POST' });
      const data = await res.json();
      showToast(data.message || `TBD Scan completato`, data.success);
      await refresh();
    } catch {
      showToast('Errore TBD scan', false);
    } finally {
      setScanning(false);
    }
  };

  const handleSatelliteScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/satellite-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      showToast(data.message || `Satellite Scan completato`, data.success);
      await refresh();
    } catch {
      showToast('Errore Satellite scan', false);
    } finally {
      setScanning(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/portfolio', { method: 'POST' });
      const data = await res.json();
      showToast(data.success ? 'Sincronizzazione eToro completata' : 'Errore sincronizzazione: ' + data.error, data.success);
      await refresh();
    } catch {
      showToast('Errore durante la sincronizzazione', false);
    } finally {
      setSyncing(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('⚠️ ATTENZIONE: Questo cancellerà tutti i dati del portafoglio e li risincronizzerà da eToro. Continuare?')) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/portfolio', { 
        method: 'DELETE',
        headers: { 'x-confirm-reset': 'yes-i-am-sure' }
      });
      const data = await res.json();
      showToast(data.success ? '✅ Reset completato. Dati risincronizzati da eToro.' : 'Errore reset: ' + data.error, data.success);
      await refresh();
    } catch {
      showToast('Errore durante il reset', false);
    } finally {
      setSyncing(false);
    }
  };

  const handleConfirm = async (signalId: string, executedPrice: number) => {
    const res = await fetch('/api/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId, executedPrice, action: 'confirm' }),
    });
    const data = await res.json();
    showToast(data.message, data.success);
    if (data.success) await refresh();
    return data.success;
  };

  const handleReject = async (signalId: string) => {
    const res = await fetch('/api/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId, action: 'reject' }),
    });
    const data = await res.json();
    showToast(data.message, data.success);
    if (data.success) await refresh();
  };

  const handleClose = async (positionId: string, closePrice: number) => {
    const res = await fetch('/api/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId: positionId, executedPrice: closePrice, action: 'close' }),
    });
    const data = await res.json();
    showToast(data.message, data.success);
    if (data.success) await refresh();
    return data.success;
  };

  const handleDeletePosition = async (positionId: string) => {
    const res = await fetch('/api/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId: positionId, action: 'delete' }),
    });
    const data = await res.json();
    showToast(data.message, data.success);
    if (data.success) await refresh();
    return data.success;
  };

  const handleUpdateTags = async (positionId: string, tags: string[]) => {
    // ⚡ Aggiornamento Ottimistico
    setPortfolio(prev => prev ? {
      ...prev,
      positions: prev.positions.map(p => p.id === positionId ? { ...p, tags } : p)
    } : prev);

    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positionId, tags }),
    });
    const data = await res.json();
    showToast(data.message, data.success);
    if (data.success) await refresh();
    return data.success;
  };

  const handleUpdateAIFilters = async (aiManagedTags: string[]) => {
    // ⚡ Aggiornamento Ottimistico
    setPortfolio(prev => prev ? { ...prev, aiManagedTags } : prev);

    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'portfolio_tags', aiManagedTags }),
    });
    const data = await res.json();
    showToast(data.message, data.success);
    if (data.success) await refresh();
    return data.success;
  };

  const handleUpdatePortfolios = async (customPortfolios: string[]) => {
    // ⚡ Aggiornamento Ottimistico
    setPortfolio(prev => prev ? { ...prev, customPortfolios } : prev);

    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'update_portfolios', customPortfolios }),
    });
    const data = await res.json();
    showToast(data.message, data.success);
    if (data.success) await refresh();
    return data.success;
  };

  const handleCreatePortfolio = async (portfolioName: string) => {
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'create_portfolio', portfolioName }),
    });
    const data = await res.json();
    showToast(data.message, data.success);
    if (data.success) await refresh();
    return data.success;
  };

  const handleAssignPortfolio = async (positionId: string, portfolioName: string) => {
    // ⚡ Aggiornamento Ottimistico per fixare il salto della select e la latenza
    setPortfolio(prev => prev ? {
      ...prev,
      positions: prev.positions.map(p => p.id === positionId ? { ...p, portfolio: portfolioName } : p)
    } : prev);

    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'assign_portfolio', positionId, portfolioName }),
    });
    const data = await res.json();
    showToast(data.message, data.success);
    if (data.success) await refresh();
    return data.success;
  };

  const handleUpdateCapitalBase = async (capitalBase: number) => {
    const res = await fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'update_capital_base', capitalBase }),
    });
    const data = await res.json();
    showToast(data.message, data.success);
    if (data.success) await refresh();
    return data.success;
  };

  const handleUpdateDepositedFunds = async (depositedFunds: number) => {
    const res = await fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'update_deposited_funds', depositedFunds }),
    });
    const data = await res.json();
    showToast(data.message, data.success);
    if (data.success) await refresh();
    return data.success;
  };

  const handleUpdateExcludeCopyTrading = async (excludeCopyTrading: boolean) => {
    const res = await fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'update_exclude_copy_trading', excludeCopyTrading }),
    });
    const data = await res.json();
    showToast(data.message, data.success);
    if (data.success) await refresh();
    return data.success;
  };

  const handleUpdateAiMode = async (aiMode: 'STRICT' | 'DYNAMIC') => {
    const res = await fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'update_ai_mode', aiMode }),
    });
    const data = await res.json();
    showToast(data.message, data.success);
    if (data.success) await refresh();
    return data.success;
  };

  if (loading && !portfolio) return <LoadingScreen />;

  if (error && !portfolio) {
    return (
      <div style={{ minHeight: '100vh', background: '#090d16', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', color: '#ffffff', textAlign: 'center', padding: '24px', fontFamily: 'var(--font-mono)' }}>
        <div style={{ fontSize: '48px' }}>⚠️</div>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#ef4444' }}>Errore Caricamento App</h2>
        <p style={{ color: 'var(--text3)', fontSize: '14px', maxWidth: '400px' }}>{error}</p>
        <button
          onClick={refresh}
          style={{
            background: 'linear-gradient(135deg, #00d4aa, #3b82f6)',
            color: '#090d16',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '10px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          🔄 Riprova
        </button>
      </div>
    );
  }

  return (
    <AppProviders>
      {isDemoMode && (
        <div className="demo-banner">
          <span>⚠️ Modalità Demo — I dati visualizzati sono simulati. Connetti il database per dati reali.</span>
          <button onClick={() => window.location.reload()}>🔄 Riprova</button>
        </div>
      )}
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <Header
          portfolio={portfolio}
          lastUpdate={lastUpdate}
          onScan={handleScan}
          scanning={scanning}
          onRefresh={handleSync}
          onReset={handleReset}
          syncing={syncing}
          onToggleChat={() => setIsChatOpen(!isChatOpen)}
        />
        <TabBar tab={tab} setTab={setTab} portfolio={portfolio} tbdData={tbdData} />

        <main style={{ flex: 1, padding: '20px', overflowY: 'auto', paddingBottom: '32px' }}>
          {tab === 'dashboard' && (
            <DashboardTab 
              portfolio={portfolio} 
              market={market} 
              setTab={setTab} 
              tbdData={tbdData}
              onUpdatePortfolios={handleUpdatePortfolios}
              onCreatePortfolio={handleCreatePortfolio}
              onAssignPortfolio={handleAssignPortfolio}
              onUpdateCapitalBase={handleUpdateCapitalBase}
              onUpdateDepositedFunds={handleUpdateDepositedFunds}
              onToggleCopyTrading={handleUpdateExcludeCopyTrading}
            />
          )}
          {tab === 'signals' && (
            <SignalsTab
              portfolio={portfolio}
              onConfirm={handleConfirm}
              onReject={handleReject}
              onScan={handleScan}
              scanning={scanning}
              onUpdateAiMode={handleUpdateAiMode}
              onSatelliteScan={handleSatelliteScan}
            />
          )}
          {tab === 'positions' && (
            <PositionsTab 
              portfolio={portfolio} 
              onClose={handleClose} 
              onDelete={handleDeletePosition}
              onUpdateTags={handleUpdateTags}
              onUpdateAIFilters={handleUpdateAIFilters}
              onUpdatePortfolios={handleUpdatePortfolios}
              onAssignPortfolio={handleAssignPortfolio}
            />
          )}

          {tab === 'market' && <MarketTab market={market} />}
          {tab === 'quontest' && <QuontestTab portfolio={portfolio} />}
          {tab === 'trading' && <TradingByDayTab tbdData={tbdData} onRefresh={refresh} portfolio={portfolio} onTbdScan={handleTbdScan} scanning={scanning} />}
          {tab === 'pac' && <PacSimulatorTab portfolio={portfolio} />}
        </main>

        <ChatWidget 
          isOpen={isChatOpen} 
          onClose={() => setIsChatOpen(false)} 
          portfolio={portfolio} 
          market={market} 
        />

        {toast && (
          <div className="animate-fade" style={{
            position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
            background: toast.ok ? '#00d4aa22' : '#ef444422',
            border: `1px solid ${toast.ok ? '#00d4aa' : '#ef4444'}`,
            color: toast.ok ? '#00d4aa' : '#ef4444',
            borderRadius: '12px', padding: '12px 24px',
            fontSize: '13px', fontFamily: 'var(--font-mono)',
            maxWidth: '90vw', textAlign: 'center', zIndex: 9999,
          }}>
            {toast.ok ? '✓' : '✗'} {toast.msg}
          </div>
        )}
      </div>
    </AppProviders>
  );
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <div style={{ fontSize: '28px', fontWeight: '800', fontFamily: 'var(--font-mono)', background: 'linear-gradient(135deg, #00d4aa, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>RV CAPITAL ALPHA</div>
      <div className="animate-pulse" style={{ fontSize: '12px', color: 'var(--text3)', letterSpacing: '0.2em' }}>CARICAMENTO PORTAFOGLIO...</div>
    </div>
  );
}
