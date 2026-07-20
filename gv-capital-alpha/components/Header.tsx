'use client';
import React, { useState, useEffect } from 'react';
import { PortfolioState, Alert } from '@/types';

interface Props {
  portfolio: PortfolioState | null;
  lastUpdate: string;
  onScan: () => void;
  scanning: boolean;
  onRefresh: () => void;
  onReset?: () => void;
  syncing: boolean;
  onToggleChat: () => void;
}

export default function Header({ portfolio, lastUpdate, onScan, scanning, onRefresh, onReset, syncing, onToggleChat }: Props) {
  const pnl = portfolio?.totalPnLPercent ?? 0;
  const isUp = pnl >= 0;
  const [showMenu, setShowMenu] = useState(false);
  const [hideBadge, setHideBadge] = useState(false);

  useEffect(() => {
    setHideBadge(false);
  }, [portfolio]);

  const unreadAlerts = portfolio?.alerts?.filter(a => !a.read) ?? [];

  return (
    <header className="header-container">
      <style>{`
        .header-container {
          background: #000000;
          padding: 16px 12px 12px 12px;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .logo-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding-bottom: 16px;
        }
        .action-bar {
          background: #1c1c1e;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
        }
        .action-left {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .avatar-circle {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #84cc16;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 13px;
          color: #090d16;
        }
        .monitor-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          background: rgba(132, 204, 22, 0.08);
          border: 1px solid rgba(132, 204, 22, 0.2);
          padding: 4px 8px;
          border-radius: 20px;
          flex-shrink: 0;
        }
        .monitor-text {
          font-size: 9px;
          font-weight: bold;
          color: #84cc16;
          font-family: var(--font-mono);
          letter-spacing: 0.05em;
        }
        .action-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .action-btn {
          background: #2c2c2e;
          border: none;
          border-radius: 10px;
          color: #ffffff;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          cursor: pointer;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spin-animation {
          animation: spin 1s linear infinite;
        }
        .scan-btn {
          background: linear-gradient(135deg, #bef264 0%, #84cc16 100%);
          border: none;
          border-radius: 10px;
          color: #070b14;
          width: 70px;
          height: 36px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-weight: 800;
          box-shadow: 0 3px 8px rgba(132,204,22,0.3);
          transition: all 0.2s;
        }
        
        @keyframes pulse-computer-badge {
          0% { opacity: 0.7; box-shadow: 0 0 4px #ef4444; }
          50% { opacity: 1; box-shadow: 0 0 12px #ef4444; }
          100% { opacity: 0.7; box-shadow: 0 0 4px #ef4444; }
        }
        
        @keyframes pulse {
          0% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0.4; transform: scale(0.9); }
        }
        
        @media (max-width: 420px) {
          .header-container {
            padding: 12px 8px 8px 8px;
          }
          .logo-row {
            padding-bottom: 12px;
          }
          .action-bar {
            padding: 8px 10px;
            border-radius: 12px;
          }
          .action-left {
            gap: 6px;
          }
          .avatar-circle {
            width: 32px;
            height: 32px;
            font-size: 12px;
          }
          .monitor-badge {
            padding: 4px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .monitor-text {
            display: none;
          }
          .action-right {
            gap: 6px;
          }
          .action-btn {
            width: 32px;
            height: 32px;
            font-size: 14px;
          }
          .scan-btn {
            width: 62px;
            height: 32px;
          }
          .scan-btn-play {
            font-size: 7px !important;
          }
          .scan-btn-txt {
            font-size: 8px !important;
          }
        }
      `}</style>

      {/* ── LOGO CENTRATO (CAPITAL α ALPHA) ─────────────────────────────────── */}
      <div className="logo-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
        <span style={{ fontSize: '18px', fontWeight: '400', color: '#52525b', letterSpacing: '0.08em', fontFamily: 'var(--font-sans, system-ui)' }}>CAPITAL</span>
        {/* SVG Alpha symbol (modellato per corrispondere esattamente all'immagine) */}
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 0 8px rgba(132,204,22,0.45))', alignSelf: 'center', zIndex: 1 }}>
          <path d="M22 5C18.5 8.5, 15 11, 13.5 12 C9.5 16.5, 4 16.5, 4 12 C4 7.5, 9.5 7.5, 13.5 12 C15 13, 18.5 15.5, 22 19" stroke="#84cc16" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: '18px', fontWeight: '800', color: '#ffffff', letterSpacing: '0.08em', fontFamily: 'var(--font-sans, system-ui)', zIndex: 2 }}>ALPHA</span>
      </div>

      {/* ── BARRA DI AZIONE INFERIORE (CARD DARK GREY) ───────────────────────── */}
      <div className="action-bar">
        {/* Left: RV Circle + Monitoring active indicator */}
        <div className="action-left">
          <div className="avatar-circle">
            RV
          </div>
          
          {/* Indicatore monitoraggio attivo */}
          <div className="monitor-badge">
            <span style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#84cc16',
              boxShadow: '0 0 6px #84cc16',
              animation: 'pulse 1.8s infinite ease-in-out'
            }} />
            <span className="monitor-text">MONITORAGGIO</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="action-right">
          {/* Tasto Sincronizza eToro */}
          <button className="action-btn" onClick={onRefresh} title="Sincronizza eToro" disabled={syncing}>
            <span className={syncing ? 'spin-animation' : ''} style={{ display: 'inline-block' }}>🔄</span>
          </button>

          {/* Tasto Reset & Sync (emergenza) */}
          {onReset && (
            <button className="action-btn" onClick={onReset} title="Reset & Sincronizza da zero" disabled={syncing} style={{ background: '#7f1d1d' }}>
              🗑️
            </button>
          )}

          {/* Tasto Chat AI */}
          <button className="action-btn" onClick={onToggleChat} title="Chat AI">
            🤖
          </button>

          {/* Notifiche / Laptop icon */}
          <button className="action-btn" onClick={() => {
            const willShow = !showMenu;
            setShowMenu(willShow);
            if (willShow && unreadAlerts.length > 0) {
              fetch('/api/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'mark_alerts_read' })
              }).then(() => { if (onRefresh) onRefresh(); });
              // Local optimistic update
              if (portfolio && portfolio.alerts) {
                portfolio.alerts.forEach(a => a.read = true);
              }
              setHideBadge(true);
            }
          }} title="Notifiche" style={{ position: 'relative' }}>
            {/* Laptop icon SVG */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="2" y1="20" x2="22" y2="20" />
              <line x1="12" y1="17" x2="12" y2="20" />
            </svg>
            {!hideBadge && unreadAlerts.length > 0 && (
              <span style={{ 
                position: 'absolute', top: -3, right: -3, 
                background: 'var(--red)', color: '#fff', fontSize: '8px', 
                padding: '1px 4px', borderRadius: '10px', fontWeight: 'bold',
                boxShadow: '0 0 6px #ef4444',
                animation: 'pulse-computer-badge 1.5s infinite ease-in-out'
              }}>{unreadAlerts.length}</span>
            )}
          </button>

          {/* Scan Button (Lime Gradient) */}
          <button
            className="scan-btn"
            onClick={onScan}
            disabled={scanning}
            style={scanning ? { background: '#2c2c2e', color: '#94a3b8', boxShadow: 'none' } : undefined}
          >
            {scanning ? (
              <span className="scan-btn-txt" style={{ fontSize: '9px', fontWeight: 800 }}>SCAN...</span>
            ) : (
              <>
                <span className="scan-btn-play" style={{ fontSize: '8px', lineHeight: '1', marginBottom: '1px' }}>▶</span>
                <span className="scan-btn-txt" style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.05em' }}>SCAN</span>
              </>
            )}
          </button>
        </div>

        {/* Dropdown Notifiche (Posizionato assolutamente rispetto alla Barra di Azione per evitare di uscire dallo schermo) */}
        {showMenu && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: '14px',
            width: '280px',
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            overflow: 'hidden',
            zIndex: 1000,
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
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
            {/* Attivazione Web Push Notifiche */}
            <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)' }}>
              <button
                onClick={async () => {
                  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                    alert('Le notifiche push non sono supportate da questo browser.');
                    return;
                  }
                  try {
                    const permission = await Notification.requestPermission();
                    if (permission !== 'granted') {
                      alert('Permesso per le notifiche negato.');
                      return;
                    }
                    const reg = await navigator.serviceWorker.register('/sw.js');
                    let sub = await reg.pushManager.getSubscription();
                    if (!sub) {
                      const res = await fetch('/api/push/subscribe');
                      const data = await res.json();
                      
                      // Convert base64 VAPID key to Uint8Array
                      const urlBase64ToUint8Array = (base64String: string) => {
                        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
                        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
                        const rawData = window.atob(base64);
                        const outputArray = new Uint8Array(rawData.length);
                        for (let i = 0; i < rawData.length; ++i) {
                          outputArray[i] = rawData.charCodeAt(i);
                        }
                        return outputArray;
                      };

                      sub = await reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(data.publicKey)
                      });
                    }
                    await fetch('/api/push/subscribe', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ subscription: sub })
                    });
                    alert('🔔 Notifiche Push attivate con successo sul dispositivo!');
                  } catch (err: any) {
                    alert('Errore durante l\'attivazione: ' + err.message);
                  }
                }}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: '8px',
                  background: 'rgba(132, 204, 22, 0.12)', border: '1px solid rgba(132, 204, 22, 0.3)',
                  color: '#84cc16', fontSize: '11px', fontFamily: 'var(--font-mono)',
                  fontWeight: 'bold', cursor: 'pointer', textAlign: 'center', marginBottom: '6px'
                }}
              >
                🔔 Attiva Notifiche Push
              </button>
            </div>

            {/* Fix grafico - rimuove punti 30k errati dal database */}
            <div style={{ padding: '0 14px 10px 14px' }}>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch('/api/portfolio/fix-history', { method: 'POST' });
                    const data = await res.json();
                    alert(data.success ? `✅ ${data.message}` : `❌ Errore: ${data.error}`);
                    if (data.success) window.location.reload();
                  } catch (e) {
                    alert('Errore durante la pulizia');
                  }
                }}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: '8px',
                  background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)',
                  color: 'var(--blue)', fontSize: '11px', fontFamily: 'var(--font-mono)',
                  fontWeight: 'bold', cursor: 'pointer', textAlign: 'center',
                }}
              >
                🔧 Ripara Grafico Globale
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
