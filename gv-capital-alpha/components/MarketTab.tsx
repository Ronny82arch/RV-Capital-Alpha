'use client';
import { MarketData } from '@/types';

interface Props { market: MarketData[]; }

export default function MarketTab({ market }: Props) {
  const etfs = market.filter(m => m.type === 'ETF');
  const stocks = market.filter(m => m.type === 'STOCK');
  const crypto = market.filter(m => m.type === 'CRYPTO');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {etfs.length > 0 && <AssetGroup title="ETF" items={etfs} />}
      {stocks.length > 0 && <AssetGroup title="AZIONI" items={stocks} />}
      {crypto.length > 0 && <AssetGroup title="CRYPTO" items={crypto} />}
      {market.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text3)', fontFamily: 'var(--font-mono)', padding: '40px' }}>
          Caricamento dati di mercato...
        </div>
      )}
    </div>
  );
}

function AssetGroup({ title, items }: { title: string; items: MarketData[] }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.2em', fontFamily: 'var(--font-mono)', fontWeight: '700', marginBottom: '10px' }}>{title}</div>
      {items.map(item => <MarketRow key={item.symbol} item={item} />)}
    </div>
  );
}

function MarketRow({ item }: { item: MarketData }) {
  const isUp = item.changePercent >= 0;
  const closes = item.history.map(h => h.close).filter(p => p > 0);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: '10px', padding: '12px 14px', marginBottom: '6px',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '14px' }}>{item.symbol}</span>
          <span style={{ fontSize: '11px', color: 'var(--text3)' }}>{item.name}</span>
        </div>
      </div>

      {closes.length > 5 && (
        <div style={{ width: '60px', height: '28px' }}>
          <MicroChart closes={closes.slice(-15)} color={isUp ? '#00d4aa' : '#ef4444'} />
        </div>
      )}

      <div style={{ textAlign: 'right', minWidth: '90px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '14px' }}>
          €{item.price.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: item.price > 100 ? 2 : 4 })}
        </div>
        <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: isUp ? 'var(--green)' : 'var(--red)', fontWeight: '600' }}>
          {isUp ? '+' : ''}{item.changePercent.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

function MicroChart({ closes, color }: { closes: number[]; color: string }) {
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const W = 60; const H = 28;
  const points = closes.map((v, i) => {
    const x = (i / Math.max(1, closes.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}
