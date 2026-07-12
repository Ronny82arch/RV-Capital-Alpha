'use client';

import { useState, useEffect, useCallback } from 'react';
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
  const [market, setMarket] = useState<MarketData[]>([]);
  const [tbdData, setTbdData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
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

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000); // auto-refresh ogni minuto
    return () => clearInterval(interval);
  }, [refresh]);

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

  if (loading) return <LoadingScreen />;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <Header
        portfolio={portfolio}
        lastUpdate={lastUpdate}
        onScan={handleScan}
        scanning={scanning}
        onRefresh={refresh}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
      />
      <TabBar tab={tab} setTab={setTab} portfolio={portfolio} tbdData={tbdData} />

      <main style={{ flex: 1, padding: '20px', overflowY: 'auto', paddingBottom: '32px' }}>
        {tab === 'dashboard' && <DashboardTab portfolio={portfolio} market={market} setTab={setTab} tbdData={tbdData} />}
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
            onUpdateTags={handleUpdateTags}
            onUpdateAIFilters={handleUpdateAIFilters}
          />
        )}
        {tab === 'market' && <MarketTab market={market} />}
        {tab === 'quontest' && <QuontestTab portfolio={portfolio} />}
        {tab === 'trading' && <TradingByDayTab tbdData={tbdData} onRefresh={refresh} />}
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
