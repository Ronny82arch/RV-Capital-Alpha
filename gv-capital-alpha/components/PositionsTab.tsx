'use client';
import { useState } from 'react';
import { PortfolioState, Position } from '@/types';
import AssetIcon from './AssetIcon';

interface Props {
  portfolio: PortfolioState | null;
  onClose: (positionId: string, price: number) => Promise<boolean>;
  onDelete: (positionId: string) => Promise<boolean>;
  onUpdateTags?: (positionId: string, tags: string[]) => Promise<boolean>;
  onUpdateAIFilters?: (aiManagedTags: string[]) => Promise<boolean>;
  onUpdatePortfolios?: (customPortfolios: string[]) => Promise<boolean>;
  onAssignPortfolio?: (positionId: string, portfolioName: string) => Promise<boolean>;
}

export default function PositionsTab({ 
  portfolio, 
  onClose, 
  onDelete, 
  onUpdateTags, 
  onUpdateAIFilters,
  onUpdatePortfolios,
  onAssignPortfolio
}: Props) {
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>('Tutti');
  const [showNewPortfolioForm, setShowNewPortfolioForm] = useState(false);
  const [showManagePortfolios, setShowManagePortfolios] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');

  const openPositions = portfolio?.positions.filter(p => p.status === 'OPEN') ?? [];
  const closedPositions = portfolio?.positions.filter(p => p.status === 'CLOSED') ?? [];
  const totalUnrealized = openPositions.reduce((s, p) => s + (p.unrealizedPnl ?? 0), 0);
  const totalRealized = closedPositions.reduce((s, p) => s + (p.realizedPnl ?? 0), 0);

  const customPortfolios = portfolio?.customPortfolios || ['Principale', 'Trading', 'Copy Trading', 'PAC'];

  // Filter positions based on selected sub-portfolio
  const filteredOpenPositions = selectedPortfolio === 'Tutti'
    ? openPositions
    : openPositions.filter(p => p.portfolio === selectedPortfolio);

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

      {/* Portfolios Navigation Selector */}
      <div>
        <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '10px' }}>SELEZIONA PORTAFOGLIO</div>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', alignItems: 'center' }}>
          {['Tutti', ...customPortfolios].map(pName => {
            const isSelected = selectedPortfolio === pName;
            const count = pName === 'Tutti' 
              ? openPositions.length 
              : openPositions.filter(p => p.portfolio === pName).length;
            return (
              <button
                key={pName}
                onClick={() => setSelectedPortfolio(pName)}
                style={{
                  background: isSelected ? 'var(--blue)' : 'var(--bg2)',
                  border: isSelected ? 'none' : '1px solid var(--border)',
                  color: isSelected ? '#fff' : 'var(--text2)',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: isSelected ? 'bold' : 'normal',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                {pName.toUpperCase()} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* AI Filters Configuration */}
      <AIFiltersPanel portfolio={portfolio} onUpdate={onUpdateAIFilters} />


      {openPositions.length === 0 && closedPositions.length === 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '32px', textAlign: 'center', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
          Nessuna posizione aperta.<br />
          <span style={{ fontSize: '12px' }}>Approva un segnale per iniziare.</span>
        </div>
      )}

      {openPositions.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '10px' }}>
            POSIZIONI APERTE - {selectedPortfolio.toUpperCase()} ({filteredOpenPositions.length})
          </div>
          {filteredOpenPositions.map(pos => (
            <PositionCard 
              key={pos.id} 
              position={pos} 
              onClose={onClose} 
              onDelete={onDelete} 
              onUpdateTags={onUpdateTags} 
              customPortfolios={customPortfolios}
              onAssignPortfolio={onAssignPortfolio}
            />
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

function PositionCard({ 
  position: pos, 
  onClose, 
  onDelete, 
  onUpdateTags,
  customPortfolios = [],
  onAssignPortfolio
}: { 
  position: Position; 
  onClose: (id: string, p: number) => Promise<boolean>; 
  onDelete: (id: string) => Promise<boolean>; 
  onUpdateTags?: (id: string, t: string[]) => Promise<boolean>;
  customPortfolios?: string[];
  onAssignPortfolio?: (id: string, portfolio: string) => Promise<boolean>;
}) {
  const [showClose, setShowClose] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [priceInput, setPriceInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [closing, setClosing] = useState(false);
  const [updating, setUpdating] = useState(false);

  const pnl = pos.unrealizedPnl ?? 0;
  const pnlPct = pos.unrealizedPnlPercent ?? 0;
  const isShort = pos.action === 'SELL';
  const currentPrice = pos.currentPrice ?? pos.entryPrice;
  const distToSL = isShort 
    ? ((pos.stopLoss - currentPrice) / pos.entryPrice * 100) 
    : ((currentPrice - pos.stopLoss) / pos.entryPrice * 100);
  const distToTP = isShort
    ? ((currentPrice - pos.takeProfit) / pos.entryPrice * 100)
    : ((pos.takeProfit - currentPrice) / pos.entryPrice * 100);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AssetIcon symbol={pos.symbol} logoUrl={pos.logoUrl} />
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', fontSize: '18px' }}>{pos.symbol}</div>
            <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{pos.name} · {pos.quantity} unità</div>
          </div>
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
            left: `${Math.max(2, Math.min(96, (isShort ? pos.stopLoss - currentPrice : currentPrice - pos.stopLoss) / (isShort ? pos.stopLoss - pos.takeProfit : pos.takeProfit - pos.stopLoss) * 100))}%`,
            top: '50%', transform: 'translateY(-50%)',
            width: '8px', height: '8px', borderRadius: '50%', background: 'white',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text3)', marginTop: '4px' }}>
          <span>SL</span><span>TP</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text3)' }}>
          Aperta: {new Date(pos.entryDate).toLocaleDateString('it-IT')} · Capitale: €{pos.capitalAllocated.toFixed(0)}
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {onAssignPortfolio && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg3)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '8px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>PORTAFOGLIO:</span>
              <select
                value={pos.portfolio || 'Principale'}
                onChange={async (e) => {
                  await onAssignPortfolio(pos.id, e.target.value);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text2)',
                  fontSize: '9px',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  padding: '2px 0'
                }}
              >
                {customPortfolios.map(p => (
                  <option key={p} value={p} style={{ background: 'var(--bg2)', color: 'var(--text)' }}>{p.toUpperCase()}</option>
                ))}
              </select>
            </div>
          )}
          {(pos.tags || []).map(t => (
            <span key={t} style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>
              {t}
            </span>
          ))}
          <button onClick={() => setShowTags(!showTags)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text3)', fontSize: '9px', padding: '2px 6px', cursor: 'pointer' }}>+ TAG</button>
        </div>
      </div>

      {showTags && (
        <div className="animate-fade" style={{ background: 'var(--bg3)', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>MODIFICA ETICHETTE (TAGS)</div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
            {['Core', 'Satellite', 'PAC'].map(preset => (
              <button key={preset} onClick={() => { setTagInput(preset); }} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '10px', padding: '4px 8px', color: 'var(--text2)' }}>{preset}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="text" placeholder="Tag personalizzato (es. Piano Figlia)" value={tagInput} onChange={e => setTagInput(e.target.value)} style={{ flex: 1, fontSize: '12px' }} />
            <button onClick={async () => {
              if (!tagInput || !onUpdateTags) return;
              setUpdating(true);
              const newTags = Array.from(new Set([...(pos.tags || []), tagInput]));
              await onUpdateTags(pos.id, newTags);
              setTagInput('');
              setShowTags(false);
              setUpdating(false);
            }} disabled={updating || !tagInput} style={{ background: 'var(--text)', color: 'var(--bg)', border: 'none', borderRadius: '4px', padding: '6px 12px', fontSize: '10px', fontWeight: 'bold' }}>{updating ? '...' : 'AGGIUNGI'}</button>
            {pos.tags && pos.tags.length > 0 && (
              <button onClick={async () => {
                if (!onUpdateTags) return;
                setUpdating(true);
                await onUpdateTags(pos.id, []);
                setShowTags(false);
                setUpdating(false);
              }} style={{ background: 'var(--red)', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 12px', fontSize: '10px', fontWeight: 'bold' }}>SVUOTA</button>
            )}
          </div>
        </div>
      )}

      {!showClose ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
          <button onClick={() => setShowClose(true)} style={{
            padding: '11px', borderRadius: '8px',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em',
          }}>CHIUDI SU ETORO</button>
          <button onClick={async () => {
            if (confirm(`Sei sicuro di voler rifiutare questa operazione (${pos.symbol})? La posizione verrà eliminata e il capitale di €${pos.capitalAllocated} sarà ripristinato.`)) {
              await onDelete(pos.id);
            }
          }} style={{
            padding: '11px', borderRadius: '8px',
            border: '1px solid var(--red)', background: 'transparent',
            color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em',
          }}>✕ RIFIUTA OPERAZIONE</button>
        </div>
      ) : (
        <div className="animate-fade">
          <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>
            Inserisci il prezzo di chiusura ottenuto su eToro:
          </div>
          <input 
            type="number" 
            step="0.01" 
            placeholder={`es. ${currentPrice.toFixed(2)}`} 
            value={priceInput} 
            onChange={e => setPriceInput(e.target.value)} 
            style={{ width: '100%', marginBottom: '10px' }} 
          />
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
            <button onClick={handleClose} disabled={closing || !priceInput} style={{
              background: 'var(--green)', border: 'none', borderRadius: '8px', color: '#070b14',
              fontFamily: 'var(--font-mono)', fontWeight: '800', padding: '12px 10px', fontSize: '11px',
              opacity: (!priceInput || closing) ? 0.5 : 1,
              letterSpacing: '0.05em'
            }}>
              {closing ? '...' : '✓ CONFERMA CHIUSURA'}
            </button>
            <button onClick={() => setShowClose(false)} style={{ 
              background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', 
              color: 'var(--text3)', fontFamily: 'var(--font-mono)', padding: '12px 10px', fontSize: '11px',
              letterSpacing: '0.05em'
            }}>
              ✕ ANNULLA
            </button>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <AssetIcon symbol={pos.symbol} logoUrl={pos.logoUrl} />
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '700' }}>{pos.symbol}</div>
          <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
            {pos.quantity} × €{pos.entryPrice.toFixed(2)} → €{pos.closePrice?.toFixed(2)}
          </div>
        </div>
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

function AIFiltersPanel({ portfolio, onUpdate }: { portfolio: PortfolioState | null; onUpdate?: (tags: string[]) => Promise<boolean> }) {
  const [showConfig, setShowConfig] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [updating, setUpdating] = useState(false);

  const managedTags = portfolio?.aiManagedTags || [];

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>FILTRI INTELLIGENZA ARTIFICIALE</div>
          <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
            L'IA analizza e gestisce <b>solo</b> le posizioni con queste etichette:
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
            {managedTags.length === 0 ? (
              <span style={{ fontSize: '11px', color: 'var(--text3)', fontStyle: 'italic' }}>Tutte (nessun filtro applicato)</span>
            ) : (
              managedTags.map(t => (
                <span key={t} style={{ background: 'var(--blue)', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>{t}</span>
              ))
            )}
          </div>
        </div>
        <button onClick={() => setShowConfig(!showConfig)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '10px', padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
          MODIFICA
        </button>
      </div>

      {showConfig && (
        <div className="animate-fade" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '8px' }}>Seleziona quali etichette vuoi che l'IA utilizzi. Tutte le altre posizioni verranno ignorate (es. Piani di accumulo).</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            {['Core', 'Satellite', 'Trading'].map(preset => (
              <button key={preset} onClick={async () => {
                if (!onUpdate || managedTags.includes(preset)) return;
                setUpdating(true);
                await onUpdate([...managedTags, preset]);
                setUpdating(false);
              }} style={{ background: 'var(--bg3)', border: 'none', borderRadius: '4px', fontSize: '10px', padding: '4px 8px', color: 'var(--text2)', cursor: 'pointer' }}>+ {preset}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="text" placeholder="Aggiungi tag (es. Core)" value={tagInput} onChange={e => setTagInput(e.target.value)} style={{ flex: 1, fontSize: '12px', padding: '6px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px' }} />
            <button onClick={async () => {
              if (!tagInput || !onUpdate || managedTags.includes(tagInput)) return;
              setUpdating(true);
              await onUpdate([...managedTags, tagInput]);
              setTagInput('');
              setUpdating(false);
            }} disabled={updating || !tagInput} style={{ background: 'var(--text)', color: 'var(--bg)', border: 'none', borderRadius: '4px', padding: '6px 12px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>{updating ? '...' : 'AGGIUNGI'}</button>
            
            {managedTags.length > 0 && (
              <button onClick={async () => {
                if (!onUpdate) return;
                setUpdating(true);
                await onUpdate([]);
                setUpdating(false);
              }} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 12px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>RESETTA</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
