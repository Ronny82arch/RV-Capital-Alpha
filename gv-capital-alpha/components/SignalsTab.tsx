'use client';
import { useState, useEffect } from 'react';
import { PortfolioState, Signal } from '@/types';
import { formatNumber } from './providers';

interface Props {
  portfolio: PortfolioState | null;
  onConfirm: (signalId: string, price: number) => Promise<boolean>;
  onReject: (signalId: string) => void;
  onScan: () => void;
  scanning: boolean;
  onUpdateAiMode?: (mode: 'STRICT' | 'DYNAMIC') => Promise<boolean>;
  onSatelliteScan?: () => void;
}

export default function SignalsTab({ portfolio, onConfirm, onReject, onScan, scanning, onUpdateAiMode, onSatelliteScan }: Props) {
  const signals = portfolio?.signals ?? [];
  const [filter, setFilter] = useState<'ALL' | 'AI' | 'ANTIGRAVITY_REBALANCE' | 'TBD_ENGINE'>('ALL');

  const isTBD = (s: Signal) => s.source === 'TBD_ENGINE' || s.tags?.includes('TBD_ENGINE') || s.tags?.includes('TBD_GENERATED') || s.portfolio === 'TBD';

  const filteredSignals = signals.filter(s => {
    if (filter === 'AI') return !s.tags?.includes('ANTIGRAVITY_REBALANCE') && !isTBD(s);
    if (filter === 'ANTIGRAVITY_REBALANCE') return s.tags?.includes('ANTIGRAVITY_REBALANCE');
    if (filter === 'TBD_ENGINE') return isTBD(s);
    return true;
  });

  const pending = filteredSignals.filter(s => s.status === 'PENDING');
  const history = filteredSignals.filter(s => s.status !== 'PENDING');
  const pendingTbdSignals = signals.filter(s => isTBD(s) && s.status === 'PENDING');
  
  const [localAiMode, setLocalAiMode] = useState<'STRICT'|'DYNAMIC'>(portfolio?.aiMode || 'STRICT');

  useEffect(() => {
    setLocalAiMode(portfolio?.aiMode || 'STRICT');
  }, [portfolio?.aiMode]);

  const handleModeChange = async (mode: 'STRICT' | 'DYNAMIC') => {
    setLocalAiMode(mode);
    if (onUpdateAiMode) await onUpdateAiMode(mode);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Filtro Tipo Segnali */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilter('ALL')}
          style={{
            padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)',
            background: filter === 'ALL' ? 'var(--blue)' : 'var(--bg2)', color: filter === 'ALL' ? '#fff' : 'var(--text3)',
            fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', cursor: 'pointer'
          }}
        >
          Tutti ({signals.length})
        </button>
        <button
          onClick={() => setFilter('AI')}
          style={{
            padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)',
            background: filter === 'AI' ? 'var(--blue)' : 'var(--bg2)', color: filter === 'AI' ? '#fff' : 'var(--text3)',
            fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', cursor: 'pointer'
          }}
        >
          🤖 AI
        </button>
        <button
          onClick={() => setFilter('ANTIGRAVITY_REBALANCE')}
          style={{
            padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)',
            background: filter === 'ANTIGRAVITY_REBALANCE' ? 'var(--green)' : 'var(--bg2)', color: filter === 'ANTIGRAVITY_REBALANCE' ? '#000' : 'var(--text3)',
            fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', cursor: 'pointer'
          }}
        >
          ⚖️ Rebalance
        </button>
        <button
          onClick={() => setFilter('TBD_ENGINE')}
          style={{
            padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)',
            background: filter === 'TBD_ENGINE' ? 'rgba(0, 212, 170, 0.15)' : 'var(--bg2)',
            color: filter === 'TBD_ENGINE' ? '#00d4aa' : 'var(--text3)',
            fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '4px'
          }}
        >
          <span>⚡ TBD Engine</span>
          {signals.filter(isTBD).length > 0 && (
            <span style={{
              background: filter === 'TBD_ENGINE' ? '#00d4aa' : 'var(--text3)',
              color: filter === 'TBD_ENGINE' ? '#000' : '#fff',
              borderRadius: '10px', padding: '1px 6px', fontSize: '9px'
            }}>
              {signals.filter(isTBD).length}
            </span>
          )}
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)' }}>SEGNALI ATTIVI</div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {onSatelliteScan && (
            <button
              onClick={onSatelliteScan}
              disabled={scanning}
              style={{
                padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--border)',
                fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 'bold',
                background: scanning ? 'var(--bg2)' : 'linear-gradient(135deg, #00d4aa 0%, #00b48a 100%)',
                color: scanning ? 'var(--text3)' : '#000000',
                cursor: scanning ? 'not-allowed' : 'pointer',
                boxShadow: scanning ? 'none' : '0 0 10px rgba(0, 212, 170, 0.25)',
                transition: 'all 0.2s'
              }}
            >
              {scanning ? 'SCAN...' : '🔍 SCAN SATELLITE'}
            </button>
          )}
          <div style={{ 
            background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '20px', 
            display: 'flex', padding: '4px', gap: '4px' 
          }}>
          <button 
            onClick={() => handleModeChange('STRICT')}
            style={{
              padding: '6px 12px', borderRadius: '16px', border: 'none',
              fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 'bold',
              background: localAiMode === 'STRICT' ? 'var(--blue)' : 'transparent',
              color: localAiMode === 'STRICT' ? '#fff' : 'var(--text3)',
              transition: 'all 0.2s', cursor: 'pointer'
            }}
          >
            🎯 SNIPER (STRICT)
          </button>
          <button 
            onClick={() => handleModeChange('DYNAMIC')}
            style={{
              padding: '6px 12px', borderRadius: '16px', border: 'none',
              fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 'bold',
              background: localAiMode === 'DYNAMIC' ? 'var(--green)' : 'transparent',
              color: localAiMode === 'DYNAMIC' ? '#111' : 'var(--text3)',
              transition: 'all 0.2s', cursor: 'pointer'
            }}
          >
            🌊 DINAMICA (LESS RESTRICTIVE)
          </button>
        </div>
        </div>
      </div>

      {/* Riepilogo Segnali TBD in attesa */}
      {pendingTbdSignals.length > 0 && filter !== 'TBD_ENGINE' && (
        <div style={{
          marginBottom: '0.5rem',
          padding: '1rem',
          background: 'rgba(0, 212, 170, 0.05)',
          border: '1px solid #00d4aa',
          borderRadius: '12px',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}>
            <div style={{ fontWeight: 700, color: '#00d4aa', fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}>
              ⚡ Segnali TBD in attesa ({pendingTbdSignals.length})
            </div>
            <button
              onClick={() => setFilter('TBD_ENGINE')}
              style={{
                fontSize: '0.8rem',
                color: '#00d4aa',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontFamily: 'var(--font-mono)'
              }}
            >
              Mostra solo questi
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {pendingTbdSignals.slice(0, 3).map((s: any) => (
              <div key={s.id} style={{
                padding: '0.6rem 0.9rem',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '8px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontFamily: 'var(--font-mono)'
              }}>
                <span style={{ fontWeight: 700, color: '#fff' }}>{s.symbol}</span>
                <span style={{ color: 'var(--text3)' }}>@</span>
                <span style={{ color: '#00d4aa' }}>€{formatNumber(s.suggestedPrice || s.entryPrice || 0, 2)}</span>
                {s.kellyFraction !== undefined && (
                  <span style={{
                    background: '#00d4aa',
                    color: '#000',
                    padding: '0.1rem 0.3rem',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                  }}>
                    Kelly {(s.kellyFraction * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length === 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '32px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0, 212, 170, 0.1)', padding: '6px 14px', borderRadius: '20px', border: '1px solid #00d4aa33' }}>
            <span style={{ 
              display: 'inline-block', 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              background: '#00d4aa',
              boxShadow: '0 0 8px #00d4aa',
              animation: 'pulse 1.8s infinite ease-in-out'
            }} />
            <style>{`
              @keyframes pulse {
                0% { opacity: 0.4; transform: scale(0.9); }
                50% { opacity: 1; transform: scale(1.1); }
                100% { opacity: 0.4; transform: scale(0.9); }
              }
            `}</style>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#00d4aa', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>MONITORAGGIO AI ATTIVO</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text2)', lineHeight: '1.6' }}>
            Nessun segnale in attesa.<br />
            <span style={{ fontSize: '11px', color: 'var(--text3)' }}>L'intelligenza artificiale scansiona i mercati in background 24/7.</span>
          </div>
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

  const isRebalance = signal.tags?.includes('ANTIGRAVITY_REBALANCE');
  const isTBD = signal.source === 'TBD_ENGINE' || signal.tags?.includes('TBD_ENGINE') || signal.tags?.includes('TBD_GENERATED') || signal.portfolio === 'TBD';
  const isImmediate = signal.tags?.includes('IMMEDIATE') || signal.urgency === 'HIGH';
  const isHour = signal.tags?.includes('WITHIN_HOUR');

  const urgencyColor = signal.urgency === 'HIGH' ? 'var(--red)' : signal.urgency === 'MEDIUM' ? 'var(--yellow)' : 'var(--green)';
  const typeLabel = signal.type === 'CRYPTO' ? '₿' : signal.type === 'ETF' ? 'ETF' : '📈';

  return (
    <div className="animate-fade" style={{
      background: 'var(--bg2)',
      border: isTBD ? '2px solid #00d4aa' : isRebalance ? '2px solid var(--green)' : '2px solid #00d4aa44',
      borderRadius: '14px', padding: '20px', position: 'relative',
    }}>
      {/* Urgency, TBD & Rebalance Badges */}
      <div style={{ position: 'absolute', top: '14px', right: '14px', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
        {isTBD && (
          <span style={{
            background: 'linear-gradient(135deg, #00d4aa, #3b82f6)',
            color: '#000',
            padding: '3px 10px',
            borderRadius: '20px',
            fontSize: '9px',
            fontWeight: 800,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.05em'
          }}>
            ⚡ TBD ENGINE
          </span>
        )}
        {isImmediate && (
          <span style={{ background: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
            URGENTE
          </span>
        )}
        {isHour && (
          <span style={{ background: '#f59e0b', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
            1H
          </span>
        )}
        {isRebalance && (
          <span style={{
            background: 'var(--green)',
            color: '#000',
            padding: '3px 10px',
            borderRadius: '20px',
            fontSize: '9px',
            fontWeight: 800,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.05em'
          }}>
            🤖 REBALANCE
          </span>
        )}
        <span style={{
          fontSize: '9px', padding: '3px 10px', borderRadius: '20px',
          background: `${urgencyColor}22`, color: urgencyColor,
          border: `1px solid ${urgencyColor}44`, fontFamily: 'var(--font-mono)', fontWeight: '700', letterSpacing: '0.1em',
        }}>⚡ {signal.urgency}</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: signal.action === 'BUY' ? 'var(--green)' : 'var(--red)', letterSpacing: '0.15em' }}>
            {signal.action === 'BUY' ? '▶ ACQUISTO' : '◀ VENDITA'}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text3)' }}>{typeLabel} {signal.type}</span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: '800' }}>
          {signal.symbol}
          <span style={{ fontSize: '13px', fontWeight: '400', color: 'var(--text2)', marginLeft: '8px' }}>{signal.name}</span>
        </div>
      </div>

      {/* Price grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
        <InfoBox label="PREZZO ORA" value={`€${formatNumber(signal.suggestedPrice || signal.entryPrice || 0, 2)}`} />
        <InfoBox label="QUANTITÀ" value={`${signal.quantity || 0}`} />
        <InfoBox label="CAPITALE" value={`€${formatNumber(signal.capitalToAllocate, 0)}`} />
        <InfoBox label="STOP LOSS" value={`€${formatNumber(signal.stopLoss, 2)}`} sub={`-${(signal.stopLossPercent || 5).toFixed(1)}%`} color="var(--red)" />
        <InfoBox label="TAKE PROFIT" value={`€${formatNumber(signal.takeProfit, 2)}`} sub={`+${(signal.takeProfitPercent || 10).toFixed(1)}%`} color="var(--green)" />
        <InfoBox label="WIN PROB." value={`${((signal.winProbability || 0.5) * 100).toFixed(0)}%`} color="var(--blue)" />
      </div>

      {/* Strategy + Kelly + RiskReward */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <Tag>{signal.strategy || 'Antigravity Dynamic'}</Tag>
        <Tag>Kelly {((signal.kellyFraction || 0.5) * 100).toFixed(1)}%</Tag>
        <Tag>R/R {(signal.riskRewardRatio ? signal.riskRewardRatio : ((signal.takeProfitPercent || 10) / (signal.stopLossPercent || 5))).toFixed(1)}:1</Tag>
        {signal.technicals?.rsi && <Tag>RSI {signal.technicals.rsi}</Tag>}
        {signal.technicals?.trend && <Tag>{signal.technicals.trend}</Tag>}
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
          <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>
            Prezzo di esecuzione ottenuto su eToro:
          </div>
          <input
            type="number"
            step="0.01"
            placeholder={`es. ${formatNumber(signal.suggestedPrice || signal.entryPrice || 0, 2)}`}
            value={priceInput}
            onChange={e => setPriceInput(e.target.value)}
            style={{ width: '100%', marginBottom: '12px' }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <button onClick={handleConfirm} disabled={confirming || !priceInput} style={{
              background: 'linear-gradient(135deg, #00d4aa, #3b82f6)',
              border: 'none', borderRadius: '8px', color: '#070b14',
              fontFamily: 'var(--font-mono)', fontWeight: '800', fontSize: '11px',
              padding: '12px 6px', opacity: (!priceInput || confirming) ? 0.5 : 1,
              letterSpacing: '0.05em'
            }}>
              {confirming ? '...' : '✓ CONFERMA ESECUZIONE'}
            </button>
            <button onClick={() => onReject(signal.id)} style={{
              background: 'transparent', border: '1px solid var(--red)', borderRadius: '8px',
              color: 'var(--red)', fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '11px',
              padding: '12px 6px', letterSpacing: '0.05em'
            }}>
              ✕ RIFIUTA SEGNALE
            </button>
          </div>
          <button onClick={() => setShowConfirm(false)} style={{
            width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px',
            color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '10px',
            letterSpacing: '0.05em'
          }}>
            ✕ ANNULLA e TORNA INDIETRO
          </button>
        </div>
      )}

      <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '12px', fontFamily: 'var(--font-mono)' }}>
        Generato: {new Date(signal.createdAt).toLocaleString('it-IT')}
      </div>
    </div>
  );
}

function SignalHistoryRow({ signal }: { signal: Signal }) {
  const isApproved = signal.status === 'APPROVED';
  const isTBD = signal.source === 'TBD_ENGINE' || signal.tags?.includes('TBD_ENGINE') || signal.tags?.includes('TBD_GENERATED') || signal.portfolio === 'TBD';
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px',
      padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: '8px', opacity: 0.7,
    }}>
      <div>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '13px' }}>{signal.symbol}</span>
        <span style={{ fontSize: '11px', color: 'var(--text3)', marginLeft: '8px' }}>€{formatNumber(signal.suggestedPrice || signal.entryPrice || 0, 2)}</span>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {isTBD && (
          <span style={{ fontSize: '9px', background: '#00d4aa', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>TBD</span>
        )}
        {signal.tags?.includes('ANTIGRAVITY_REBALANCE') && (
          <span style={{ fontSize: '9px', background: 'var(--green)', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>REBALANCE</span>
        )}
        <span style={{
          fontSize: '10px', padding: '2px 8px', borderRadius: '4px',
          background: isApproved ? 'var(--green)22' : 'var(--red)22',
          color: isApproved ? 'var(--green)' : 'var(--red)',
          fontFamily: 'var(--font-mono)', fontWeight: '700',
        }}>
          {isApproved ? '✓ APPROVATO' : '✕ RIFIUTATO'}
        </span>
      </div>
    </div>
  );
}

function InfoBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--bg3)', borderRadius: '8px', padding: '10px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '9px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '13px', fontWeight: '700', fontFamily: 'var(--font-mono)', color: color || 'var(--text)' }}>
        {value}
        {sub && <span style={{ fontSize: '10px', marginLeft: '4px', fontWeight: '400' }}>({sub})</span>}
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: '10px', padding: '3px 8px', borderRadius: '6px',
      background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)',
      fontFamily: 'var(--font-mono)',
    }}>
      {children}
    </span>
  );
}
