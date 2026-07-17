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
import ChatWidget from '@/components/ChatWidget';

export type Tab = 'dashboard' | 'signals' | 'positions' | 'market' | 'quontest' | 'trading';

export default function Home() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [portfolio, setPortfolio] = useState<PortfolioState | null>(null);
  const portfolioRef = useRef<PortfolioState | null>(null);

  useEffect(() => {
    portfolioRef.current = portfolio;
  }, [portfolio]);

  const [market, setMarket] = useState<MarketData[]>([]);
  const [tbdData, setTbdData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
      const [pRes, mRes, tbdRes] = await Promise.allSettled([
        fetch('/api/portfolio'),
        fetch('/api/market'),
        fetch('/api/tbd/log'),
      ]);
      if (pRes.status === 'fulfilled') {
        const pData = await pRes.value.json().catch(() => ({}));
        if (pData.success) setPortfolio(pData.data);
      }
      if (mRes.status === 'fulfilled') {
        const mData = await mRes.value.json().catch(() => ({}));
        if (mData.success) setMarket(mData.data);
      }
      if (tbdRes.status === 'fulfilled') {
        const tData = await tbdRes.value.json().catch(() => ({}));
        if (tData.success) setTbdData(tData.data);
      }
      setLastUpdate(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const tickPrices = useCallback(async () => {
    const currentPortfolio = portfolioRef.current;
    if (!currentPortfolio || !currentPortfolio.positions || currentPortfolio.positions.length === 0) return;
    const openPos = currentPortfolio.positions.filter(p => p.status === 'OPEN' && !p.id.startsWith('etoro_mirror_'));
    if (openPos.length === 0) return;
    const uniqueSymbols = Array.from(new Set(openPos.map(p => p.symbol)));
    try {
      const res = await fetch(`/api/prices?symbols=${uniqueSymbols.join(',')}`);
      const json = await res.json();
      if (json.success && json.prices) {
        setPortfolio(prev => {
          if (!prev) return null;
          const updatedPositions = prev.positions.map(pos => {
            if (pos.status === 'OPEN' && !pos.id.startsWith('etoro_mirror_')) {
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
          return {
            ...prev,
            positions: updatedPositions
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
  }, [refresh]);

  useEffect(() => {
    const interval = setInterval(tickPrices, 3000); // Ticker locale ogni 3 secondi (senza chiamate DB!)
    return () => clearInterval(interval);
  }, [tickPrices]);

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
      const res = await fetch('/api/portfolio', { method: 'DELETE' });
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

  const handleAssignPortfolio = async (positionId: string, portfolioName: string) => {
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

  if (loading) return <LoadingScreen />;

  return (
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
        {tab === 'trading' && <TradingByDayTab tbdData={tbdData} onRefresh={refresh} portfolio={portfolio} />}
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
