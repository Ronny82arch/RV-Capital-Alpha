'use client';

import React, { useState, useMemo } from 'react';
import { PortfolioState, MarketData } from '@/types';
import { isAheadOfTarget, getAggression } from '@/lib/kelly';
import ProfessionalChart from './ProfessionalChart';
import { Globe, ShieldCheck, Rocket, Baby, Bitcoin, TrendingUp, BarChart3, Briefcase, Eye, EyeOff, Sun, Moon } from 'lucide-react';

interface Props { portfolio: PortfolioState | null; market: MarketData[]; }

function getTagIcon(tag: string) {
  const t = tag.toLowerCase();
  if (t === 'tutti') return <Globe size={48} strokeWidth={1.5} color="var(--blue)" />;
  if (t.includes('core')) return <ShieldCheck size={48} strokeWidth={1.5} color="var(--green)" />;
  if (t.includes('satellite') || t.includes('satelite')) return <Rocket size={48} strokeWidth={1.5} color="#f59e0b" />;
  if (t.includes('pac') || t.includes('figli') || t.includes('ginevra') || t.includes('sofia')) return <Baby size={48} strokeWidth={1.5} color="#ec4899" />;
  if (t.includes('cripto') || t.includes('crypto')) return <Bitcoin size={48} strokeWidth={1.5} color="#f59e0b" />;
  if (t.includes('azion')) return <TrendingUp size={48} strokeWidth={1.5} color="var(--blue)" />;
  if (t.includes('fond') || t.includes('etf')) return <BarChart3 size={48} strokeWidth={1.5} color="#8b5cf6" />;
  return <Briefcase size={48} strokeWidth={1.5} color="var(--text2)" />;
}

export default function DashboardTab({ portfolio, market }: Props) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [expandedPosId, setExpandedPosId] = useState<string | null>(null);
  const [isObscured, setIsObscured] = useState(false);
  const [isLight, setIsLight] = useState(false);

  const toggleTheme = () => {
    const newLight = !isLight;
    setIsLight(newLight);
    if (newLight) document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
  };

  if (!portfolio) return <div />;

  const p = portfolio;
  const target = p.targetAnnualReturn * 100;
  const targetEur = p.capitalBase * p.targetAnnualReturn;

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    p.positions.forEach(pos => {
      pos.tags?.forEach(t => tags.add(t));
    });
    return ['Tutti', ...Array.from(tags).sort()];
  }, [p.positions]);

  if (selectedTag === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '20px', position: 'relative' }}>
        {/* ACTION BUTTONS (TOP RIGHT) */}
        <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => setIsObscured(!isObscured)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', transition: 'all 0.2s' }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.borderColor = 'var(--blue)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg2)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            title="Nascondi importi"
          >
            {isObscured ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
          <button 
            onClick={toggleTheme}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', transition: 'all 0.2s' }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.borderColor = 'var(--yellow)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg2)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            title="Cambia tema"
          >
            {isLight ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>

        <div style={{ fontSize: '22px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--text)', marginBottom: '32px', textAlign: 'center' }}>
          Seleziona il Portafoglio
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '20px', width: '100%', maxWidth: '700px' }}>
          {allTags.map(tag => {
            let pnlPct = 0;
            let val = 0;

            if (tag === 'Tutti') {
              pnlPct = p.totalPnLPercent;
              val = p.totalValue;
            } else {
              const tagPos = p.positions.filter(pos => pos.tags?.includes(tag));
              const openTagPos = tagPos.filter(pos => pos.status === 'OPEN');
              const closedTagPos = tagPos.filter(pos => pos.status === 'CLOSED');
              
              const unrealized = openTagPos.reduce((acc, pos) => acc + (pos.unrealizedPnl || 0), 0);
              const realized = closedTagPos.reduce((acc, pos) => acc + (pos.realizedPnl || 0), 0);
              const totalPnL = unrealized + realized;
              const invested = openTagPos.reduce((acc, pos) => acc + (pos.entryPrice * pos.quantity), 0) + closedTagPos.reduce((acc, pos) => acc + (pos.entryPrice * pos.quantity), 0);
              
              pnlPct = invested > 0 ? (totalPnL / invested) * 100 : 0;
              val = openTagPos.reduce((acc, pos) => acc + ((pos.currentPrice || pos.entryPrice) * pos.quantity), 0);
            }

            const isPositive = pnlPct >= 0;
            const pnlColor = isPositive ? 'var(--green)' : 'var(--red)';

            return (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '32px 16px', background: 'var(--bg2)', border: '1px solid var(--border)',
                  borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.borderColor = 'var(--blue)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <span style={{ fontSize: '48px', marginBottom: '16px' }}>{getTagIcon(tag)}</span>
                <span style={{ fontSize: '15px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--text)' }}>
                  {tag === 'Tutti' ? 'Globale' : tag}
                </span>
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'var(--bg)', padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--bg3)' }}>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: pnlColor, fontFamily: 'var(--font-mono)' }}>
                    {isPositive ? '+' : ''}{pnlPct.toFixed(2)}%
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                    €{val.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
            PATRIMONIO COMPLESSIVO
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
            {isObscured ? '€ *****' : `€${p.totalValue.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: isObscured ? 'var(--text3)' : (p.totalPnL >= 0 ? 'var(--green)' : 'var(--red)') }}>
            {isObscured ? '*****' : (
              <>{p.totalPnL >= 0 ? 'Profitti totali: +' : 'Perdite totali: '}€{p.totalPnL.toFixed(0)} ({p.totalPnLPercent >= 0 ? '+' : ''}{p.totalPnLPercent.toFixed(2)}%)</>
            )}
          </div>
        </div>
      </div>
    );
  }

  const filteredPositions = selectedTag === 'Tutti'
    ? p.positions
    : p.positions.filter(pos => pos.tags?.includes(selectedTag));

  const openPositions = filteredPositions.filter(pos => pos.status === 'OPEN');
  const closedPositions = filteredPositions.filter(pos => pos.status === 'CLOSED');

  let displayTotalValue = p.totalValue;
  let displayPnL = p.totalPnL;
  let displayPnLPct = p.totalPnLPercent;

  if (selectedTag !== 'Tutti') {
    displayTotalValue = openPositions.reduce((acc, pos) => acc + ((pos.currentPrice || pos.entryPrice) * pos.quantity), 0);
    const unrealized = openPositions.reduce((acc, pos) => acc + (pos.unrealizedPnl || 0), 0);
    const realized = closedPositions.reduce((acc, pos) => acc + (pos.realizedPnl || 0), 0);
    displayPnL = unrealized + realized;
    const invested = openPositions.reduce((acc, pos) => acc + (pos.entryPrice * pos.quantity), 0) + closedPositions.reduce((acc, pos) => acc + (pos.entryPrice * pos.quantity), 0);
    displayPnLPct = invested > 0 ? (displayPnL / invested) * 100 : 0;
  }

  const progressPct = Math.min(100, (p.totalPnL / targetEur) * 100);
  const ahead = isAheadOfTarget(p.totalPnLPercent, target, p.startDate);
  const aggression = getAggression(p.totalPnLPercent, target, p.startDate);

  const winRate = closedPositions.length > 0
    ? (closedPositions.filter(pos => (pos.realizedPnl ?? 0) > 0).length / closedPositions.length * 100)
    : null;

  const aggrColor = aggression === 'AGGRESSIVE' ? '#ef4444' : aggression === 'CONSERVATIVE' ? '#00d4aa' : '#f59e0b';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* PORTFOLIO SELECTOR */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        <button
          onClick={() => setSelectedTag(null)}
          style={{
            padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--border)',
            background: 'var(--bg2)', color: 'var(--text2)', fontSize: '12px', fontFamily: 'var(--font-mono)',
            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '4px'
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg3)'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg2)'; }}
        >
          ⬅️ Menu
        </button>
        {allTags.map(tag => (
          <button
            key={tag}
            onClick={() => setSelectedTag(tag)}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              border: `1px solid ${selectedTag === tag ? 'var(--blue)' : 'var(--border)'}`,
              background: selectedTag === tag ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg2)',
              color: selectedTag === tag ? 'var(--blue)' : 'var(--text2)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            {tag === 'Tutti' ? '🌍 Globale' : tag}
          </button>
        ))}
      </div>

      {/* TOP KPI ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <KpiCard
          label={selectedTag === 'Tutti' ? "VALORE PORTAFOGLIO" : `VALORE: ${selectedTag.toUpperCase()}`}
          value={`€${displayTotalValue.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          sub={selectedTag === 'Tutti' ? `base €${p.capitalBase.toLocaleString('it-IT', { maximumFractionDigits: 0 })}` : 'valore posizioni attuali'}
          color="var(--text)"
        />
        <KpiCard
          label="P&L TOTALE"
          value={`${displayPnL >= 0 ? '+' : ''}€${displayPnL.toFixed(0)}`}
          sub={`${displayPnLPct >= 0 ? '+' : ''}${displayPnLPct.toFixed(2)}%`}
          color={displayPnL >= 0 ? 'var(--green)' : 'var(--red)'}
        />
        {selectedTag !== 'Tutti' && (
          <KpiCard
            label="PESO SUL GLOBALE"
            value={`${((displayTotalValue / Math.max(1, p.totalValue)) * 100).toFixed(1)}%`}
            sub="del portafoglio complessivo"
            color="var(--blue)"
          />
        )}
        <KpiCard
          label="LIQUIDITÀ DISPONIBILE"
          value={`€${p.capitalAvailable.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`}
          sub={`${((p.capitalAvailable / p.capitalBase) * 100).toFixed(0)}% del capitale`}
          color="var(--blue)"
        />
        <KpiCard
          label="TARGET ANNUO"
          value={`+${target.toFixed(0)}%`}
          sub={`€${targetEur.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`}
          color="var(--yellow)"
        />
      </div>

      {/* PROGRESS BAR */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)' }}>PROGRESSO OBIETTIVO +25%</span>
          <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: ahead ? 'var(--green)' : 'var(--yellow)', fontWeight: '700' }}>
            {progressPct.toFixed(1)}%
          </span>
        </div>
        <div style={{ height: '8px', background: 'var(--bg3)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progressPct}%`,
            background: `linear-gradient(90deg, #00d4aa, #3b82f6)`,
            borderRadius: '4px', transition: 'width 1s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px', color: 'var(--text3)' }}>
          <span>{ahead ? '🟢 In anticipo sul target' : '🟡 Da recuperare'}</span>
          <span style={{ color: aggrColor }}>Modalità: <b>{aggression}</b></span>
        </div>
      </div>

      {/* ALLOCATION WIDGETS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        {/* ASSET ALLOCATION (MACRO-CATEGORIE) */}
        {openPositions.length > 0 && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '12px' }}>ALLOCAZIONE PER CATEGORIA</div>
            <AssetAllocationChart positions={openPositions} />
          </div>
        )}

        {/* RELAZIONE CORE / SATELLITE (GLOBALE) */}
        {(selectedTag === 'Tutti' || selectedTag === 'Core' || selectedTag === 'Satellite') && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '12px' }}>RAPPORTO CORE / SATELLITE</div>
            <CoreSatelliteWidget positions={p.positions} />
          </div>
        )}
      </div>

      {/* PROFESSIONAL CHART (Dinamico per Portafoglio) */}
      <ProfessionalChart 
        currentValue={displayTotalValue} 
        label={selectedTag || 'Tutti i portafogli'} 
      />

      {/* STATS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        <StatCard label="POSIZIONI APERTE" value={String(openPositions.length)} />
        <StatCard label="TRADE CHIUSI" value={String(closedPositions.length)} />
        <StatCard label="WIN RATE" value={winRate !== null ? `${winRate.toFixed(0)}%` : '—'} color={winRate !== null && winRate >= 50 ? 'var(--green)' : 'var(--red)'} />
      </div>

      {/* OPEN POSITIONS TABLE */}
      {openPositions.length > 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '12px' }}>POSIZIONI APERTE</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 8px', fontWeight: 'normal' }}>ASSET</th>
                  <th style={{ padding: '12px 8px', fontWeight: 'normal' }}>CATEGORIA</th>
                  <th style={{ padding: '12px 8px', fontWeight: 'normal', textAlign: 'right' }}>VALORE ALLOCATO</th>
                  <th style={{ padding: '12px 8px', fontWeight: 'normal', textAlign: 'right' }}>VALORE ATTUALE</th>
                  <th style={{ padding: '12px 8px', fontWeight: 'normal', textAlign: 'right' }}>PESO %</th>
                  <th style={{ padding: '12px 8px', fontWeight: 'normal', textAlign: 'right' }}>P&L</th>
                </tr>
              </thead>
              <tbody>
                {openPositions.map(pos => {
                  const pnl = pos.unrealizedPnl ?? 0;
                  const pnlPct = pos.unrealizedPnlPercent ?? 0;
                  const allocated = pos.capitalAllocated ?? (pos.entryPrice * pos.quantity);
                  const currentVal = (pos.currentPrice ?? pos.entryPrice) * pos.quantity;
                  const weight = displayTotalValue > 0 ? (currentVal / displayTotalValue) * 100 : 0;
                  const isExpanded = expandedPosId === pos.id;

                  return (
                    <React.Fragment key={pos.id}>
                      <tr 
                        onClick={() => setExpandedPosId(isExpanded ? null : pos.id)}
                        style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--bg3)', cursor: 'pointer', transition: 'background 0.2s' }}
                        onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg3)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td style={{ padding: '12px 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text3)' }}>{isExpanded ? '▼' : '▶'}</span>
                            <div>
                              <div style={{ fontWeight: '700', color: 'var(--text)', fontSize: '13px' }}>{pos.symbol}</div>
                              <div style={{ fontSize: '10px', color: 'var(--text3)' }}>{pos.name}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text2)' }}>
                          <span style={{ padding: '4px 8px', background: 'var(--bg3)', borderRadius: '12px', fontSize: '10px' }}>
                            {getMacroCategory(pos)}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          <div style={{ color: 'var(--text2)' }}>
                            €{allocated.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          <div style={{ fontWeight: 'bold', color: 'var(--text)' }}>
                            €{currentVal.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                            <span style={{ color: 'var(--text2)', width: '35px' }}>{weight.toFixed(1)}%</span>
                            <div style={{ width: '40px', height: '6px', background: 'var(--bg3)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(100, weight)}%`, height: '100%', background: 'var(--blue)', borderRadius: '3px' }} />
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          <div style={{ fontWeight: '700', fontSize: '13px', color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {pnl >= 0 ? '+' : ''}€{pnl.toFixed(0)}
                          </div>
                          <div style={{ fontSize: '10px', color: pnlPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ borderBottom: '1px solid var(--bg3)', background: 'rgba(0,0,0,0.1)' }}>
                          <td colSpan={6} style={{ padding: '16px', borderLeft: '2px solid var(--blue)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '8px', letterSpacing: '0.1em' }}>STORICO OPERAZIONI</div>
                            <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', background: 'var(--bg2)', borderRadius: '8px', overflow: 'hidden' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text2)', background: 'var(--bg)' }}>
                                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 'normal' }}>DATA</th>
                                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 'normal' }}>AZIONE</th>
                                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 'normal' }}>QUANTITÀ</th>
                                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 'normal' }}>PREZZO</th>
                                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 'normal' }}>TOTALE</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td style={{ padding: '8px 12px' }}>{new Date(pos.entryDate).toLocaleDateString('it-IT')}</td>
                                  <td style={{ padding: '8px 12px', color: pos.action === 'BUY' ? 'var(--green)' : 'var(--red)', fontWeight: 'bold' }}>{pos.action}</td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{pos.quantity.toLocaleString('it-IT', { maximumFractionDigits: 4 })}</td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>€{pos.entryPrice.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold' }}>€{allocated.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
      <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: '700', fontFamily: 'var(--font-mono)', color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '6px' }}>{sub}</div>
    </div>
  );
}

function StatCard({ label, value, color = 'var(--text)' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
      <div style={{ fontSize: '9px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: '700', fontFamily: 'var(--font-mono)', color }}>{value}</div>
    </div>
  );
}

function EquityChart({ history, capitalBase }: { history: { date: string; totalValue: number; pnlPercent: number }[]; capitalBase: number }) {
  const vals = history.map(h => h.totalValue);
  const min = Math.min(...vals, capitalBase);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const W = 600; const H = 80; const pad = 8;

  const points = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  const isUp = vals[vals.length - 1] >= capitalBase;
  const color = isUp ? '#00d4aa' : '#ef4444';

  // Baseline (capital base)
  const baselineY = H - pad - ((capitalBase - min) / range) * (H - pad * 2);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '80px' }}>
        <line x1={pad} y1={baselineY} x2={W - pad} y2={baselineY} stroke="#1e2d47" strokeWidth="1" strokeDasharray="4,4" />
        <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
        {vals.length > 0 && (
          <circle cx={pad + ((vals.length - 1) / (vals.length - 1)) * (W - pad * 2)} cy={H - pad - ((vals[vals.length - 1] - min) / range) * (H - pad * 2)} r="3" fill={color} />
        )}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text3)', marginTop: '4px' }}>
        <span>{history[0]?.date}</span>
        <span style={{ color }}>{history[history.length - 1]?.pnlPercent >= 0 ? '+' : ''}{history[history.length - 1]?.pnlPercent.toFixed(2)}%</span>
        <span>{history[history.length - 1]?.date}</span>
      </div>
    </div>
  );
}

function Empty() {
  return <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px', fontFamily: 'var(--font-mono)' }}>Caricamento dati...</div>;
}

function getMacroCategory(pos: import('@/types').Position): string {
  // If it's a specific symbol that represents commodities (like Gold)
  if (pos.symbol === 'GLD' || pos.symbol === 'IAU') return 'MATERIE PRIME';

  if (pos.type === 'CRYPTO') return 'CRYPTO';
  if (pos.type === 'ETF') return 'FONDI / ETF';
  if (pos.type === 'STOCK') return 'AZIONI';
  
  return 'ALTRO';
}

function AssetAllocationChart({ positions }: { positions: import('@/types').Position[] }) {
  const categories = positions.reduce((acc, pos) => {
    const type = getMacroCategory(pos);
    const val = (pos.currentPrice ?? pos.entryPrice) * pos.quantity;
    acc[type] = (acc[type] || 0) + val;
    return acc;
  }, {} as Record<string, number>);

  const totalValue = Object.values(categories).reduce((sum, val) => sum + val, 0);

  const colors: Record<string, string> = {
    'CRYPTO': '#f59e0b',
    'AZIONI': '#3b82f6',
    'FONDI / ETF': '#00d4aa',
    'MATERIE PRIME': '#eab308',
    'ALTRO': '#94a3b8'
  };

  if (totalValue === 0) return null;

  return (
    <div>
      <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px' }}>
        {Object.entries(categories).map(([cat, val]) => {
          const pct = (val / totalValue) * 100;
          return (
            <div key={cat} style={{ width: `${pct}%`, background: colors[cat] || colors['ALTRO'], transition: 'width 0.5s' }} title={`${cat}: ${pct.toFixed(1)}%`} />
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {Object.entries(categories).map(([cat, val]) => {
          const pct = (val / totalValue) * 100;
          return (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors[cat] || colors['ALTRO'] }} />
              <span style={{ color: 'var(--text2)' }}>{cat}</span>
              <span style={{ fontWeight: 'bold' }}>{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CoreSatelliteWidget({ positions }: { positions: import('@/types').Position[] }) {
  const openPos = positions.filter(p => p.status === 'OPEN');
  
  const coreValue = openPos
    .filter(p => p.tags?.some(t => t.toLowerCase() === 'core'))
    .reduce((sum, p) => sum + ((p.currentPrice ?? p.entryPrice) * p.quantity), 0);

  const satValue = openPos
    .filter(p => p.tags?.some(t => t.toLowerCase() === 'satellite'))
    .reduce((sum, p) => sum + ((p.currentPrice ?? p.entryPrice) * p.quantity), 0);

  const total = coreValue + satValue;
  if (total === 0) return <div style={{ color: 'var(--text3)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>Nessun asset Core/Satellite attivo.</div>;

  const corePct = (coreValue / total) * 100;
  const satPct = (satValue / total) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', height: '16px', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ width: `${corePct}%`, background: 'var(--green)', transition: 'width 0.5s' }} title={`Core: ${corePct.toFixed(1)}%`} />
        <div style={{ width: `${satPct}%`, background: '#f59e0b', transition: 'width 0.5s' }} title={`Satellite: ${satPct.toFixed(1)}%`} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--green)' }} />
          <span style={{ color: 'var(--text2)' }}>Core</span>
          <span style={{ fontWeight: 'bold', color: 'var(--text)' }}>{corePct.toFixed(1)}%</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontWeight: 'bold', color: 'var(--text)' }}>{satPct.toFixed(1)}%</span>
          <span style={{ color: 'var(--text2)' }}>Satellite</span>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
        </div>
      </div>
      <div style={{ fontSize: '10px', color: 'var(--text3)', textAlign: 'center', marginTop: '4px' }}>
        Totale allocato: €{total.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
      </div>
    </div>
  );
}
