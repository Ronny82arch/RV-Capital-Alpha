'use client';
import { PortfolioState } from '@/types';

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
