'use client';
import { MarketData } from '@/types';
import AssetIcon from './AssetIcon';

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
  const range = item.high24h - item.low24h || 1;
  const rangePercent = Math.min(100, Math.max(0, ((item.price - item.low24h) / range) * 100));

  const formatVolume = (val: number) => {
    if (!val || val === 0) return 'N/D';
    if (val >= 1e9) return `€${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `€${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `€${(val / 1e3).toFixed(0)}K`;
    return `€${val.toFixed(0)}`;
  };

  const typeColor = item.type === 'CRYPTO' ? '#eab308' : item.type === 'ETF' ? '#3b82f6' : '#a855f7';

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px',
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: '12px', padding: '16px', marginBottom: '8px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
    }}>
      {/* Icon & Symbol */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '200px', flex: '1 1 200px' }}>
        <AssetIcon symbol={item.symbol} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '15px' }}>{item.symbol}</span>
            <span style={{
              fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: '700',
              padding: '2px 6px', borderRadius: '4px', background: `${typeColor}22`, color: typeColor,
              border: `1px solid ${typeColor}44`
            }}>{item.type}</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>{item.name}</div>
        </div>
      </div>

      {/* Sparkline (15d trend) */}
      {closes.length > 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: '70px' }}>
          <span style={{ fontSize: '9px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>TREND 15G</span>
          <div style={{ width: '70px', height: '28px' }}>
            <MicroChart closes={closes.slice(-15)} color={isUp ? 'var(--green)' : 'var(--red)'} />
          </div>
        </div>
      )}

      {/* 24h Range Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px', flex: '1 1 150px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
          <span>MIN 24H: €{item.low24h.toLocaleString('it-IT', { maximumFractionDigits: 2 })}</span>
          <span>MAX 24H: €{item.high24h.toLocaleString('it-IT', { maximumFractionDigits: 2 })}</span>
        </div>
        <div style={{ height: '5px', background: 'var(--border)', borderRadius: '3px', position: 'relative', overflow: 'visible', margin: '4px 0' }}>
          <div style={{
            position: 'absolute', top: '-3px', left: `calc(${rangePercent}% - 5px)`,
            width: '10px', height: '11px', borderRadius: '50%',
            background: isUp ? 'var(--green)' : 'var(--red)',
            boxShadow: '0 0 8px rgba(0,0,0,0.5)'
          }} />
        </div>
      </div>

      {/* Volume 24h */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '80px' }}>
        <span style={{ fontSize: '9px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>VOLUME 24H</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: '600' }}>{formatVolume(item.volume)}</span>
      </div>

      {/* Price & Change */}
      <div style={{ textAlign: 'right', minWidth: '120px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '16px' }}>
          €{item.price.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: item.price > 100 ? 2 : 4 })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)', color: isUp ? 'var(--green)' : 'var(--red)', fontWeight: '600', marginTop: '2px' }}>
          <span>{isUp ? '+' : ''}{item.change.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</span>
          <span>({isUp ? '+' : ''}{item.changePercent.toFixed(2)}%)</span>
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
