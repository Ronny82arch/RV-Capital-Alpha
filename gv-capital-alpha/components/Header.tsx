'use client';
import { PortfolioState, Alert } from '@/types';
import { useState } from 'react';

interface Props {
  portfolio: PortfolioState | null;
  lastUpdate: string;
  onScan: () => void;
  scanning: boolean;
  onRefresh: () => void;
}

export default function Header({ portfolio, lastUpdate, onScan, scanning, onRefresh }: Props) {
  const pnl = portfolio?.totalPnLPercent ?? 0;
  const isUp = pnl >= 0;
  const [showMenu, setShowMenu] = useState(false);
  const unreadAlerts = portfolio?.alerts?.filter(a => !a.read) ?? [];

  return (
    <header style={{
      background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
      padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '9px', flexShrink: 0,
          background: 'linear-gradient(135deg, #00d4aa 0%, #3b82f6 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontWeight: '800', fontSize: '13px', color: '#070b14',
        }}>RV</div>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '13px', letterSpacing: '0.1em' }}>
            CAPITAL ALPHA
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.15em' }}>
            AUTONOMOUS ENGINE · {portfolio?.capitalBase?.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) ?? '€30.000'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {portfolio && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: '700', color: isUp ? 'var(--green)' : 'var(--red)' }}>
              {isUp ? '+' : ''}{pnl.toFixed(2)}%
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text3)' }}>P&L YTD</div>
          </div>
        )}

        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowMenu(!showMenu)} style={{
            background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px',
            color: 'var(--text2)', padding: '7px 10px', fontSize: '14px', position: 'relative'
          }}>
            🔔
            {unreadAlerts.length > 0 && (
              <span style={{ position: 'absolute', top: -5, right: -5, background: 'var(--red)', color: '#fff', fontSize: '10px', padding: '2px 5px', borderRadius: '10px', fontWeight: 'bold' }}>
                {unreadAlerts.length}
              </span>
            )}
          </button>
          
          {showMenu && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: '8px', width: '320px',
              background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)', overflow: 'hidden', zIndex: 1000,
              maxHeight: '400px', overflowY: 'auto'
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Notifiche</span>
              </div>
              {portfolio?.alerts?.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>Nessuna notifica</div>
              ) : (
                portfolio?.alerts?.map(alert => (
                  <div key={alert.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: alert.read ? 'transparent' : 'rgba(59, 130, 246, 0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px' }}>{alert.type === 'SUCCESS' ? '🟢' : alert.type === 'WARNING' ? '⚠️' : '🔴'}</span>
                      <strong style={{ fontSize: '13px', color: 'var(--text1)' }}>{alert.title}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text2)', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{alert.message}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '8px' }}>{new Date(alert.date).toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <button onClick={onRefresh} style={{
          background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px',
          color: 'var(--text2)', padding: '7px 10px', fontSize: '14px',
        }}>↻</button>

        <button onClick={onScan} disabled={scanning} style={{
          background: scanning ? 'var(--bg3)' : 'linear-gradient(135deg, #00d4aa 0%, #3b82f6 100%)',
          border: 'none', borderRadius: '8px', color: scanning ? 'var(--text3)' : '#070b14',
          fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '11px',
          letterSpacing: '0.1em', padding: '8px 14px', transition: 'all 0.2s',
        }}>
          {scanning ? '◉ SCAN...' : '▶ SCAN'}
        </button>
      </div>
    </header>
  );
}
