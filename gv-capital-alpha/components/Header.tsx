'use client';
import React, { useState } from 'react';
import { PortfolioState, Alert } from '@/types';

interface Props {
  portfolio: PortfolioState | null;
  lastUpdate: string;
  onScan: () => void;
  scanning: boolean;
  onRefresh: () => void;
  onToggleChat: () => void;
}

export default function Header({ portfolio, lastUpdate, onScan, scanning, onRefresh, onToggleChat }: Props) {
  const pnl = portfolio?.totalPnLPercent ?? 0;
  const isUp = pnl >= 0;
  const [showMenu, setShowMenu] = useState(false);
  const unreadAlerts = portfolio?.alerts?.filter(a => !a.read) ?? [];

  return (
    <header style={{
      background: 'var(--bg2)',
      borderBottom: '1px solid var(--border)',
      padding: '8px 20px 14px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      {/* ── LOGO CENTRATO (CAPITAL α ALPHA) ─────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px 0 10px 0' }}>
        <span style={{ fontSize: '18px', fontWeight: 600, color: '#64748b', letterSpacing: '0.08em', fontFamily: 'var(--font-sans, system-ui)' }}>CAPITAL</span>
        <span style={{ fontSize: '28px', fontWeight: 900, color: '#84cc16', lineHeight: 1, fontFamily: 'var(--font-sans, system-ui)', textShadow: '0 0 12px rgba(132,204,22,0.35)' }}>α</span>
        <span style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', letterSpacing: '0.08em', fontFamily: 'var(--font-sans, system-ui)' }}>ALPHA</span>
      </div>

      {/* ── BARRA DI AZIONE INFERIORE ───────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        {/* Left: RV Circle + P&L */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px',
            borderRadius: '50%',
            background: '#84cc16',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: '800', fontSize: '13px', color: '#070b14',
            boxShadow: '0 0 8px rgba(132,204,22,0.2)'
          }}>
            RV
          </div>
          {portfolio && (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '700', color: isUp ? 'var(--green)' : 'var(--red)', lineHeight: '1.2' }}>
                {isUp ? '+' : ''}{pnl.toFixed(2)}%
              </div>
              <div style={{ fontSize: '8px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>P&L YTD</div>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Cerca */}
          <button style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '10px',
            color: 'var(--text2)',
            width: '36px', height: '36px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s'
          }} title="Cerca">
            🔍
          </button>

          {/* Notifiche */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(!showMenu)} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '10px',
              color: 'var(--text2)',
              width: '36px', height: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', cursor: 'pointer', position: 'relative', transition: 'all 0.2s'
            }} title="Notifiche">
              🔔
              {unreadAlerts.length > 0 && (
                <span style={{ position: 'absolute', top: -3, right: -3, background: 'var(--red)', color: '#fff', fontSize: '8px', padding: '1px 3px', borderRadius: '10px', fontWeight: 'bold' }}>{unreadAlerts.length}</span>
              )}
            </button>
            
            {showMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', width: '300px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', overflow: 'hidden', zIndex: 1000, maxHeight: '350px', overflowY: 'auto' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '13px' }}>Notifiche</span>
                </div>
                {portfolio?.alerts?.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text3)', fontSize: '12px' }}>Nessuna notifica</div>
                ) : (
                  portfolio?.alerts?.map(alert => (
                    <div key={alert.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: alert.read ? 'transparent' : 'rgba(59, 130, 246, 0.08)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                        <span style={{ fontSize: '11px' }}>{alert.type === 'SUCCESS' ? '🟢' : alert.type === 'WARNING' ? '⚠️' : alert.type === 'ERROR' ? '🔴' : 'ℹ️'}</span>
                        <strong style={{ fontSize: '12px', color: 'var(--text1)' }}>{alert.title}</strong>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text2)', whiteSpace: 'pre-wrap', lineHeight: '1.3' }}>{alert.message}</div>
                      <div style={{ fontSize: '9px', color: 'var(--text3)', marginTop: '6px' }}>{new Date(alert.date).toLocaleString()}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Aggiorna */}
          <button onClick={onRefresh} style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '10px',
            color: 'var(--text2)',
            width: '36px', height: '36px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s'
          }} title="Aggiorna">
            ↻
          </button>

          {/* Chat AI */}
          <button onClick={onToggleChat} style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '10px',
            color: 'var(--text2)',
            width: '36px', height: '36px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s'
          }} title="Chat AI">
            🤖
          </button>

          {/* Scan Button */}
          <button
            onClick={onScan}
            disabled={scanning}
            style={{
              background: scanning ? 'var(--bg3)' : 'linear-gradient(135deg, #00d4aa 0%, #3b82f6 100%)',
              border: 'none',
              borderRadius: '10px',
              color: '#070b14',
              fontFamily: 'var(--font-mono)',
              fontWeight: '800',
              padding: '3px 12px',
              height: '36px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: scanning ? 'not-allowed' : 'pointer',
              boxShadow: scanning ? 'none' : '0 3px 8px rgba(0,212,170,0.2)',
              transition: 'all 0.2s',
              minWidth: '64px'
            }}
          >
            {scanning ? (
              <span style={{ fontSize: '9px', fontWeight: 800 }}>SCAN...</span>
            ) : (
              <>
                <span style={{ fontSize: '8px', lineHeight: '1', marginBottom: '1px' }}>▶</span>
                <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.05em' }}>SCAN</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
