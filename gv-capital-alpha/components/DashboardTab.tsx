'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { PortfolioState, MarketData, Position } from '@/types';
import { isAheadOfTarget } from '@/lib/kelly';
import { Tab } from '@/app/page';
import dynamicImport from 'next/dynamic';
const ProfessionalChart = dynamicImport(() => import('./ProfessionalChart'), { ssr: false });
import AssetIcon from './AssetIcon';
import PacScenarioWidget from './PacScenarioWidget';
import AntigravityMonitor from './AntigravityMonitor';
import { AntigravityEngine, DEFAULT_ANTIGRAVITY_CONFIG } from '@/lib/antigravity-engine';
import { Globe, ShieldCheck, Rocket, Baby, Bitcoin, TrendingUp, BarChart3, Briefcase, Eye, EyeOff, Sun, Moon, PieChart, Layers, Scale, FolderPlus, Settings } from 'lucide-react';

interface Props { 
  portfolio: PortfolioState | null; 
  market: MarketData[]; 
  setTab?: (t: Tab) => void; 
  tbdData?: any; 
  onUpdatePortfolios?: (customPortfolios: string[]) => Promise<boolean>;
  onAssignPortfolio?: (positionId: string, portfolioName: string) => Promise<boolean>;
  onUpdateCapitalBase?: (base: number) => Promise<boolean>;
  onUpdateDepositedFunds?: (funds: number) => Promise<boolean>;
  onToggleCopyTrading?: (exclude: boolean) => Promise<boolean>;
}

function getTagIcon(tag: string) {
  const t = tag.toLowerCase();
  if (t === 'tutti') return <Globe size={48} strokeWidth={1.5} color="var(--blue)" />;
  if (t === 'da assegnare') return <Briefcase size={48} strokeWidth={1.5} color="var(--red)" />;
  if (t.includes('core')) return <ShieldCheck size={48} strokeWidth={1.5} color="var(--green)" />;
  if (t.includes('satellite') || t.includes('satelite')) return <Rocket size={48} strokeWidth={1.5} color="#f59e0b" />;
  if (t.includes('pac') || t.includes('figli') || t.includes('ginevra') || t.includes('sofia')) return <Baby size={48} strokeWidth={1.5} color="#ec4899" />;
  if (t.includes('cripto') || t.includes('crypto')) return <Bitcoin size={48} strokeWidth={1.5} color="#f59e0b" />;
  if (t.includes('azion')) return <TrendingUp size={48} strokeWidth={1.5} color="var(--blue)" />;
  if (t.includes('fond') || t.includes('etf')) return <BarChart3 size={48} strokeWidth={1.5} color="#8b5cf6" />;
  return <Briefcase size={48} strokeWidth={1.5} color="var(--text2)" />;
}

export default function DashboardTab({ portfolio, market, setTab, tbdData: externalTbdData, onUpdatePortfolios, onAssignPortfolio, onUpdateCapitalBase, onUpdateDepositedFunds, onToggleCopyTrading }: Props) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [expandedPosId, setExpandedPosId] = useState<string | null>(null);
  const [isObscured, setIsObscured] = useState(false);
  const [isLight, setIsLight] = useState(false);
  const [showManagePortfolios, setShowManagePortfolios] = useState(false);
  const [portfolioTargets, setPortfolioTargets] = useState<Record<string, number>>(() => {
    if (portfolio?.targets && Object.keys(portfolio.targets).length > 0) {
      return portfolio.targets;
    }
    return {
      'Tutti': 10,
      'Core': 8,
      'Satellite': 25,
      'PAC Ginevra': 5,
      'PAC Sofia': 5
    };
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && (!portfolio?.targets || Object.keys(portfolio.targets).length === 0)) {
      const saved = localStorage.getItem('portfolio_targets');
      if (saved) {
        try { 
          setPortfolioTargets(JSON.parse(saved)); 
        } catch {}
      }
    }
  }, [portfolio?.targets]);
  const [targetInputVal, setTargetInputVal] = useState<string>('');
  const [tbdData, setTbdData] = useState<{ realizedPnL: number; totalCapital: number } | null>(null);

  const antigravityEngine = useMemo(() => new AntigravityEngine(DEFAULT_ANTIGRAVITY_CONFIG), []);
  const leverageState = useMemo(() => {
    return antigravityEngine.calculateLeverageState(
      portfolio?.totalValue ?? 0,
      portfolio?.positions
        .filter(p => p.status === 'OPEN')
        .reduce((sum, p) => sum + p.capitalAllocated, 0) ?? 0,
      portfolio?.totalPnL ?? 0
    );
  }, [portfolio, antigravityEngine]);

  // Sync to localStorage and database (debounced to avoid spamming while typing)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('portfolio_targets', JSON.stringify(portfolioTargets));
    }
    const timer = setTimeout(async () => {
      try {
        await fetch('/api/portfolio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'update_portfolio_targets', targets: portfolioTargets }),
        });
      } catch (err) {
        console.error('Errore sincronizzazione target sul DB:', err);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [portfolioTargets]);

  useEffect(() => {
    if (externalTbdData) {
      setTbdData({
        realizedPnL: externalTbdData.today?.realizedPnL ?? 0,
        totalCapital: externalTbdData.config?.totalCapital ?? 5000,
      });
    }
  }, [externalTbdData]);

  const toggleTheme = () => {
    const newLight = !isLight;
    setIsLight(newLight);
    if (newLight) document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
  };

  const target = portfolioTargets[selectedTag || 'Tutti'] || 10;

  useEffect(() => {
    setTargetInputVal(String(target));
  }, [target, selectedTag]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [selectedTag]);

  if (!portfolio) return <div />;

  const p = portfolio;
  const customPortfolios = p.customPortfolios || ['Principale', 'Trading', 'Copy Trading', 'PAC'];

  // Dynamic portfolio tags loaded directly from customized portfolios configurations list
  const allTags = useMemo(() => {
    const list = [...customPortfolios];
    const hasUnassigned = p.positions.some(pos => pos.portfolio === 'Da Assegnare');
    if (hasUnassigned) {
      return ['Tutti', 'Da Assegnare', ...list];
    }
    return ['Tutti', ...list];
  }, [customPortfolios, p.positions]);

  const oldestPosDate = useMemo(() => {
    const activePositions = selectedTag === 'Tutti'
      ? p.positions
      : p.positions.filter(pos => pos.portfolio === selectedTag);
    const openPos = activePositions.filter(pos => pos.status === 'OPEN');
    if (openPos.length === 0) return p.startDate;
    const timestamps = openPos.map(pos => new Date(pos.entryDate).getTime()).filter(t => !isNaN(t));
    if (timestamps.length === 0) return p.startDate;
    return new Date(Math.min(...timestamps)).toISOString();
  }, [p.positions, selectedTag, p.startDate]);

  if (selectedTag === null) {

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '60vh', padding: '20px', gap: '20px' }}>
        {/* ROW DI CONTROLLO (ALLINEATA A DESTRA E NON SOVRAPPOSTA) */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', maxWidth: '700px', gap: '12px' }}>
          {onUpdatePortfolios && (
            <>
              <button 
                onClick={async () => {
                  const name = prompt('Nome del nuovo portafoglio:');
                  if (!name || !name.trim()) return;
                  const trimmed = name.trim();
                  if (customPortfolios.includes(trimmed)) {
                    alert('Questo portafoglio esiste già');
                    return;
                  }
                  await onUpdatePortfolios([...customPortfolios, trimmed]);
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', transition: 'all 0.2s', cursor: 'pointer' }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.borderColor = 'var(--blue)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg2)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                title="Crea Portafoglio"
              >
                <FolderPlus size={20} />
              </button>
              <button 
                onClick={() => setShowManagePortfolios(!showManagePortfolios)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', background: showManagePortfolios ? 'var(--blue)' : 'var(--bg2)', border: '1px solid var(--border)', color: showManagePortfolios ? '#fff' : 'var(--text)', transition: 'all 0.2s', cursor: 'pointer' }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.borderColor = 'var(--blue)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = showManagePortfolios ? 'var(--blue)' : 'var(--bg2)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                title="Gestisci Portafogli"
              >
                <Settings size={20} />
              </button>
            </>
          )}
          <button 
            onClick={async () => {
              if (onToggleCopyTrading) {
                await onToggleCopyTrading(!p.excludeCopyTrading);
              }
            }}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              padding: '0 12px', height: '40px', borderRadius: '20px', 
              background: p.excludeCopyTrading ? 'var(--bg3)' : 'rgba(76, 175, 80, 0.1)', 
              border: `1px solid ${p.excludeCopyTrading ? 'var(--border)' : 'var(--green)'}`, 
              color: p.excludeCopyTrading ? 'var(--text2)' : 'var(--green)', 
              transition: 'all 0.2s', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 'bold'
            }}
            title="Mostra o nascondi le posizioni dei CopyTrader nel calcolo globale"
          >
            COPY TRADING: {p.excludeCopyTrading ? 'ESCLUSO' : 'TUTTI'}
          </button>
          <button 
            onClick={() => setIsObscured(!isObscured)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', transition: 'all 0.2s', cursor: 'pointer' }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.borderColor = 'var(--blue)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg2)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            title="Nascondi importi"
          >
            {isObscured ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
          <button 
            onClick={toggleTheme}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', transition: 'all 0.2s', cursor: 'pointer' }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.borderColor = 'var(--yellow)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg2)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            title="Cambia tema"
          >
            {isLight ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>

        {/* Manage Portfolios panel */}
        {showManagePortfolios && (
          <div className="animate-fade" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '700px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)' }}>MODIFICA / ELIMINA PORTAFOGLI</div>
              <button onClick={() => setShowManagePortfolios(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>✕ CHIUDI</button>
            </div>
            {customPortfolios.map(pName => (
              <div key={pName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg3)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>{pName.toUpperCase()}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={async () => {
                      const newName = prompt(`Rinomina portafoglio "${pName}" in:`, pName);
                      if (!newName || !newName.trim() || newName.trim() === pName) return;
                      const trimmed = newName.trim();
                      
                      // Call server to rename atomically
                      const res = await fetch('/api/tags', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'rename_portfolio', oldName: pName, newName: trimmed }),
                      });
                      if (res.ok) {
                        window.location.reload();
                      }
                    }}
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text2)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
                  >
                    RINOMINA
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`Sei sicuro di voler eliminare il portafoglio "${pName}"? Tutti gli asset al suo interno verranno spostati nel portafoglio "Principale".`)) {
                        // Call server to delete atomically
                        const res = await fetch('/api/tags', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ type: 'delete_portfolio', portfolioName: pName }),
                        });
                        if (res.ok) {
                          window.location.reload();
                        }
                      }
                    }}
                    style={{ background: '#ef444422', border: '1px solid #ef444444', color: '#ef4444', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
                  >
                    ELIMINA
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: '22px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--text)', marginBottom: '12px', textAlign: 'center' }}>
          Seleziona il Portafoglio
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '20px', width: '100%', maxWidth: '700px' }}>
          {allTags.map(tag => {
            let pnlPct = 0;
            let val = 0;

            if (tag === 'Tutti') {
              const openPositionsGlobal = p.positions.filter(pos => {
                if (pos.status !== 'OPEN') return false;
                if (p.excludeCopyTrading && pos.id.startsWith('etoro_mirror_')) return false;
                return true;
              });
              const openValue = openPositionsGlobal.reduce((acc, pos) => acc + (pos.capitalAllocated + (pos.unrealizedPnl || 0)), 0);
              val = p.capitalAvailable + openValue;

              const totalUnrealizedPnL = openPositionsGlobal.reduce((sum, pos) => sum + (pos.unrealizedPnl || 0), 0);
              const totalRealizedPnL = p.positions
                .filter(pos => pos.status === 'CLOSED' && !(p.excludeCopyTrading && pos.id.startsWith('etoro_mirror_')))
                .reduce((sum, pos) => sum + ((pos as any).realizedPnl || 0), 0);
              const totalPnL = totalUnrealizedPnL + totalRealizedPnL;

              const baseForPnL = (p.depositedFunds && p.depositedFunds > 0)
                ? p.depositedFunds
                : (openPositionsGlobal.reduce((acc, pos) => acc + (pos.capitalAllocated || 0), 0) || 1);
              pnlPct = (totalPnL / baseForPnL) * 100;
            } else {
              // Filter by portfolio property
              const tagPos = p.positions.filter(pos => pos.portfolio === tag);
              const openTagPos = tagPos.filter(pos => pos.status === 'OPEN');
              const closedTagPos = tagPos.filter(pos => pos.status === 'CLOSED');
              
              const unrealized = openTagPos.reduce((acc, pos) => acc + (pos.unrealizedPnl || 0), 0);
              const realized = closedTagPos.reduce((acc, pos) => acc + (pos.realizedPnl || 0), 0);
              const totalPnL = unrealized + realized;
              const invested = openTagPos.reduce((acc, pos) => acc + (pos.capitalAllocated || 0), 0);
              
              pnlPct = invested > 0 ? (totalPnL / invested) * 100 : 0;
              val = openTagPos.reduce((acc, pos) => acc + (pos.capitalAllocated + (pos.unrealizedPnl || 0)), 0);
            }

            const isPositive = pnlPct >= 0;
            const pnlColor = isPositive ? '#84cc16' : 'var(--red)';

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
          
          {/* PORTFOLIO CARD TRADING BY DAY */}
          <button
            onClick={() => setTab ? setTab('trading') : null}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '32px 16px', background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.borderColor = '#f59e0b'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <span style={{ fontSize: '48px', marginBottom: '16px' }}>⚡</span>
            <span style={{ fontSize: '15px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--text)' }}>
              Trading by Day
            </span>
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'var(--bg)', padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--bg3)' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: (tbdData?.realizedPnL ?? 0) >= 0 ? '#84cc16' : 'var(--red)', fontFamily: 'var(--font-mono)' }}>
                {(tbdData?.realizedPnL ?? 0) >= 0 ? '+' : ''}{(tbdData?.realizedPnL ?? 0).toFixed(2)}€
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                €{tbdData ? tbdData.totalCapital.toLocaleString('it-IT') : '5.000'}
              </span>
            </div>
          </button>
        </div>
        <div style={{ marginTop: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.15em' }}>
            PATRIMONIO COMPLESSIVO
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
            {isObscured ? '€ *****' : `€${p.totalValue.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: isObscured ? 'var(--text3)' : (p.totalPnL >= 0 ? '#84cc16' : 'var(--red)') }}>
            {isObscured ? '*****' : (
              <>{p.totalPnL >= 0 ? 'Profitti totali: +' : 'Perdite totali: '}€{p.totalPnL.toFixed(0)} ({p.totalPnLPercent >= 0 ? '+' : ''}{p.totalPnLPercent.toFixed(2)}%)</>
            )}
          </div>
        </div>

        <div style={{ marginTop: '24px', width: '100%', maxWidth: '700px' }}>
          <AntigravityMonitor leverageState={leverageState} />
        </div>
      </div>
    );
  }

  // Filter positions based on custom portfolio name
  const filteredPositions = selectedTag === 'Tutti'
    ? p.positions
    : p.positions.filter(pos => pos.portfolio === selectedTag);

  const openPositions = filteredPositions.filter(pos => pos.status === 'OPEN');
  const closedPositions = filteredPositions.filter(pos => pos.status === 'CLOSED');

  let displayTotalValue = 0;
  let displayPnL = 0;
  let displayPnLPct = 0;
  let displayInvested = 0;

  if (selectedTag === 'Tutti') {
    const openPositionsGlobal = p.positions.filter(pos => {
      if (pos.status !== 'OPEN') return false;
      if (p.excludeCopyTrading && pos.id.startsWith('etoro_mirror_')) return false;
      return true;
    });
    displayInvested = openPositionsGlobal.reduce((acc, pos) => acc + (pos.capitalAllocated || 0), 0);
    const openValue = openPositionsGlobal.reduce((acc, pos) => acc + (pos.capitalAllocated + (pos.unrealizedPnl || 0)), 0);
    displayTotalValue = p.capitalAvailable + openValue;

    const totalUnrealizedPnL = openPositionsGlobal.reduce((sum, pos) => sum + (pos.unrealizedPnl || 0), 0);
    const totalRealizedPnL = p.positions
      .filter(pos => pos.status === 'CLOSED' && !(p.excludeCopyTrading && pos.id.startsWith('etoro_mirror_')))
      .reduce((sum, pos) => sum + ((pos as any).realizedPnl || 0), 0);
    displayPnL = totalUnrealizedPnL + totalRealizedPnL;

    const baseForPnL = (p.depositedFunds && p.depositedFunds > 0)
      ? p.depositedFunds
      : (displayInvested > 0 ? displayInvested : 1);
    displayPnLPct = (displayPnL / baseForPnL) * 100;
  } else {
    displayTotalValue = openPositions.reduce((acc, pos) => acc + (pos.capitalAllocated + (pos.unrealizedPnl || 0)), 0);
    const unrealized = openPositions.reduce((acc, pos) => acc + (pos.unrealizedPnl || 0), 0);
    const realized = closedPositions.reduce((acc, pos) => acc + (pos.realizedPnl || 0), 0);
    displayPnL = unrealized + realized;
    displayInvested = openPositions.reduce((acc, pos) => acc + (pos.capitalAllocated || 0), 0);
    
    const subPortfolioBase = displayTotalValue > 0 ? displayTotalValue : p.capitalBase;
    displayPnLPct = (displayPnL / subPortfolioBase) * 100;
  }

  const targetBase = selectedTag === 'Tutti'
    ? (p.depositedFunds || p.capitalBase)
    : (displayTotalValue > 0 ? displayTotalValue : p.capitalBase);
  const targetEur = targetBase * (target / 100);

  const currentPnLForProgress = displayPnL;
  const progressPct = Math.max(0, Math.min(100, (currentPnLForProgress / Math.max(1, targetEur)) * 100));

  const ahead = isAheadOfTarget(displayPnLPct, target, oldestPosDate);
  const getAggressionStr = (pnlPercent: number, targetPercent: number, startDate: string) => {
    const rawDays = (Date.now() - new Date(startDate).getTime()) / 86400000;
    const daysPassed = Math.max(45, rawDays); // Evita distorsioni nei primi giorni impostando un minimo di 45 giorni
    const expected = (targetPercent / 365) * daysPassed;
    if (pnlPercent < expected - 5) return 'AGGRESSIVE';
    if (pnlPercent > expected + 2) return 'CONSERVATIVE';
    return 'MODERATE';
  };
  const aggression = getAggressionStr(displayPnLPct, target, oldestPosDate);

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

      {/* TITOLO DEL PORTAFOGLIO */}
      <div style={{ marginTop: '8px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {getTagIcon(selectedTag || 'Tutti')}
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.15em' }}>
              PORTAFOGLIO
            </div>
            <h1 style={{ fontSize: '32px', margin: 0, fontWeight: 'bold', color: 'var(--text)' }}>
              {selectedTag === 'Tutti' ? 'Globale' : selectedTag}
            </h1>
          </div>
        </div>


      </div>

      {/* TOP KPI ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {selectedTag === 'Tutti' && (
          <KpiCard
            label="FONDI DEPOSITATI"
            value={
              <div key={p.depositedFunds} style={{ display: 'flex', alignItems: 'center' }}>
                <span>€</span>
                <input
                  type="number"
                  defaultValue={p.depositedFunds || 6000}
                  onBlur={async (e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val !== p.depositedFunds && onUpdateDepositedFunds) {
                      await onUpdateDepositedFunds(val);
                    }
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      const val = parseFloat((e.target as HTMLInputElement).value);
                      if (!isNaN(val) && val !== p.depositedFunds && onUpdateDepositedFunds) {
                        await onUpdateDepositedFunds(val);
                        (e.target as HTMLInputElement).blur();
                      }
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px dashed var(--blue)',
                    color: 'var(--blue)',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    fontFamily: 'var(--font-mono)',
                    width: '120px',
                    padding: '0',
                    marginLeft: '2px',
                    outline: 'none',
                  }}
                />
              </div>
            }
            sub="totale fondi depositati (modificabile)"
            color="var(--blue)"
          />
        )}
        <KpiCard
          label="VALORE ALLOCATO"
          value={`€${displayInvested.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          sub={selectedTag === 'Tutti' ? "capitale investito negli asset attivi" : "somma capitale investito"}
          color="var(--blue)"
        />
        <KpiCard
          label={selectedTag === 'Tutti' ? "VALORE PORTAFOGLIO" : `VALORE: ${selectedTag.toUpperCase()}`}
          value={`€${displayTotalValue.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          sub={selectedTag === 'Tutti' ? "valore attuale totale (equity)" : "valore posizioni attuali"}
          color="var(--text)"
        />
        <KpiCard
          label="P&L TOTALE"
          value={`${displayPnL >= 0 ? '+' : ''}€${displayPnL.toFixed(0)}`}
          sub={`${displayPnLPct >= 0 ? '+' : ''}${displayPnLPct.toFixed(2)}%`}
          color={displayPnL >= 0 ? '#84cc16' : 'var(--red)'}
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
          sub={`${((p.capitalAvailable / (p.depositedFunds || p.capitalBase || 1)) * 100).toFixed(0)}% dei fondi depositati`}
          color="var(--blue)"
        />
        {selectedTag !== 'Tutti' && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)' }}>
              TARGET ANNUO ({selectedTag})
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--yellow)', fontFamily: 'var(--font-mono)' }}>+</span>
              <input 
                type="number" 
                value={targetInputVal}
                onChange={(e) => {
                  const raw = e.target.value;
                  setTargetInputVal(raw);
                  const val = parseFloat(raw);
                  if (!isNaN(val)) {
                    setPortfolioTargets(prev => ({ ...prev, [selectedTag || 'Tutti']: val }));
                  }
                }}
                onBlur={() => {
                  if (targetInputVal === '' || isNaN(parseFloat(targetInputVal))) {
                    setTargetInputVal(String(target));
                  }
                }}
                style={{
                  background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '6px',
                  color: 'var(--yellow)', fontSize: '20px', fontWeight: 'bold', fontFamily: 'var(--font-mono)',
                  width: '60px', padding: '2px 4px', textAlign: 'center'
                }}
              />
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--yellow)', fontFamily: 'var(--font-mono)' }}>%</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
              ~€{targetEur.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
            </div>
          </div>
        )}
      </div>

      {/* PROGRESS BAR */}
      {selectedTag !== 'Tutti' && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)' }}>PROGRESSO OBIETTIVO +{target}%</span>
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
      )}

      {/* ALLOCATION WIDGETS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        {/* ASSET ALLOCATION (MACRO-CATEGORIE) */}
        {openPositions.length > 0 && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '12px' }}>
              <PieChart size={32} /> ALLOCAZIONE PER CATEGORIA
            </div>
            <AssetAllocationChart positions={openPositions} />
          </div>
        )}

        {/* ESPOSIZIONE SETTORIALE */}
        {openPositions.length > 0 && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '12px' }}>
              <Layers size={32} /> DIVERSIFICAZIONE SETTORIALE
            </div>
            <SectorDiversificationWidget positions={openPositions} />
          </div>
        )}

        {/* ESPOSIZIONE GEOGRAFICA */}
        {openPositions.length > 0 && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '12px' }}>
              <Globe size={32} /> ESPOSIZIONE GEOGRAFICA
            </div>
            <GeographicExposureWidget positions={openPositions} />
          </div>
        )}

        {/* RELAZIONE CORE / SATELLITE (GLOBALE) */}
        {(selectedTag === 'Tutti' || selectedTag === 'Core' || selectedTag === 'Satellite') && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '12px' }}>
              <Scale size={32} /> RAPPORTO CORE / SATELLITE
            </div>
            <CoreSatelliteWidget positions={p.positions} />
          </div>
        )}
      </div>

      {/* PROFESSIONAL CHART (Dinamico per Portafoglio) */}
      <ProfessionalChart 
        currentValue={displayTotalValue} 
        label={selectedTag === 'Tutti' || !selectedTag ? 'TOTALE' : selectedTag.toUpperCase()} 
        history={selectedTag === 'Tutti' || !selectedTag ? p.performanceHistory : undefined}
      />

      {/* STATS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        <StatCard label="POSIZIONI APERTE" value={String(openPositions.length)} />
        <StatCard label="TRADE CHIUSI" value={String(closedPositions.length)} />
        <StatCard label="WIN RATE" value={winRate !== null ? `${winRate.toFixed(0)}%` : '—'} color={winRate !== null && winRate >= 50 ? 'var(--green)' : 'var(--red)'} />
      </div>

      {/* OPEN POSITIONS CARD GRID */}
      {openPositions.length > 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '16px' }}>POSIZIONI APERTE</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '14px' }}>
            {openPositions.map(pos => {
              const pnl = pos.unrealizedPnl ?? 0;
              const pnlPct = pos.unrealizedPnlPercent ?? 0;
              const allocated = pos.capitalAllocated || 0;
              const currentPrice = pos.currentPrice ?? pos.entryPrice;
              const currentVal = allocated + (pos.unrealizedPnl || 0);
              const weight = displayTotalValue > 0 ? (currentVal / displayTotalValue) * 100 : 0;
              const isExpanded = expandedPosId === pos.id;
              const pnlColor = pnl >= 0 ? 'var(--green)' : 'var(--red)';

              return (
                <div key={pos.id} style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* CARD */}
                  <button
                    onClick={() => setExpandedPosId(isExpanded ? null : pos.id)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      padding: '20px 12px 14px', background: 'var(--bg)', border: `1px solid ${isExpanded ? 'var(--blue)' : 'var(--border)'}`,
                      borderRadius: '14px', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center',
                      boxShadow: isExpanded ? '0 0 0 1px var(--blue)' : '0 4px 12px rgba(0,0,0,0.15)',
                    }}
                    onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'var(--blue)'; }}
                    onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = isExpanded ? 'var(--blue)' : 'var(--border)'; }}
                  >
                    {/* BIG ICON */}
                    <div style={{ marginBottom: '10px', borderRadius: '12px', overflow: 'hidden', width: '64px', height: '64px', flexShrink: 0 }}>
                      <AssetIcon symbol={pos.symbol} logoUrl={pos.logoUrl} size={64} />
                    </div>

                    {/* SYMBOL + NAME */}
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', fontSize: '14px', color: 'var(--text)', marginBottom: '2px' }}>{pos.symbol}</div>
                    <div style={{ fontSize: '9px', color: 'var(--text3)', marginBottom: '10px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pos.name}</div>

                    {/* P&L BOX */}
                    <div style={{ background: 'var(--bg2)', borderRadius: '10px', padding: '8px 12px', width: '100%', border: '1px solid var(--bg3)' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: '700', color: pnlColor }}>
                        {pnl >= 0 ? '+' : ''}€{pnl.toFixed(0)}
                      </div>
                      <div style={{ fontSize: '10px', color: pnlColor, marginTop: '1px' }}>
                        {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                      </div>
                    </div>

                    {/* PORTFOLIO TAG + WEIGHT */}
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', color: 'var(--text3)', background: 'var(--bg2)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--bg3)' }}>
                        {pos.portfolio || 'N/A'}
                      </span>
                      <span style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', color: 'var(--blue)' }}>{weight.toFixed(1)}%</span>
                    </div>
                  </button>

                  {/* EXPANDED DETAIL */}
                  {isExpanded && (
                    <div style={{ background: 'var(--bg)', border: '1px solid var(--blue)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '14px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                        <div>
                          <div style={{ color: 'var(--text3)', fontSize: '9px', marginBottom: '2px' }}>ENTRATA</div>
                          <div style={{ color: 'var(--text)', fontWeight: 'bold' }}>€{pos.entryPrice.toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text3)', fontSize: '9px', marginBottom: '2px' }}>ATTUALE</div>
                          <div style={{ color: 'var(--text)', fontWeight: 'bold' }}>€{currentPrice.toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text3)', fontSize: '9px', marginBottom: '2px' }}>STOP LOSS</div>
                          <div style={{ color: 'var(--red)', fontWeight: 'bold' }}>€{pos.stopLoss.toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text3)', fontSize: '9px', marginBottom: '2px' }}>TAKE PROFIT</div>
                          <div style={{ color: 'var(--green)', fontWeight: 'bold' }}>€{pos.takeProfit.toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text3)', fontSize: '9px', marginBottom: '2px' }}>ALLOCATO</div>
                          <div style={{ color: 'var(--text2)' }}>€{allocated.toFixed(0)}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text3)', fontSize: '9px', marginBottom: '2px' }}>VALORE ATT.</div>
                          <div style={{ color: 'var(--text)', fontWeight: 'bold' }}>€{currentVal.toFixed(0)}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: '9px', color: 'var(--text3)', textAlign: 'center', marginTop: '4px' }}>
                        Aperta: {new Date(pos.entryDate).toLocaleDateString('it-IT')} · {pos.action} · {pos.quantity.toFixed(4)} unità
                      </div>
                      {/* Portfolio assign */}
                      {onAssignPortfolio && (
                        <div style={{ marginTop: '8px' }}>
                          <select
                            value={pos.portfolio || 'Da Assegnare'}
                            onClick={e => e.stopPropagation()}
                            onChange={async e => { if (onAssignPortfolio) await onAssignPortfolio(pos.id, e.target.value); }}
                            style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '10px', fontFamily: 'var(--font-mono)', borderRadius: '6px', padding: '4px 6px', outline: 'none', cursor: 'pointer' }}
                          >
                            <option value="Da Assegnare">DA ASSEGNARE</option>
                            {customPortfolios.map(cp => (
                              <option key={cp} value={cp}>{cp.toUpperCase()}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PAC SCENARIO WIDGET */}
      {selectedTag && selectedTag.toUpperCase().includes('PAC') && (
        <PacScenarioWidget currentValue={displayTotalValue} currentAllocated={displayInvested} />
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: React.ReactNode; sub: React.ReactNode; color: string }) {
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

function AssetAllocationChart({ positions }: { positions: Position[] }) {
  const categories = positions.reduce((acc, pos) => {
    const type = getMacroCategory(pos);
    const val = pos.capitalAllocated + (pos.unrealizedPnl || 0);
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

function GeographicExposureWidget({ positions }: { positions: Position[] }) {
  const geoMap = positions.reduce((acc, pos) => {
    const geo = getGeography(pos.symbol, pos.name);
    const val = pos.capitalAllocated + (pos.unrealizedPnl || 0);
    if (!acc[geo]) acc[geo] = { total: 0, assets: [] };
    acc[geo].total += val;
    acc[geo].assets.push({ symbol: pos.symbol, name: pos.name, value: val, logoUrl: pos.logoUrl });
    return acc;
  }, {} as Record<string, { total: number, assets: {symbol: string, name: string, value: number, logoUrl?: string}[] }>);

  const totalValue = Object.values(geoMap).reduce((a, b) => a + b.total, 0);
  if (totalValue === 0) return <div style={{ color: 'var(--text3)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>Nessun dato.</div>;

  const colors: Record<string, string> = {
    'Nord America': '#3b82f6',
    'Globale': '#8b5cf6',
    'Europa': '#00d4aa',
    'Mercati Emergenti': '#f59e0b',
    'Decentralizzata': '#ef4444',
    'Altro': 'var(--text2)'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
        {Object.entries(geoMap).sort((a,b)=>b[1].total-a[1].total).map(([geo, data]) => {
          const pct = (data.total / totalValue) * 100;
          return (
            <div key={geo} style={{ width: `${pct}%`, background: colors[geo] || 'var(--text2)', transition: 'width 0.5s' }} title={`${geo}: ${pct.toFixed(1)}%`} />
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
        {Object.entries(geoMap).sort((a,b)=>b[1].total-a[1].total).map(([geo, data]) => {
          const pct = (data.total / totalValue) * 100;
          return (
            <div key={geo} style={{ background: 'var(--bg3)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors[geo] || 'var(--text2)' }} />
                <span style={{ color: 'var(--text2)', fontWeight: 'bold' }}>{geo}</span>
                <span style={{ fontWeight: 'bold', marginLeft: 'auto', color: 'var(--text)' }}>{pct.toFixed(1)}%</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {data.assets.sort((a,b)=>b.value-a.value).map(a => (
                  <div key={a.symbol} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AssetIcon symbol={a.symbol} logoUrl={a.logoUrl} size={20} />
                      <span title={a.name}>{a.symbol}</span>
                    </div>
                    <span>{((a.value / data.total) * pct).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectorDiversificationWidget({ positions }: { positions: Position[] }) {
  const sectorMap = positions.reduce((acc, pos) => {
    const sec = getSector(pos.symbol, pos.name, pos.type);
    const val = pos.capitalAllocated + (pos.unrealizedPnl || 0);
    if (!acc[sec]) acc[sec] = { total: 0, assets: [] };
    acc[sec].total += val;
    acc[sec].assets.push({ symbol: pos.symbol, name: pos.name, value: val, logoUrl: pos.logoUrl });
    return acc;
  }, {} as Record<string, { total: number, assets: {symbol: string, name: string, value: number, logoUrl?: string}[] }>);

  const totalValue = Object.values(sectorMap).reduce((a, b) => a + b.total, 0);
  if (totalValue === 0) return <div style={{ color: 'var(--text3)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>Nessun dato.</div>;

  const colors: Record<string, string> = {
    'Tecnologia': '#3b82f6',
    'Finanza': '#f59e0b',
    'Salute': '#10b981',
    'Energia': '#ef4444',
    'Obbligazionario': '#8b5cf6',
    'Criptovalute': '#f97316',
    'Misto / Indici': '#00d4aa',
    'Beni & Servizi': 'var(--text2)'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
        {Object.entries(sectorMap).sort((a,b)=>b[1].total-a[1].total).map(([sec, data]) => {
          const pct = (data.total / totalValue) * 100;
          return (
            <div key={sec} style={{ width: `${pct}%`, background: colors[sec] || 'var(--text2)', transition: 'width 0.5s' }} title={`${sec}: ${pct.toFixed(1)}%`} />
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
        {Object.entries(sectorMap).sort((a,b)=>b[1].total-a[1].total).map(([sec, data]) => {
          const pct = (data.total / totalValue) * 100;
          return (
            <div key={sec} style={{ background: 'var(--bg3)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors[sec] || 'var(--text2)' }} />
                <span style={{ color: 'var(--text2)', fontWeight: 'bold' }}>{sec}</span>
                <span style={{ fontWeight: 'bold', marginLeft: 'auto', color: 'var(--text)' }}>{pct.toFixed(1)}%</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {data.assets.sort((a,b)=>b.value-a.value).map(a => (
                  <div key={a.symbol} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AssetIcon symbol={a.symbol} logoUrl={a.logoUrl} size={20} />
                      <span title={a.name}>{a.symbol}</span>
                    </div>
                    <span>{((a.value / data.total) * pct).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CoreSatelliteWidget({ positions }: { positions: Position[] }) {
  const openPos = positions.filter(p => p.status === 'OPEN');
  
  const coreValue = openPos
    .filter(p => p.tags?.some(t => t.toLowerCase() === 'core'))
    .reduce((sum, p) => sum + (p.capitalAllocated + (p.unrealizedPnl || 0)), 0);

  const satValue = openPos
    .filter(p => p.tags?.some(t => t.toLowerCase() === 'satellite'))
    .reduce((sum, p) => sum + (p.capitalAllocated + (p.unrealizedPnl || 0)), 0);

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

function getMacroCategory(pos: Position): string {
  if (pos.symbol === 'GLD' || pos.symbol === 'IAU') return 'MATERIE PRIME';
  if (pos.type === 'CRYPTO') return 'CRYPTO';
  if (pos.type === 'ETF') return 'FONDI / ETF';
  if (pos.type === 'STOCK') return 'AZIONI';
  return 'ALTRO';
}

function getGeography(symbol: string, name: string): string {
  const t = name.toLowerCase() + symbol.toLowerCase();
  if (t.includes('world') || t.includes('global') || t.includes('vwce')) return 'Globale';
  if (t.includes('us') || t.includes('s&p') || t.includes('spy') || t.includes('apple') || t.includes('tesla')) return 'Nord America';
  if (t.includes('europe') || t.includes('eu')) return 'Europa';
  if (t.includes('em') || t.includes('emerging')) return 'Mercati Emergenti';
  if (t.includes('btc') || t.includes('eth') || t.includes('bitcoin') || t.includes('crypto')) return 'Decentralizzata';
  return 'Altro';
}

function getSector(symbol: string, name: string, type: string): string {
  const t = name.toLowerCase() + symbol.toLowerCase();
  if (type === 'CRYPTO') return 'Criptovalute';
  if (t.includes('tech') || t.includes('apple') || t.includes('qqq')) return 'Tecnologia';
  if (t.includes('finan') || t.includes('bank') || t.includes('jpm') || t.includes('bac')) return 'Finanza';
  if (t.includes('health') || t.includes('med') || t.includes('jnj')) return 'Salute';
  if (t.includes('energy') || t.includes('oil') || t.includes('xle')) return 'Energia';
  if (t.includes('bond') || t.includes('treasury') || t.includes('bnd') || t.includes('agg') || t.includes('tlt')) return 'Obbligazionario';
  if (t.includes('world') || t.includes('global') || t.includes('sp500') || t.includes('spy')) return 'Misto / Indici';
  return 'Beni & Servizi';
}
