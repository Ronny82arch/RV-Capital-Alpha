'use client';

import React from 'react';
import { BucketProjection } from '@/lib/types';
import { useApp, formatCurrency, formatPercent } from './providers';

interface ProjectionCardProps {
  name: string;
  allocationPct: number;
  currentValue: number;
  projection?: BucketProjection;
  color: string;
}

export function ProjectionCard({ name, allocationPct, currentValue, projection, color }: ProjectionCardProps) {
  const { hideValues } = useApp();

  const p10pct = projection ? ((projection.p10 / currentValue) - 1) * 100 : 0;
  const p50pct = projection ? ((projection.p50 / currentValue) - 1) * 100 : 0;
  const p90pct = projection ? ((projection.p90 / currentValue) - 1) * 100 : 0;

  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: '16px',
      padding: '20px',
      fontFamily: 'var(--font-mono)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: color }} />
          <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)', textTransform: 'uppercase' }}>{name}</span>
        </div>
        <span style={{ fontSize: '10px', color: 'var(--text3)', background: 'var(--bg3)', padding: '2px 8px', borderRadius: '6px' }}>
          {allocationPct}%
        </span>
      </div>

      <div>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text)' }}>
          {formatCurrency(currentValue, hideValues)}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text3)' }}>Valore attuale</div>
      </div>

      {projection ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text3)', marginBottom: '4px' }}>
              <span>Proiezione annua (p50)</span>
              <span style={{ color: p50pct >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 'bold' }}>
                {formatPercent(p50pct, hideValues)}
              </span>
            </div>
            <div style={{ height: '6px', background: 'var(--bg3)', borderRadius: '3px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  borderRadius: '3px',
                  width: `${Math.min(100, Math.max(5, (p50pct + 30) / 60 * 100))}%`,
                  backgroundColor: color,
                  transition: 'width 0.6s ease'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '9px', color: 'var(--text3)' }}>p10 worst</div>
              <div style={{ fontWeight: 'bold', color: 'var(--red)' }}>{formatPercent(p10pct, hideValues)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '9px', color: 'var(--text3)' }}>mediana</div>
              <div style={{ fontWeight: 'bold', color: 'var(--blue)' }}>{formatPercent(p50pct, hideValues)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '9px', color: 'var(--text3)' }}>p90 best</div>
              <div style={{ fontWeight: 'bold', color: 'var(--green)' }}>{formatPercent(p90pct, hideValues)}</div>
            </div>
          </div>

          <div style={{
            background: 'var(--bg3)',
            borderRadius: '8px',
            padding: '10px',
            fontSize: '11px',
            color: 'var(--text2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Intervallo confidenza:</span>
              <span style={{ fontWeight: 'bold', color: 'var(--text)' }}>[{formatPercent(p10pct, hideValues)}, {formatPercent(p90pct, hideValues)}]</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Probabilità anno positivo:</span>
              <span style={{ fontWeight: 'bold', color: 'var(--text)' }}>{projection.successRate.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          background: 'var(--bg3)',
          borderRadius: '8px',
          padding: '16px',
          textAlign: 'center',
          fontSize: '11px',
          color: 'var(--text3)'
        }}>
          Calibrazione in corso...
        </div>
      )}
    </div>
  );
}
