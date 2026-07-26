import React, { useState } from 'react';
import { LeverageState } from '@/lib/antigravity-engine';

interface Props {
  leverageState: LeverageState | null;
  rebalanceAction?: any;
}

export default function AntigravityMonitor({ leverageState, rebalanceAction }: Props) {
  const [loading, setLoading] = useState(false);
  
  if (!leverageState) return null;

  const handleRebalance = async () => {
    setLoading(true);
    try {
      const actionPayload = rebalanceAction?.action && rebalanceAction.action !== 'HOLD' 
        ? rebalanceAction.action 
        : (leverageState.status === 'PROFIT_MODE' ? 'INCREASE_LEVERAGE' : 'DECREASE_LEVERAGE');
        
      const newLeveragePayload = rebalanceAction?.newLeverage || (leverageState.status === 'PROFIT_MODE' ? 2.5 : 1.0);

      const res = await fetch('/api/antigravity/rebalance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionPayload, newLeverage: newLeveragePayload })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.actionRequired);
        window.location.reload();
      } else {
        alert('Errore: ' + data.error);
      }
    } catch (e) {
      alert('Errore di connessione');
    }
    setLoading(false);
  };

  const leverage = leverageState.currentLeverage;
  const statusColor = leverageState.status === 'PROFIT_MODE'
    ? '#10b981'
    : leverageState.status === 'EMERGENCY_STOP'
      ? '#ef4444'
      : leverageState.status === 'CAUTION'
        ? '#f59e0b'
        : '#3b82f6';

  const needsRebalance = leverageState.status !== 'NORMAL' || (rebalanceAction && rebalanceAction.action !== 'HOLD');

  return (
    <div style={{
      background: 'var(--bg2)',
      border: `1px solid ${statusColor}40`,
      borderLeft: `3px solid ${statusColor}`,
      borderRadius: '12px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 'bold', letterSpacing: '0.1em' }}>
            ⚖️ ANTIGRAVITY LEVERAGE
          </div>
          <div style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            color: statusColor,
            fontFamily: 'var(--font-mono)',
            marginTop: '4px'
          }}>
            {leverage.toFixed(2)}x
          </div>
        </div>

        <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text3)' }}>
          <div>
            Capitale esposto: <b style={{ color: 'var(--text)' }}>€{leverageState.deployedCapital.toFixed(0)}</b>
          </div>
          <div style={{ marginTop: '4px' }}>
            Liquidità libera: <b style={{ color: 'var(--text)' }}>€{leverageState.availableCapital.toFixed(0)}</b>
          </div>
          <div style={{ marginTop: '4px', fontSize: '9px' }}>
            Drift: <b style={{ color: Math.abs(leverageState.driftFromTarget) > 5 ? '#f59e0b' : '#10b981' }}>
              {leverageState.driftFromTarget > 0 ? '+' : ''}{leverageState.driftFromTarget.toFixed(1)}%
            </b>
          </div>
        </div>
      </div>
      
      {needsRebalance && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px', width: '100%' }}>
          <button
            onClick={handleRebalance}
            disabled={loading}
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              border: `1px solid ${statusColor}`,
              background: `${statusColor}22`,
              color: statusColor,
              fontWeight: 'bold',
              fontFamily: 'var(--font-mono)',
              fontSize: '14px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.2s',
              width: '100%',
              textAlign: 'center'
            }}
          >
            {loading ? 'APPLICAZIONE IN CORSO...' : `APPLICA TARGET: ${rebalanceAction?.newLeverage?.toFixed(2) || '2.00'}x`}
          </button>
        </div>
      )}
    </div>
  );
}
