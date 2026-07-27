import React, { useState } from 'react';
import { AntigravityState, AntigravityEngine, DEFAULT_ANTIGRAVITY_CONFIG } from '@/lib/antigravity-engine';
import { PortfolioState } from '@/types';

interface Props {
  agState: AntigravityState | null;
  portfolio: PortfolioState | null;
}

export default function AntigravityMonitor({ agState, portfolio }: Props) {
  const [loading, setLoading] = useState(false);
  
  if (!agState || !portfolio) return null;

  const engine = new AntigravityEngine(DEFAULT_ANTIGRAVITY_CONFIG);
  const formattedStatus = engine.formatStatus(agState);

  const handleRebalance = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/antigravity/rebalance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const statusColor = formattedStatus.color;

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 'bold', letterSpacing: '0.1em' }}>
            ⚖️ ANTIGRAVITY ENGINE V2
          </div>
          <div style={{ 
            fontSize: '18px', 
            fontWeight: 'bold', 
            color: statusColor,
            fontFamily: 'var(--font-mono)',
            marginTop: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {formattedStatus.emoji} {formattedStatus.title}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '6px', maxWidth: '350px', lineHeight: 1.4 }}>
            {formattedStatus.description}
          </div>
        </div>

        <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text3)' }}>
          <div>
            Drawdown: <b style={{ color: agState.currentDrawdownPct > 5 ? '#ef4444' : 'var(--text)' }}>
              {agState.currentDrawdownPct.toFixed(1)}%
            </b>
          </div>
          {agState.tbdInCooldown && agState.cooldownUntil && (
            <div style={{ marginTop: '4px', color: '#f59e0b', fontWeight: 'bold' }}>
              TBD Cooldown:<br/>{new Date(agState.cooldownUntil).toLocaleString('it-IT')}
            </div>
          )}
        </div>
      </div>
      
      {/* Target Allocation Bars */}
      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.05em' }}>TARGET ALLOCAZIONE RACCOMANDATA:</div>
        <div style={{ display: 'flex', gap: '2px', height: '12px', borderRadius: '4px', overflow: 'hidden' }}>
          {agState.coreTargetPct > 0 && <div style={{ width: `${agState.coreTargetPct}%`, background: '#10b981' }} title={`Core: ${agState.coreTargetPct}%`} />}
          {agState.satelliteTargetPct > 0 && <div style={{ width: `${agState.satelliteTargetPct}%`, background: '#f59e0b' }} title={`Satellite: ${agState.satelliteTargetPct}%`} />}
          {agState.tbdTargetPct > 0 && <div style={{ width: `${agState.tbdTargetPct}%`, background: '#8b5cf6' }} title={`TBD: ${agState.tbdTargetPct}%`} />}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: '#10b981' }}>Core: {agState.coreTargetPct}%</span>
          <span style={{ color: '#f59e0b' }}>Satellite: {agState.satelliteTargetPct}%</span>
          <span style={{ color: '#8b5cf6' }}>TBD: {agState.tbdTargetPct}%</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', width: '100%' }}>
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
          {loading ? 'CALCOLO IN CORSO...' : `RICALCOLA ED ESEGUI REBALANCE`}
        </button>
      </div>
    </div>
  );
}
