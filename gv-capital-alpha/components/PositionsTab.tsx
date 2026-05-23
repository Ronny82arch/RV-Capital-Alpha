'use client';
import { useState } from 'react';
import { PortfolioState, Position, MarketData } from '@/types';

interface Props {
  portfolio: PortfolioState | null;
  market: MarketData[];
  onClose: (positionId: string, price: number) => Promise<boolean>;
}

export default function PositionsTab({ portfolio, market, onClose }: Props) {
  const openPositions = portfolio?.positions.filter(p => p.status === 'OPEN') ?? [];
  const closedPositions = portfolio?.positions.filter(p => p.status === 'CLOSED') ?? [];
  const totalUnrealized = openPositions.reduce((s, p) => s + (p.unrealizedPnl ?? 0), 0);
  const totalRealized = closedPositions.reduce((s, p) => s + (p.realizedPnl ?? 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Summary */}
      {(openPositions.length > 0 || closedPositions.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>P&L NON REALIZZATO</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: '700', color: totalUnrealized >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {totalUnrealized >= 0 ? '+' : ''}€{totalUnrealized.toFixed(2)}
            </div>
          </div>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>P&L REALIZZATO</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: '700', color: totalRealized >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {totalRealized >= 0 ? '+' : ''}€{totalRealized.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {openPositions.length === 0 && closedPositions.length === 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '32px', textAlign: 'center', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
          Nessuna posizione aperta.<br />
          <span style={{ fontSize: '12px' }}>Approva un segnale per iniziare.</span>
        </div>
      )}

      {openPositions.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '10px' }}>POSIZIONI APERTE ({openPositions.length})</div>
          {openPositions.map(pos => (
            <PositionCard key={pos.id} position={pos} onClose={onClose} />
          ))}
        </div>
      )}

      {closedPositions.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '10px' }}>POSIZIONI CHIUSE ({closedPositions.length})</div>
          {closedPositions.map(pos => <ClosedPositionRow key={pos.id} position={pos} />)}
        </div>
      )}
    </div>
  );
}

function PositionCard({ position: pos, onClose }: { position: Position; onClose: (id: string, p: number) => Promise<boolean> }) {
  const [showClose, setShowClose] = useState(false);
  const [priceInput, setPriceInput] = useState('');
  const [closing, setClosing] = useState(false);

  const pnl = pos.unrealizedPnl ?? 0;
  const pnlPct = pos.unrealizedPnlPercent ?? 0;
  const currentPrice = pos.currentPrice ?? pos.entryPrice;
  const distToSL = ((currentPrice - pos.stopLoss) / pos.entryPrice * 100);
  const distToTP = ((pos.takeProfit - currentPrice) / pos.entryPrice * 100);
  const slWarning = distToSL < 3;

  const handleClose = async () => {
    const price = parseFloat(priceInput.replace(',', '.'));
    if (!price || price <= 0) return;
    setClosing(true);
    await onClose(pos.id, price);
    setClosing(false);
  };

  return (
    <div style={{
      background: 'var(--bg2)', border: `1px solid ${slWarning ? '#ef444444' : 'var(--border)'}`,
      borderRadius: '12px', padding: '16px', marginBottom: '10px',
    }}>
      {slWarning && (
        <div style={{ background: '#ef444411', border: '1px solid #ef444433', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '11px', color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>
          ⚠️ ATTENZIONE — Stop loss vicino ({distToSL.toFixed(1)}% di distanza)
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', fontSize: '18px' }}>{pos.symbol}</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{pos.name} · {pos.quantity} unità</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: '700', color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {pnl >= 0 ? '+' : ''}€{pnl.toFixed(2)}
          </div>
          <div style={{ fontSize: '11px', color: pnlPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
        <MiniInfo label="ENTRATA" value={`€${pos.entryPrice.toFixed(2)}`} />
        <MiniInfo label="ATTUALE" value={`€${currentPrice.toFixed(2)}`} />
        <MiniInfo label="STOP LOSS" value={`€${pos.stopLoss.toFixed(2)}`} sub={`${distToSL.toFixed(1)}%`} color="var(--red)" />
        <MiniInfo label="TAKE PROFIT" value={`€${pos.takeProfit.toFixed(2)}`} sub={`${distToTP.toFixed(1)}%`} color="var(--green)" />
      </div>

      {/* Progress bar between SL and TP */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ height: '4px', background: 'var(--bg3)', borderRadius: '2px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', background: 'linear-gradient(90deg, var(--red), var(--green))', width: '100%', opacity: 0.3 }} />
          <div style={{
            position: 'absolute',
            left: `${Math.max(2, Math.min(96, (currentPrice - pos.stopLoss) / (pos.takeProfit - pos.stopLoss) * 100))}%`,
            top: '50%', transform: 'translateY(-50%)',
            width: '8px', height: '8px', borderRadius: '50%', background: 'white',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text3)', marginTop: '4px' }}>
          <span>SL</span><span>TP</span>
        </div>
      </div>

      <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '10px' }}>
        Aperta: {new Date(pos.entryDate).toLocaleDateString('it-IT')} · Capitale: €{pos.capitalAllocated.toFixed(0)}
      </div>

      {!showClose ? (
        <button onClick={() => setShowClose(true)} style={{
          width: '100%', padding: '11px', borderRadius: '8px',
          border: '1px solid var(--border)', background: 'transparent',
          color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em',
        }}>CHIUDI POSIZIONE SU ETORO</button>
      ) : (
        <div className="animate-fade">
          <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>
            Inserisci il prezzo di chiusura da eToro:
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="number" step="0.01" placeholder={`es. ${currentPrice.toFixed(2)}`} value={priceInput} onChange={e => setPriceInput(e.target.value)} style={{ flex: 1 }} />
            <button onClick={handleClose} disabled={closing || !priceInput} style={{
              background: 'var(--green)', border: 'none', borderRadius: '8px', color: '#070b14',
              fontFamily: 'var(--font-mono)', fontWeight: '800', padding: '10px 16px', fontSize: '12px',
              opacity: (!priceInput || closing) ? 0.5 : 1,
            }}>{closing ? '...' : 'OK'}</button>
            <button onClick={() => setShowClose(false)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', padding: '10px 12px', fontSize: '12px' }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ClosedPositionRow({ position: pos }: { position: Position }) {
  const pnl = pos.realizedPnl ?? 0;
  const pnlPct = pos.realizedPnlPercent ?? 0;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 14px', background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: '10px', marginBottom: '6px',
    }}>
      <div>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700' }}>{pos.symbol}</span>
        <span style={{ fontSize: '11px', color: 'var(--text3)', marginLeft: '8px' }}>
          {pos.quantity} × €{pos.entryPrice.toFixed(2)} → €{pos.closePrice?.toFixed(2)}
        </span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: '700', color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
          {pnl >= 0 ? '+' : ''}€{pnl.toFixed(2)}
        </div>
        <div style={{ fontSize: '10px', color: pnlPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
          {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

function MiniInfo({ label, value, sub, color = 'var(--text)' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--bg3)', borderRadius: '6px', padding: '8px' }}>
      <div style={{ fontSize: '8px', color: 'var(--text3)', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '12px', fontWeight: '700', fontFamily: 'var(--font-mono)', color }}>{value}</div>
      {sub && <div style={{ fontSize: '9px', color, opacity: 0.7 }}>{sub}</div>}
    </div>
  );
}
