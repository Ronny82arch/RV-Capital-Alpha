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
      setSignals(prev => prev.map(s => s.id === id ? { ...s, status: 'APPROVED' } : s));
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
      setSignals(prev => prev.map(s => s.id === id ? { ...s, status: 'TRIGGERED' } : s));
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
                <strong>{s.symbol}</strong> — {s.action} @ {s.entryPrice.toFixed(2)}€
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Size: €{s.capitalAllocated.toFixed(0)} · Kelly: {(s.kellyFraction*100).toFixed(1)}% · Quality: {(s.winProbability*100).toFixed(0)}%</div>
              </div>
              <div>
                {s.status === 'PENDING' && <button onClick={() => approveSignal(s.id)}>Approva</button>}
                {(s.status === 'APPROVED' || s.status === 'PENDING') && <button style={{ marginLeft: 8 }} onClick={() => markExecuted(s.id)}>Segnala Eseguito</button>}
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>{s.urgency} · {new Date(s.generatedAt).toLocaleTimeString()}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
