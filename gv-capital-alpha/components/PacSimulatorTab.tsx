'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PortfolioState, PacConfig, Position } from '@/types';
import AssetIcon from './AssetIcon';

interface Props {
  portfolio: PortfolioState | null;
}

// ─── PROJECTION MATH ─────────────────────────────────────────────────────────
function projectValue(
  initialValue: number,
  monthlyContribution: number,
  annualReturnPct: number,
  years: number
): number[] {
  const monthlyRate = annualReturnPct / 100 / 12;
  const points: number[] = [];
  let value = initialValue;
  for (let m = 0; m <= years * 12; m++) {
    if (m > 0) {
      value = value * (1 + monthlyRate) + monthlyContribution;
    }
    if (m % 12 === 0) points.push(value);
  }
  return points;
}

// ─── REBALANCING ALGORITHM ───────────────────────────────────────────────────
interface AssetAlloc {
  symbol: string;
  name: string;
  logoUrl?: string;
  currentValue: number;
  currentWeight: number;   // %
  targetWeight: number;    // %
  deficit: number;         // target - current (positive = underweight)
  monthlyAlloc: number;    // € allocated this month
  units: number;           // units to buy
  currentPrice: number;
  skip: boolean;
}

function computeAllocations(
  positions: Position[],
  monthlyBudget: number,
  targetWeights: Record<string, number> | undefined,
  signals: PortfolioState['signals']
): AssetAlloc[] {
  const openPositions = positions.filter(p => p.status === 'OPEN');

  // If no open positions, use pending signals as candidates (price = suggestedPrice)
  let candidates: { symbol: string; name: string; logoUrl?: string; value: number; currentPrice: number }[] = [];
  if (openPositions.length === 0) {
    const pending = signals.filter(s => s.status === 'PENDING' || s.status === 'APPROVED');
    candidates = pending.map(s => ({
      symbol: s.symbol,
      name: s.name,
      value: 0,
      currentPrice: s.suggestedPrice,
    }));
  } else {
    candidates = openPositions.map(p => ({
      symbol: p.symbol,
      name: p.name,
      logoUrl: p.logoUrl,
      value: p.capitalAllocated + (p.unrealizedPnl || 0),
      currentPrice: p.currentPrice ?? p.entryPrice,
    }));
  }

  if (candidates.length === 0) return [];

  const totalValue = candidates.reduce((s, c) => s + c.value, 0);
  const n = candidates.length;

  // Compute target weights — equal by default, custom if provided
  const getTarget = (symbol: string): number => {
    if (targetWeights && targetWeights[symbol] !== undefined) {
      return targetWeights[symbol];
    }
    return 100 / n;
  };

  const allocs: AssetAlloc[] = candidates.map(c => {
    const currentWeight = totalValue > 0 ? (c.value / totalValue) * 100 : 100 / n;
    const targetWeight = getTarget(c.symbol);
    const deficit = targetWeight - currentWeight;
    return {
      symbol: c.symbol,
      name: c.name,
      logoUrl: c.logoUrl,
      currentValue: c.value,
      currentWeight,
      targetWeight,
      deficit,
      monthlyAlloc: 0,
      units: 0,
      currentPrice: c.currentPrice,
      skip: deficit <= 0,
    };
  });

  // Distribute budget proportionally to positive deficits
  const underweight = allocs.filter(a => !a.skip);
  const totalDeficit = underweight.reduce((s, a) => s + a.deficit, 0);

  if (totalDeficit > 0) {
    underweight.forEach(a => {
      a.monthlyAlloc = (a.deficit / totalDeficit) * monthlyBudget;
      a.units = a.currentPrice > 0 ? a.monthlyAlloc / a.currentPrice : 0;
    });
  } else {
    // All equal — distribute uniformly
    allocs.forEach(a => {
      a.skip = false;
      a.monthlyAlloc = monthlyBudget / n;
      a.units = a.currentPrice > 0 ? a.monthlyAlloc / a.currentPrice : 0;
    });
  }

  return allocs.sort((a, b) => b.monthlyAlloc - a.monthlyAlloc);
}

// ─── MINI SPARKLINE for projection ───────────────────────────────────────────
function ProjectionChart({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 300;
  const h = 80;
  const pad = 8;
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (w - pad * 2));
  const ys = points.map(v => h - pad - ((v - min) / range) * (h - pad * 2));
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const fill = `${d} L${xs[xs.length - 1].toFixed(1)},${h} L${xs[0].toFixed(1)},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '80px' }}>
      <defs>
        <linearGradient id="pac-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#pac-grad)" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function PacSimulatorTab({ portfolio }: Props) {
  const [pacConfig, setPacConfig] = useState<PacConfig>({ portfolioMonthlyBudgets: {}, assetTargetWeights: {} });
  const [saving, setSaving] = useState(false);
  const [selectedPortfolio, setSelectedPortfolio] = useState<string | null>(null);
  const [editingWeights, setEditingWeights] = useState(false);
  const [tempWeights, setTempWeights] = useState<Record<string, string>>({});

  const customPortfolios = portfolio?.customPortfolios || ['Principale'];
  const allPortfolios = ['Tutti', ...customPortfolios];

  // Load PAC config
  useEffect(() => {
    fetch('/api/pac')
      .then(r => r.json())
      .then(d => { if (d.success) setPacConfig(d.data); })
      .catch(() => {});
  }, []);

  // Select first portfolio by default
  useEffect(() => {
    if (!selectedPortfolio && customPortfolios.length > 0) {
      setSelectedPortfolio(customPortfolios[0]);
    }
  }, [customPortfolios]);

  const saveBudget = useCallback(async (portfolioName: string, amount: number) => {
    setSaving(true);
    const newConfig = {
      ...pacConfig,
      portfolioMonthlyBudgets: { ...pacConfig.portfolioMonthlyBudgets, [portfolioName]: amount },
    };
    setPacConfig(newConfig);
    await fetch('/api/pac', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'save_all', config: newConfig }),
    });
    setSaving(false);
  }, [pacConfig]);

  const saveWeights = useCallback(async (portfolioName: string, weights: Record<string, string>) => {
    const parsed: Record<string, number> = {};
    Object.entries(weights).forEach(([sym, v]) => {
      const n = parseFloat(v);
      if (!isNaN(n)) parsed[sym] = n;
    });
    const newConfig = {
      ...pacConfig,
      assetTargetWeights: { ...(pacConfig.assetTargetWeights || {}), [portfolioName]: parsed },
    };
    setPacConfig(newConfig);
    await fetch('/api/pac', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'save_all', config: newConfig }),
    });
    setEditingWeights(false);
  }, [pacConfig]);

  const totalMonthlyBudget = Object.values(pacConfig.portfolioMonthlyBudgets).reduce((s, v) => s + v, 0);

  // Per-portfolio positions
  const getPortfolioPositions = (pName: string) => {
    if (!portfolio) return [];
    if (pName === 'Tutti') return portfolio.positions.filter(p => p.status === 'OPEN');
    return portfolio.positions.filter(p => p.status === 'OPEN' && p.portfolio === pName);
  };

  const currentPortfolioPositions = selectedPortfolio ? getPortfolioPositions(selectedPortfolio) : [];
  const currentBudget = selectedPortfolio ? (pacConfig.portfolioMonthlyBudgets[selectedPortfolio] || 0) : 0;
  const currentWeights = selectedPortfolio ? pacConfig.assetTargetWeights?.[selectedPortfolio] : undefined;
  const allocations = useMemo(() =>
    selectedPortfolio
      ? computeAllocations(currentPortfolioPositions, currentBudget, currentWeights, portfolio?.signals || [])
      : [],
    [currentPortfolioPositions, currentBudget, currentWeights, portfolio?.signals]
  );

  // Projection
  const currentPortfolioValue = currentPortfolioPositions.reduce(
    (s, p) => s + p.capitalAllocated + (p.unrealizedPnl || 0), 0
  );
  const targetReturn = portfolio?.targets?.[selectedPortfolio || ''] ?? portfolio?.targetAnnualReturn ?? 0.1;
  const projectionPoints10y = useMemo(() =>
    projectValue(currentPortfolioValue, currentBudget, targetReturn * 100, 10),
    [currentPortfolioValue, currentBudget, targetReturn]
  );
  const proj1y = projectionPoints10y[1] ?? currentPortfolioValue;
  const proj5y = projectionPoints10y[5] ?? currentPortfolioValue;
  const proj10y = projectionPoints10y[10] ?? currentPortfolioValue;

  const fmt = (v: number) => `€${v.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── HEADER KPI ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>PAC TOTALE/MESE</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: '700', color: 'var(--blue)' }}>
            {fmt(totalMonthlyBudget)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '4px' }}>{saving ? '💾 Salvataggio...' : 'in tutti i portafogli'}</div>
        </div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>INVESTITO IN 1 ANNO</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: '700', color: 'var(--text)' }}>
            {fmt(totalMonthlyBudget * 12)}
          </div>
        </div>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>PORTAFOGLIO SELEZIONATO</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: '700', color: 'var(--green)' }}>
            {selectedPortfolio || '—'}
          </div>
        </div>
      </div>

      {/* ── PORTFOLIO SELECTOR + BUDGET INPUTS ── */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '14px' }}>
          BUDGET MENSILE PER PORTAFOGLIO
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
          {customPortfolios.map(pName => {
            const budget = pacConfig.portfolioMonthlyBudgets[pName] || 0;
            const isSelected = selectedPortfolio === pName;
            return (
              <div
                key={pName}
                onClick={() => setSelectedPortfolio(pName)}
                style={{
                  background: isSelected ? 'rgba(59,130,246,0.1)' : 'var(--bg)',
                  border: `1px solid ${isSelected ? 'var(--blue)' : 'var(--border)'}`,
                  borderRadius: '12px', padding: '14px', cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '12px', color: isSelected ? 'var(--blue)' : 'var(--text)', marginBottom: '10px' }}>
                  {pName.toUpperCase()}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>€</span>
                  <input
                    type="number"
                    value={budget || ''}
                    placeholder="0"
                    onClick={e => e.stopPropagation()}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      setPacConfig(prev => ({
                        ...prev,
                        portfolioMonthlyBudgets: { ...prev.portfolioMonthlyBudgets, [pName]: val },
                      }));
                    }}
                    onBlur={e => saveBudget(pName, parseFloat(e.target.value) || 0)}
                    style={{
                      background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)',
                      fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: '700',
                      borderRadius: '8px', padding: '6px 10px', width: '100%', outline: 'none',
                    }}
                    min="0"
                  />
                  <span style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>/mese</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── ALLOCATION TABLE ── */}
      {selectedPortfolio && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)' }}>
              PIANO ACQUISTI — {selectedPortfolio.toUpperCase()} ({fmt(currentBudget)}/mese)
            </div>
            <button
              onClick={() => {
                setEditingWeights(!editingWeights);
                const tw: Record<string, string> = {};
                allocations.forEach(a => {
                  tw[a.symbol] = (currentWeights?.[a.symbol] ?? a.targetWeight).toFixed(1);
                });
                setTempWeights(tw);
              }}
              style={{
                background: editingWeights ? 'rgba(132,204,22,0.15)' : 'var(--bg)',
                border: `1px solid ${editingWeights ? 'var(--green)' : 'var(--border)'}`,
                color: editingWeights ? 'var(--green)' : 'var(--text3)',
                fontFamily: 'var(--font-mono)', fontSize: '10px', borderRadius: '8px',
                padding: '6px 12px', cursor: 'pointer',
              }}
            >
              {editingWeights ? '✓ Salva Pesi' : '⚙ Pesi Target'}
            </button>
          </div>

          {editingWeights && (
            <div style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
              <div style={{ fontSize: '10px', color: 'var(--blue)', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>
                Imposta pesi target personalizzati (%). Lascia vuoto per uguale (1/N).
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                {allocations.map(a => (
                  <div key={a.symbol} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '700', minWidth: '50px' }}>{a.symbol}</span>
                    <input
                      type="number"
                      value={tempWeights[a.symbol] ?? ''}
                      placeholder={`${(100 / allocations.length).toFixed(1)}`}
                      onChange={e => setTempWeights(prev => ({ ...prev, [a.symbol]: e.target.value }))}
                      style={{
                        background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)',
                        fontFamily: 'var(--font-mono)', fontSize: '12px', borderRadius: '6px',
                        padding: '4px 8px', width: '70px', outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: '10px', color: 'var(--text3)' }}>%</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  onClick={() => saveWeights(selectedPortfolio, tempWeights)}
                  style={{ background: 'var(--green)', color: '#000', fontFamily: 'var(--font-mono)', fontSize: '10px', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontWeight: '700' }}
                >
                  SALVA
                </button>
                <button
                  onClick={async () => {
                    const newConfig = {
                      ...pacConfig,
                      assetTargetWeights: { ...(pacConfig.assetTargetWeights || {}) },
                    };
                    delete newConfig.assetTargetWeights![selectedPortfolio];
                    setPacConfig(newConfig);
                    await fetch('/api/pac', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'save_all', config: newConfig }) });
                    setEditingWeights(false);
                  }}
                  style={{ background: 'var(--bg)', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '10px', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer' }}
                >
                  RESET UGUALE
                </button>
              </div>
            </div>
          )}

          {allocations.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '12px', padding: '24px' }}>
              {currentBudget === 0
                ? '⚠️ Imposta un budget mensile per questo portafoglio.'
                : '📭 Nessuna posizione aperta e nessun segnale pendente in questo portafoglio.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                <thead>
                  <tr style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 8px', fontWeight: 'normal' }}>ASSET</th>
                    <th style={{ padding: '10px 8px', fontWeight: 'normal', textAlign: 'right' }}>PESO ATT.</th>
                    <th style={{ padding: '10px 8px', fontWeight: 'normal', textAlign: 'right' }}>TARGET</th>
                    <th style={{ padding: '10px 8px', fontWeight: 'normal', textAlign: 'right' }}>DEFICIT</th>
                    <th style={{ padding: '10px 8px', fontWeight: 'normal', textAlign: 'right' }}>€ MESE</th>
                    <th style={{ padding: '10px 8px', fontWeight: 'normal', textAlign: 'right' }}>UNITÀ</th>
                    <th style={{ padding: '10px 8px', fontWeight: 'normal', textAlign: 'right' }}>PREZZO</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map(a => (
                    <tr key={a.symbol} style={{ borderBottom: '1px solid var(--bg3)', opacity: a.skip ? 0.45 : 1 }}>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <AssetIcon symbol={a.symbol} logoUrl={a.logoUrl} size={32} />
                          <div>
                            <div style={{ fontWeight: '700', color: 'var(--text)' }}>{a.symbol}</div>
                            <div style={{ fontSize: '9px', color: 'var(--text3)' }}>{a.name}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text2)' }}>{a.currentWeight.toFixed(1)}%</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--blue)' }}>{a.targetWeight.toFixed(1)}%</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: a.deficit > 0 ? 'var(--green)' : 'var(--red)' }}>
                        {a.deficit > 0 ? '+' : ''}{a.deficit.toFixed(1)}%
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '700', color: a.skip ? 'var(--text3)' : 'var(--text)' }}>
                        {a.skip ? '—' : fmt(a.monthlyAlloc)}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: a.skip ? 'var(--text3)' : 'var(--green)' }}>
                        {a.skip ? 'skip' : `${a.units.toFixed(a.units < 1 ? 4 : 2)} u.`}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text2)' }}>
                        €{a.currentPrice.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ETORO ACTION LIST ── */}
      {selectedPortfolio && allocations.filter(a => !a.skip && a.monthlyAlloc > 0).length > 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid rgba(132,204,22,0.3)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--green)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '14px' }}>
            📋 OPERAZIONI DA ESEGUIRE SU ETORO — {selectedPortfolio.toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {allocations.filter(a => !a.skip && a.monthlyAlloc > 0).map(a => (
              <div key={a.symbol} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(132,204,22,0.06)', border: '1px solid rgba(132,204,22,0.15)',
                borderRadius: '10px', padding: '12px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '14px' }}>✅</span>
                  <AssetIcon symbol={a.symbol} logoUrl={a.logoUrl} size={28} />
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', fontSize: '13px', color: 'var(--green)' }}>
                      BUY {a.units.toFixed(a.units < 1 ? 4 : 2)} × {a.symbol}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text3)' }}>
                      @ ~€{a.currentPrice.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '15px', color: 'var(--text)' }}>
                    {fmt(a.monthlyAlloc)}
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text3)' }}>da allocare</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
            <span style={{ color: 'var(--text3)' }}>TOTALE DA INVESTIRE</span>
            <span style={{ fontWeight: '700', color: 'var(--text)', fontSize: '16px' }}>{fmt(currentBudget)}</span>
          </div>
        </div>
      )}

      {/* ── PROJECTION CHART ── */}
      {selectedPortfolio && currentBudget > 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
            📈 PROIEZIONE — {selectedPortfolio.toUpperCase()} @ {(targetReturn * 100).toFixed(0)}% TARGET ANNUALE
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginBottom: '14px' }}>
            Valore attuale {fmt(currentPortfolioValue)} + {fmt(currentBudget)}/mese
          </div>

          {/* Projection KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
            {[
              { label: 'OGGI', value: currentPortfolioValue },
              { label: '1 ANNO', value: proj1y },
              { label: '5 ANNI', value: proj5y },
              { label: '10 ANNI', value: proj10y },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--bg)', borderRadius: '10px', padding: '10px', border: '1px solid var(--bg3)', textAlign: 'center' }}>
                <div style={{ fontSize: '9px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '13px', color: label === 'OGGI' ? 'var(--text)' : 'var(--green)' }}>
                  {fmt(value)}
                </div>
              </div>
            ))}
          </div>

          <ProjectionChart points={projectionPoints10y} color="#84cc16" />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
            <span>Oggi</span>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(y => <span key={y}>{y}a</span>)}
          </div>

          <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(59,130,246,0.07)', borderRadius: '8px', fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
            ℹ️ Proiezione basata su compound interest mensile al {(targetReturn * 100).toFixed(0)}% annuo.
            Non tiene conto di tasse, commissioni eToro, volatilità o eventi straordinari.
          </div>
        </div>
      )}
    </div>
  );
}
