'use client';
import { Tab } from '@/app/page';
import { PortfolioState } from '@/types';
import { useState, useEffect } from 'react';

interface Props { tab: Tab; setTab: (t: Tab) => void; portfolio: PortfolioState | null; }

export default function TabBar({ tab, setTab, portfolio }: Props) {
  const [tbdCount, setTbdCount] = useState(0);

  useEffect(() => {
    async function fetchTbd() {
      try {
        const res = await fetch('/api/tbd/log');
        const json = await res.json();
        if (json.success && json.data.activeSignals) {
          const active = json.data.activeSignals.filter((s: any) => 
            ['PRE_ALERT', 'ACTIVE', 'TRIGGERED'].includes(s.status)
          ).length;
          setTbdCount(active);
        }
      } catch (e) {}
    }
    fetchTbd();
    const interval = setInterval(fetchTbd, 30000);
    return () => clearInterval(interval);
  }, []);

  const pendingCount = portfolio?.signals.filter(s => s.status === 'PENDING').length ?? 0;
  const openCount = portfolio?.positions.filter(p => p.status === 'OPEN').length ?? 0;

  const tabs: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '🧭' },
    { id: 'signals', label: 'Segnali', icon: '🎯', badge: pendingCount },
    { id: 'trading', label: 'Trading', icon: '⚡', badge: tbdCount },
    { id: 'positions', label: 'Posizioni', icon: '💼', badge: openCount },
    { id: 'market', label: 'Mercato', icon: '📈' },
    { id: 'quontest', label: 'Quontest', icon: '🔬' },
  ];

  return (
    <nav style={{
      background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
      display: 'flex', overflowX: 'auto',
    }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} style={{
          flex: 1, padding: '13px 8px', background: 'none', border: 'none',
          borderBottom: tab === t.id ? '2px solid var(--green)' : '2px solid transparent',
          color: tab === t.id ? 'var(--green)' : 'var(--text3)',
          fontSize: '11px', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
          fontWeight: tab === t.id ? '700' : '400', transition: 'all 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          position: 'relative', whiteSpace: 'nowrap',
        }}>
          <span>{t.icon}</span>
          <span>{t.label}</span>
          {t.badge ? (
            <span style={{
              background: 'var(--yellow)', color: '#070b14', borderRadius: '10px',
              fontSize: '9px', fontWeight: '800', padding: '1px 5px', lineHeight: 1.4,
            }}>{t.badge}</span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}
