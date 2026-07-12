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
      background: '#000000',
      padding: '16px 12px 12px 12px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      {/* ── LOGO CENTRATO (CAPITAL α ALPHA) ─────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', paddingBottom: '16px' }}>
        <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#475569', letterSpacing: '0.08em', fontFamily: 'var(--font-sans, system-ui)' }}>CAPITAL</span>
        {/* SVG Alpha symbol */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 0 8px rgba(132,204,22,0.4))' }}>
          <path d="M21 5C18 7 15.5 10 12 11.5C8.5 13 4 11 4 7.5C4 4 8.5 2 12 4C15.5 6 18 9 21 11" stroke="#84cc16" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffffff', letterSpacing: '0.08em', fontFamily: 'var(--font-sans, system-ui)' }}>ALPHA</span>
      </div>

      {/* ── BARRA DI AZIONE INFERIORE (CARD DARK GREY) ───────────────────────── */}
      <div style={{
        background: '#1c1c1e', // Sfondo grigio scuro del pannello
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Left: RV Circle */}
        <div style={{
          width: '36px', height: '36px',
          borderRadius: '50%',
          background: '#84cc16', // Cerchio verde
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: '700', fontSize: '13px', color: '#090d16'
        }}>
          RV
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Cerca */}
          <button style={{
            background: '#2c2c2e', // Bottone scuro
            border: 'none',
            borderRadius: '10px',
            color: '#94a3b8',
            width: '36px', height: '36px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', cursor: 'pointer'
          }} title="Cerca">
            🔍
          </button>

          {/* Notifiche / Laptop icon */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(!showMenu)} style={{
              background: '#2c2c2e',
              border: 'none',
              borderRadius: '10px',
              color: '#94a3b8',
              width: '36px', height: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', position: 'relative'
            }} title="Notifiche">
              {/* Laptop icon SVG */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="2" y1="20" x2="22" y2="20" />
                <line x1="12" y1="17" x2="12" y2="20" />
              </svg>
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

          {/* Scan Button (Teal/Cyan Gradient) */}
          <button
            onClick={onScan}
            disabled={scanning}
            style={{
              background: scanning ? '#2c2c2e' : 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
              border: 'none',
              borderRadius: '10px',
              color: '#070b14',
              width: '70px', height: '36px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: scanning ? 'not-allowed' : 'pointer',
              fontWeight: '800',
              boxShadow: scanning ? 'none' : '0 3px 8px rgba(79,172,254,0.2)',
              transition: 'all 0.2s'
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
