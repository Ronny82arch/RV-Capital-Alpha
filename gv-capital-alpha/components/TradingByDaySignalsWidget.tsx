import React, { useEffect, useState } from 'react';
import { TradingDayLog, TbdSignal } from '@/lib/trading-by-day';

export default function TradingByDaySignalsWidget() {
  const [signals, setSignals] = useState<TbdSignal[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/tbd/log');
        const j = await res.json();
        if (!mounted) return;
        if (j.success && j.data && Array.isArray(j.data.activeSignals)) {
          setSignals(j.data.activeSignals);
        } else {
          setSignals([]);
        }
      } catch (err) {
        console.error('Failed to load TBD signals', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const approveSignal = async (id: string) => {
    try {
      await fetch('/api/signals/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId: id })
      });
      setSignals(prev => prev.map(s => s.id === id ? ({ ...(s as any), status: 'APPROVED' } as TbdSignal) : s));
    } catch (err) {
      console.error('Approve failed', err);
    }
  };

  const markExecuted = async (id: string) => {
    try {
      await fetch('/api/signals/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId: id, executedPrice: null })
      });
      setSignals(prev => prev.map(s => s.id === id ? ({ ...(s as any), status: 'TRIGGERED' } as TbdSignal) : s));
    } catch (err) {
      console.error('Mark executed failed', err);
    }
  };

  if (loading) return <div>Caricamento segnali...</div>;
  if (!signals || signals.length === 0) return <div>Nessun segnale per ora.</div>;

  return (
    <div style={{ marginTop: 16 }}>
      <h4>Segnali Trading by Day</h4>
      <ul>
        {signals.map(s => (
          <li key={s.id} style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{(s as any).symbol ?? (s as any).asset}</strong> — {(s as any).action ?? (s as any).direction} @ {(s as any).entryPrice?.toFixed ? (s as any).entryPrice.toFixed(2) : (s as any).entryPrice}€
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  Size: €{((s as any).capitalAllocated ?? (s as any).allocatedSize ?? 0).toFixed ? ((s as any).capitalAllocated ?? (s as any).allocatedSize ?? 0).toFixed(0) : (s as any).capitalAllocated}
                  {' · '}Kelly: {(((s as any).kellyFraction ?? (s as any).kelly ?? 0) * 100).toFixed(1)}% {' · '}Quality: {(((s as any).winProbability ?? (s as any).qualityScore ?? 0) * 100).toFixed(0)}%
                </div>
              </div>
              <div>
                {( (s as any).status === 'PENDING' ) && <button onClick={() => approveSignal(s.id)}>Approva</button>}
                {((s as any).status === 'APPROVED' || (s as any).status === 'PENDING') && <button style={{ marginLeft: 8 }} onClick={() => markExecuted(s.id)}>Segnala Eseguito</button>}
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>{(s as any).urgency ?? ''} · {new Date((s as any).generatedAt ?? (s as any).timestamp).toLocaleTimeString()}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
