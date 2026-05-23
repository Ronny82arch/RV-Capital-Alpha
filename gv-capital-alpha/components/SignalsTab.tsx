'use client';
import { useState } from 'react';
import { PortfolioState, Signal } from '@/types';

interface Props {
  portfolio: PortfolioState | null;
  onConfirm: (signalId: string, price: number) => Promise<boolean>;
  onReject: (signalId: string) => void;
  onScan: () => void;
  scanning: boolean;
}

export default function SignalsTab({ portfolio, onConfirm, onReject, onScan, scanning }: Props) {
  const signals = portfolio?.signals ?? [];
  const pending = signals.filter(s => s.status === 'PENDING');
  const history = signals.filter(s => s.status !== 'PENDING');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {pending.length === 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', marginBottom: '12px' }}>◉</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text3)', marginBottom: '16px' }}>
            Nessun segnale in attesa.<br />Premi SCAN per analizzare il mercato.
          </div>
          <button onClick={onScan} disabled={scanning} style={{
            background: scanning ? 'var(--bg3)' : 'linear-gradient(135deg, #00d4aa, #3b82f6)',
            border: 'none', borderRadius: '10px', color: scanning ? 'var(--text3)' : '#070b14',
            fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '12px',
            letterSpacing: '0.1em', padding: '12px 28px',
          }}>
            {scanning ? '◉ SCANSIONE IN CORSO...' : '▶ AVVIA SCANSIONE AI'}
          </button>
        </div>
      )}

      {pending.map(s => <SignalCard key={s.id} signal={s} onConfirm={onConfirm} onReject={onReject} />)}

      {history.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '10px' }}>STORICO SEGNALI</div>
          {history.slice(0, 20).map(s => <SignalHistoryRow key={s.id} signal={s} />)}
        </div>
      )}
    </div>
  );
}

function SignalCard({ signal, onConfirm, onReject }: { signal: Signal; onConfirm: (id: string, p: number) => Promise<boolean>; onReject: (id: string) => void }) {
  const [priceInput, setPriceInput] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleConfirm = async () => {
    const price = parseFloat(priceInput.replace(',', '.'));
    if (!price || price <= 0) return;
    setConfirming(true);
    await onConfirm(signal.id, price);
    setConfirming(false);
  };

  const urgencyColor = signal.urgency === 'HIGH' ? 'var(--red)' : signal.urgency === 'MEDIUM' ? 'var(--yellow)' : 'var(--green)';
  const typeLabel = signal.type === 'CRYPTO' ? '₿' : signal.type === 'ETF' ? 'ETF' : '📈';

  return (
    <div className="animate-fade" style={{
      background: 'var(--bg2)', border: '2px solid #00d4aa44',
      borderRadius: '14px', padding: '20px', position: 'relative',
    }}>
      {/* Urgency badge */}
      <div style={{ position: 'absolute', top: '14px', right: '14px' }}>
        <span style={{
          fontSize: '9px', padding: '3px 10px', borderRadius: '20px',
          background: `${urgencyColor}22`, color: urgencyColor,
          border: `1px solid ${urgencyColor}44`, fontFamily: 'var(--font-mono)', fontWeight: '700', letterSpacing: '0.1em',
        }}>⚡ {signal.urgency}</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--green)', letterSpacing: '0.15em' }}>▶ ACQUISTO</span>
          <span style={{ fontSize: '10px', color: 'var(--text3)' }}>{typeLabel} {signal.type}</span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: '800' }}>
          {signal.symbol}
          <span style={{ fontSize: '13px', fontWeight: '400', color: 'var(--text2)', marginLeft: '8px' }}>{signal.name}</span>
        </div>
      </div>

      {/* Price grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
        <InfoBox label="PREZZO ORA" value={`€${signal.suggestedPrice.toFixed(2)}`} />
        <InfoBox label="QUANTITÀ" value={`${signal.quantity}`} />
        <InfoBox label="CAPITALE" value={`€${signal.capitalToAllocate.toFixed(0)}`} />
        <InfoBox label="STOP LOSS" value={`€${signal.stopLoss.toFixed(2)}`} sub={`-${signal.stopLossPercent.toFixed(1)}%`} color="var(--red)" />
        <InfoBox label="TAKE PROFIT" value={`€${signal.takeProfit.toFixed(2)}`} sub={`+${signal.takeProfitPercent.toFixed(1)}%`} color="var(--green)" />
        <InfoBox label="WIN PROB." value={`${(signal.winProbability * 100).toFixed(0)}%`} color="var(--blue)" />
      </div>

      {/* Strategy + Kelly */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <Tag>{signal.strategy}</Tag>
        <Tag>Kelly {(signal.kellyFraction * 100).toFixed(1)}%</Tag>
        <Tag>R/R {(signal.takeProfitPercent / signal.stopLossPercent).toFixed(1)}:1</Tag>
        <Tag>RSI {signal.technicals.rsi}</Tag>
        <Tag>{signal.technicals.trend}</Tag>
      </div>

      {/* AI reasoning */}
      <div style={{ background: 'var(--bg3)', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>◉ ANALISI ALPHA</div>
        <p style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: '1.7', margin: 0 }}>{signal.reasoning}</p>
      </div>

      {/* Action */}
      {!showConfirm ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button onClick={() => onReject(signal.id)} style={{
            padding: '13px', borderRadius: '10px', border: '1px solid var(--red)',
            background: 'transparent', color: 'var(--red)',
            fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '12px', letterSpacing: '0.1em',
          }}>✕ RIFIUTA</button>
          <button onClick={() => setShowConfirm(true)} style={{
            padding: '13px', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, #00d4aa, #3b82f6)', color: '#070b14',
            fontFamily: 'var(--font-mono)', fontWeight: '800', fontSize: '12px', letterSpacing: '0.1em',
          }}>✓ ESEGUITO SU ETORO</button>
        </div>
      ) : (
        <div className="animate-fade">
          <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>
            Inserisci il prezzo di esecuzione che hai ottenuto su eToro:
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="number"
              step="0.01"
              placeholder={`es. ${signal.suggestedPrice.toFixed(2)}`}
              value={priceInput}
              onChange={e => setPriceInput(e.target.value)}
              style={{ flex: 1 }}
            />
            <button onClick={handleConfirm} disabled={confirming || !priceInput} style={{
              background: 'linear-gradient(135deg, #00d4aa, #3b82f6)',
              border: 'none', borderRadius: '8px', color: '#070b14',
              fontFamily: 'var(--font-mono)', fontWeight: '800', fontSize: '12px',
              padding: '10px 20px', opacity: (!priceInput || confirming) ? 0.5 : 1,
            }}>
              {confirming ? '...' : 'CONFERMA'}
            </button>
            <button onClick={() => setShowConfirm(false)} style={{
              background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px',
              color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '12px', padding: '10px 14px',
            }}>✕</button>
          </div>
        </div>
      )}

      <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '12px', fontFamily: 'var(--font-mono)' }}>
        Generato: {new Date(signal.createdAt).toLocaleString('it-IT')}
      </div>
    </div>
  );
}

function SignalHistoryRow({ signal }: { signal: Signal }) {
  const statusColor = signal.status === 'EXECUTED' ? 'var(--green)' : signal.status === 'REJECTED' ? 'var(--red)' : 'var(--text3)';
  const statusLabel = signal.status === 'EXECUTED' ? '✓ ESEGUITO' : signal.status === 'REJECTED' ? '✕ RIFIUTATO' : signal.status;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: '10px', marginBottom: '6px',
    }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700' }}>{signal.symbol}</span>
        <span style={{ fontSize: '11px', color: 'var(--text3)' }}>{signal.strategy}</span>
      </div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        {signal.executedPrice && (
          <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>€{signal.executedPrice.toFixed(2)}</span>
        )}
        <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: statusColor, fontWeight: '700' }}>{statusLabel}</span>
      </div>
    </div>
  );
}

function InfoBox({ label, value, sub, color = 'var(--text)' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--bg3)', borderRadius: '8px', padding: '10px' }}>
      <div style={{ fontSize: '9px', color: 'var(--text3)', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: '700', fontFamily: 'var(--font-mono)', color }}>{value}</div>
      {sub && <div style={{ fontSize: '10px', color, opacity: 0.7 }}>{sub}</div>}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: '10px', padding: '3px 10px', borderRadius: '20px',
      background: 'var(--bg3)', border: '1px solid var(--border)',
      color: 'var(--text2)', fontFamily: 'var(--font-mono)',
    }}>{children}</span>
  );
}
