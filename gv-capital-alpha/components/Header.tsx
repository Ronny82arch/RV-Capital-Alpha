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
      background: '#090d16',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      padding: '12px 16px 14px 16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      {/* ── LOGO CENTRATO (CAPITAL α ALPHA) ─────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '4px 0 12px 0' }}>
        <span style={{ fontSize: '19px', fontWeight: '800', color: '#475569', letterSpacing: '0.05em', fontFamily: 'var(--font-sans, system-ui)' }}>CAPITAL</span>
        <span style={{ fontSize: '28px', fontWeight: '900', color: '#84cc16', lineHeight: 1, fontFamily: 'var(--font-sans, system-ui)', margin: '0 2px' }}>α</span>
        <span style={{ fontSize: '19px', fontWeight: '800', color: '#ffffff', letterSpacing: '0.05em', fontFamily: 'var(--font-sans, system-ui)' }}>ALPHA</span>
      </div>

      {/* ── BARRA DI AZIONE INFERIORE ───────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        {/* Left: RV Circle */}
        <div style={{
          width: '38px', height: '38px',
          borderRadius: '50%',
          background: '#84cc16',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: '800', fontSize: '13px', color: '#070b14'
        }}>
          RV
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Cerca */}
          <button style={{
            background: '#161b26',
            border: 'none',
            borderRadius: '12px',
            color: '#94a3b8',
            width: '38px', height: '38px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '15px', cursor: 'pointer'
          }} title="Cerca">
            🔍
          </button>

          {/* Notifiche */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(!showMenu)} style={{
              background: '#161b26',
              border: 'none',
              borderRadius: '12px',
              color: '#ffffff',
              width: '38px', height: '38px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '15px', cursor: 'pointer', position: 'relative'
            }} title="Notifiche">
              🔔
              {unreadAlerts.length > 0 && (
                <span style={{ position: 'absolute', top: -3, right: -3, background: 'var(--red)', color: '#fff', fontSize: '8px', padding: '1px 3px', borderRadius: '10px', fontWeight: 'bold' }}>{unreadAlerts.length}</span>
              )}
            </button>
            
            {showMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', width: '280px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', overflow: 'hidden', zIndex: 1000, maxHeight: '300px', overflowY: 'auto' }}>
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

          {/* Scan Button (Cyan Gradient) */}
          <button
            onClick={onScan}
            disabled={scanning}
            style={{
              background: scanning ? '#161b26' : 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
              border: 'none',
              borderRadius: '12px',
              color: '#070b14',
              width: '74px', height: '38px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: scanning ? 'not-allowed' : 'pointer',
              fontWeight: '800',
              transition: 'all 0.2s',
              boxShadow: scanning ? 'none' : '0 3px 8px rgba(79,172,254,0.2)'
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
