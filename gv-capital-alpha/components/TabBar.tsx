'use client';
import { Tab } from '@/app/page';
import { PortfolioState } from '@/types';
import { useState, useEffect } from 'react';
import { Compass, Target, Zap, Briefcase, LineChart, FlaskConical, TrendingUp } from 'lucide-react';

interface Props { tab: Tab; setTab: (t: Tab) => void; portfolio: PortfolioState | null; tbdData?: any; }

export default function TabBar({ tab, setTab, portfolio, tbdData }: Props) {
  const [tbdCount, setTbdCount] = useState(0);

  useEffect(() => {
    if (tbdData && tbdData.activeSignals) {
      const active = tbdData.activeSignals.filter((s: any) => 
        ['PRE_ALERT', 'ACTIVE', 'TRIGGERED'].includes(s.status)
      ).length;
      setTbdCount(active);
    }
  }, [tbdData]);

  const pendingCount = portfolio?.signals.filter(s => s.status === 'PENDING').length ?? 0;
  const openCount = portfolio?.positions.filter(p => p.status === 'OPEN').length ?? 0;

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <Compass size={16} /> },
    { id: 'signals', label: 'Segnali', icon: <Target size={16} />, badge: pendingCount },
    { id: 'trading', label: 'Trading', icon: <Zap size={16} />, badge: tbdCount },
    { id: 'positions', label: 'Posizioni', icon: <Briefcase size={16} />, badge: openCount },
    { id: 'market', label: 'Mercato', icon: <LineChart size={16} /> },
    { id: 'quontest', label: 'Quontest', icon: <FlaskConical size={16} /> },
    { id: 'pac', label: 'PAC', icon: <TrendingUp size={16} /> },
  ];

  return (
    <nav style={{
      background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
      display: 'flex', overflowX: 'auto', gap: '8px', padding: '0 16px'
    }}>
      <style>{`
        @keyframes pulse-trading-badge {
          0% { opacity: 0.7; box-shadow: 0 0 4px #ef4444; }
          50% { opacity: 1; box-shadow: 0 0 14px #ef4444; }
          100% { opacity: 0.7; box-shadow: 0 0 4px #ef4444; }
        }
      `}</style>
      {tabs.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} style={{
          flex: 1, padding: '16px 16px', background: 'none', border: 'none',
          borderBottom: tab === t.id ? '3px solid #84cc16' : '3px solid transparent',
          color: tab === t.id ? '#84cc16' : 'var(--text3)',
          fontSize: '12px', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
          fontWeight: tab === t.id ? '700' : '400', transition: 'all 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          position: 'relative', whiteSpace: 'nowrap', cursor: 'pointer',
        }}>
          <span style={{ display: 'flex', alignItems: 'center' }}>{t.icon}</span>
          <span>{t.label}</span>
          {t.badge ? (
            <span style={{
              background: t.id === 'trading' ? '#ef4444' : 'var(--yellow)',
              color: t.id === 'trading' ? '#ffffff' : '#070b14',
              borderRadius: '10px',
              fontSize: '9px', fontWeight: '800', padding: '1px 5px', lineHeight: 1.4,
              boxShadow: t.id === 'trading' ? '0 0 8px #ef4444' : 'none',
              animation: t.id === 'trading' ? 'pulse-trading-badge 1.5s infinite ease-in-out' : 'none',
            }}>{t.badge}</span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}
