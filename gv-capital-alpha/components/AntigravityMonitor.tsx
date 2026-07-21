'use client';

import React from 'react';
import { LeverageState } from '@/lib/antigravity-engine';

interface Props {
  leverageState: LeverageState | null;
  rebalanceAction?: any;
}

export default function AntigravityMonitor({ leverageState, rebalanceAction }: Props) {
  if (!leverageState) return null;

  const leverage = leverageState.currentLeverage;
  const statusColor = leverageState.status === 'PROFIT_MODE'
    ? '#10b981'
    : leverageState.status === 'EMERGENCY_STOP'
      ? '#ef4444'
      : leverageState.status === 'CAUTION'
        ? '#f59e0b'
        : '#3b82f6';

  return (
    <div style={{
      background: 'var(--bg2)',
      border: `1px solid ${statusColor}40`,
      borderLeft: `3px solid ${statusColor}`,
      borderRadius: '12px',
      padding: '16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
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
  );
}
