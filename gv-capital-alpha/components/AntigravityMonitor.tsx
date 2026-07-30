import React, { useState } from 'react';
import { AntigravityState, AntigravityEngine, DEFAULT_ANTIGRAVITY_CONFIG } from '@/lib/antigravity-engine';
import { PortfolioState } from '@/types';

interface Props {
  agState: AntigravityState | null;
  portfolio: PortfolioState | null;
}

export default function AntigravityMonitor({ agState, portfolio }: Props) {
  const [loading, setLoading] = useState(false);
  const [rebalancePlan, setRebalancePlan] = useState<any>(null);
  const [showActions, setShowActions] = useState(false);
  
  if (!agState || !portfolio) return null;

  const engine = new AntigravityEngine(DEFAULT_ANTIGRAVITY_CONFIG);
  const formattedStatus = engine.formatStatus(agState);

  const handleRebalance = async () => {
    setLoading(true);
    try {
      // 1. Calcola stato Antigravity
      const resState = await fetch('/api/antigravity/rebalance', { method: 'POST' });
      if (!resState.ok) throw new Error('Calcolo stato fallito');
      const stateData = await resState.json();

      // 2. Genera azioni concrete
      const resActions = await fetch('/api/antigravity/rebalance/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolio,
          agState: stateData.state,
          marketRegime: stateData.state.status === 'PROTECTION' ? 'Risk-Off' :
                        stateData.state.status === 'EXPANDED' ? 'Growth' : 'Goldilocks',
        }),
      });
      if (!resActions.ok) throw new Error('Generazione azioni fallita');
      const actionsData = await resActions.json();

      setRebalancePlan(actionsData.plan);
      setShowActions(true);

      // 3. Persisti come segnali (opzionale, per farli comparire in Segnali)
      if (actionsData.plan?.actions?.length > 0) {
        await fetch('/api/signals/rebalance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actions: actionsData.plan.actions }),
        }).catch(() => {});
      }

    } catch (err: any) {
      alert('❌ Errore rebalance: ' + (err.message || 'Errore sconosciuto'));
    } finally {
      setLoading(false);
    }
  };

  const statusColor = formattedStatus.color;

  return (
    <div style={{
      background: 'var(--bg2)',
      border: `1px solid ${statusColor}40`,
      borderLeft: `3px solid ${statusColor}`,
      borderRadius: '12px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 'bold', letterSpacing: '0.1em' }}>
            ⚖️ ANTIGRAVITY ENGINE V2
          </div>
          <div style={{ 
            fontSize: '18px', 
            fontWeight: 'bold', 
            color: statusColor,
            fontFamily: 'var(--font-mono)',
            marginTop: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {formattedStatus.emoji} {formattedStatus.title}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '6px', maxWidth: '350px', lineHeight: 1.4 }}>
            {formattedStatus.description}
          </div>
        </div>

        <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text3)' }}>
          <div>
            Drawdown: <b style={{ color: agState.currentDrawdownPct > 5 ? '#ef4444' : 'var(--text)' }}>
              {agState.currentDrawdownPct.toFixed(1)}%
            </b>
          </div>
          {agState.tbdInCooldown && agState.cooldownUntil && (
            <div style={{ marginTop: '4px', color: '#f59e0b', fontWeight: 'bold' }}>
              TBD Cooldown:<br/>{new Date(agState.cooldownUntil).toLocaleString('it-IT')}
            </div>
          )}
        </div>
      </div>
      
      {/* Target Allocation Bars */}
      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.05em' }}>TARGET ALLOCAZIONE RACCOMANDATA:</div>
        <div style={{ display: 'flex', gap: '2px', height: '12px', borderRadius: '4px', overflow: 'hidden' }}>
          {agState.coreTargetPct > 0 && <div style={{ width: `${agState.coreTargetPct}%`, background: '#10b981' }} title={`Core: ${agState.coreTargetPct}%`} />}
          {agState.satelliteTargetPct > 0 && <div style={{ width: `${agState.satelliteTargetPct}%`, background: '#f59e0b' }} title={`Satellite: ${agState.satelliteTargetPct}%`} />}
          {agState.tbdTargetPct > 0 && <div style={{ width: `${agState.tbdTargetPct}%`, background: '#8b5cf6' }} title={`TBD: ${agState.tbdTargetPct}%`} />}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: '#10b981' }}>Core: {agState.coreTargetPct}%</span>
          <span style={{ color: '#f59e0b' }}>Satellite: {agState.satelliteTargetPct}%</span>
          <span style={{ color: '#8b5cf6' }}>TBD: {agState.tbdTargetPct}%</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', width: '100%' }}>
        <button
          onClick={handleRebalance}
          disabled={loading}
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            border: `1px solid ${statusColor}`,
            background: `${statusColor}22`,
            color: statusColor,
            fontWeight: 'bold',
            fontFamily: 'var(--font-mono)',
            fontSize: '14px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            transition: 'all 0.2s',
            width: '100%',
            textAlign: 'center'
          }}
        >
          {loading ? 'CALCOLO IN CORSO...' : `RICALCOLA ED ESEGUI REBALANCE`}
        </button>
      </div>

      {/* PANNELLO AZIONI REBALANCE */}
      {showActions && rebalancePlan && rebalancePlan.actions.length > 0 && (
        <div style={{
          marginTop: '1.5rem',
          padding: '1.25rem',
          background: 'rgba(0, 212, 170, 0.05)',
          border: '1px solid var(--green, #00d4aa)',
          borderRadius: '12px',
        }}>
          <h4 style={{ margin: '0 0 1rem 0', color: 'var(--green, #00d4aa)', fontSize: '1.1rem' }}>
            🎯 Piano Operativo — {rebalancePlan.actions.length} azioni
          </h4>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1rem',
          }}>
            {rebalancePlan.actions.map((action: any) => (
              <div key={action.id} style={{
                padding: '1rem',
                background: action.type === 'BUY' ? 'rgba(0, 212, 170, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                border: `1px solid ${action.type === 'BUY' ? '#00d4aa' : '#ef4444'}`,
                borderRadius: '8px',
                fontSize: '0.85rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong style={{ fontSize: '1rem' }}>
                    {action.type === 'BUY' ? '🟢 COMPRA' : '🔴 VENDI'} {action.symbol}
                  </strong>
                  <span style={{
                    background: action.category === 'CORE' ? '#3b82f6' :
                               action.category === 'SATELLITE' ? '#f59e0b' : '#8b5cf6',
                    color: '#fff',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                  }}>
                    {action.category}
                  </span>
                </div>
                <div style={{ color: 'var(--text2)', marginBottom: '0.5rem' }}>
                  {action.name}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div>💶 <strong>€{action.amount.toFixed(0)}</strong></div>
                  <div>📊 <strong>{action.quantity} quote</strong> @ €{action.price.toFixed(2)}</div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text3)', marginBottom: '0.5rem' }}>
                  Quontest: {action.quontestScore}/100 | Regime: {action.regimeAlignment}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text2)', fontStyle: 'italic' }}>
                  {action.reason}
                </div>
                {action.stopLoss && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', display: 'flex', gap: '1rem' }}>
                    <span>SL: €{action.stopLoss.toFixed(2)}</span>
                    <span>TP: €{action.takeProfit.toFixed(2)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* RIEPILOGO */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1rem',
            padding: '1rem',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '8px',
            fontSize: '0.85rem',
          }}>
            <div>
              <div style={{ color: 'var(--text3)' }}>Vendite Totali</div>
              <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '1.1rem' }}>
                €{rebalancePlan.summary.totalSell.toFixed(0)}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text3)' }}>Acquisti Totali</div>
              <div style={{ color: '#00d4aa', fontWeight: 700, fontSize: '1.1rem' }}>
                €{rebalancePlan.summary.totalBuy.toFixed(0)}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text3)' }}>Cash Flow Netto</div>
              <div style={{
                color: rebalancePlan.summary.netCashFlow >= 0 ? '#00d4aa' : '#ef4444',
                fontWeight: 700, fontSize: '1.1rem'
              }}>
                €{rebalancePlan.summary.netCashFlow.toFixed(0)}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => {
                const text = rebalancePlan.actions.map((a: any) =>
                  `${a.type} ${a.symbol} — ${a.quantity} quote @ €${a.price.toFixed(2)} (${a.reason})`
                ).join('\n');
                navigator.clipboard.writeText(text);
                alert('📋 Piano copiato negli appunti! Incollalo su eToro/TradingView.');
              }}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: 'var(--green, #00d4aa)',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              📋 Copia per eToro
            </button>
            <button
              onClick={() => setShowActions(false)}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Chiudi
            </button>
          </div>
        </div>
      )}

      {/* Se non ci sono azioni */}
      {showActions && rebalancePlan && rebalancePlan.actions.length === 0 && (
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          background: 'rgba(0, 212, 170, 0.05)',
          borderRadius: '8px',
          textAlign: 'center',
          color: 'var(--text2)',
        }}>
          ✅ Il portafoglio è già allineato ai target Antigravity. Nessuna azione necessaria.
        </div>
      )}
    </div>
  );
}
