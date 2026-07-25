'use client';
import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Target, Gift } from 'lucide-react';

interface Props {
  currentValue?: number;
  currentAllocated?: number;
}

function fmt(val: any): string {
  const n = Number(val);
  if (isNaN(n)) return '0';
  return n.toLocaleString('it-IT', { maximumFractionDigits: 0 });
}

export default function PacScenarioWidget({ currentValue = 0, currentAllocated = 0 }: Props) {
  const [years, setYears] = useState<number>(10);
  const [monthlyDeposit, setMonthlyDeposit] = useState<number>(200);

  const safeCurrentVal = Number(currentValue) || 0;
  const safeCurrentAllocated = Number(currentAllocated) || 0;

  // Return rates
  const rates = {
    pessimistic: 0.03, // 3%
    real: 0.065,       // 6.5%
    optimistic: 0.10,  // 10%
  };

  const calculateScenario = (rate: number) => {
    let finalValue = safeCurrentVal;
    const monthlyRate = rate / 12;
    const months = years * 12;
    
    // Future value of current sum
    finalValue = finalValue * Math.pow(1 + monthlyRate, months);
    
    // Future value of monthly deposits
    if (monthlyRate > 0) {
      finalValue += monthlyDeposit * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
    } else {
      finalValue += monthlyDeposit * months;
    }

    const totalInvested = safeCurrentAllocated + (monthlyDeposit * months);
    const grossProfit = finalValue - totalInvested;
    const tax = grossProfit > 0 ? grossProfit * 0.26 : 0; // 26% tax on profit
    
    return {
      gross: finalValue,
      totalInvested,
      grossProfit,
      netLiquidation: finalValue - tax,
      netDonation: finalValue // Donation up to 1M is tax exempt
    };
  };

  const pessimistic = calculateScenario(rates.pessimistic);
  const real = calculateScenario(rates.real);
  const optimistic = calculateScenario(rates.optimistic);

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Target size={24} color="var(--blue)" />
        <h2 style={{ fontSize: '18px', margin: 0, fontFamily: 'var(--font-mono)' }}>Simulatore Scenari PAC</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* INPUTS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg3)', padding: '16px', borderRadius: '8px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: '6px' }}>
              ORIZZONTE TEMPORALE ({years} ANNI)
            </label>
            <input 
              type="range" 
              min="1" max="40" 
              value={years} 
              onChange={e => setYears(Number(e.target.value))} 
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: '6px' }}>
              QUOTA MENSILE PREVISTA
            </label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
              <span style={{ padding: '8px 12px', color: 'var(--text3)', borderRight: '1px solid var(--border)' }}>€</span>
              <input 
                type="number" 
                value={monthlyDeposit} 
                onChange={e => setMonthlyDeposit(Number(e.target.value))} 
                style={{ flex: 1, padding: '8px', border: 'none', background: 'transparent', color: 'var(--text)', fontSize: '14px', fontFamily: 'var(--font-mono)' }}
              />
            </div>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px dashed var(--border)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text3)' }}>Capitale totale investito a fine piano:</div>
            <div style={{ fontSize: '16px', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>€{fmt(real.totalInvested)}</div>
          </div>
        </div>

        {/* REAL SCENARIO (HIGHLIGHTED) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(0, 212, 170, 0.1))', padding: '16px', borderRadius: '8px', border: '1px solid var(--blue)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: 'var(--blue)', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>SCENARIO REALE ({(rates.real*100).toFixed(1)}%)</span>
            <TrendingUp size={16} color="var(--blue)" />
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text3)' }}>Lordo stimato</div>
            <div style={{ fontSize: '24px', fontFamily: 'var(--font-mono)', fontWeight: '900', color: 'var(--text)' }}>€{fmt(real.gross)}</div>
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={{ background: 'var(--bg)', padding: '8px', borderRadius: '4px', borderLeft: '2px solid var(--red)' }}>
              <div style={{ fontSize: '9px', color: 'var(--text3)' }}>Netto con Liquidazione (Tasse 26%)</div>
              <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>€{fmt(real.netLiquidation)}</div>
            </div>
            <div style={{ background: 'var(--bg)', padding: '8px', borderRadius: '4px', borderLeft: '2px solid var(--green)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Gift size={10} color="var(--green)" />
                <span style={{ fontSize: '9px', color: 'var(--text3)' }}>Netto con Donazione (Esente)</span>
              </div>
              <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--green)' }}>€{fmt(real.netDonation)}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* PESSIMISTIC */}
        <div style={{ background: 'var(--bg3)', padding: '12px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>Pessimistico ({(rates.pessimistic*100).toFixed(1)}%)</span>
            <TrendingDown size={14} color="var(--red)" />
          </div>
          <div style={{ fontSize: '16px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', marginBottom: '4px' }}>€{fmt(pessimistic.gross)} <span style={{ fontSize: '10px', fontWeight: 'normal', color: 'var(--text3)' }}>Lordo</span></div>
          <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>€{fmt(pessimistic.netLiquidation)} <span style={{ fontSize: '10px', color: 'var(--text3)' }}>Netto Liq.</span></div>
          <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>€{fmt(pessimistic.netDonation)} <span style={{ fontSize: '10px', color: 'var(--text3)' }}>Donazione</span></div>
        </div>
        
        {/* OPTIMISTIC */}
        <div style={{ background: 'var(--bg3)', padding: '12px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>Ottimistico ({(rates.optimistic*100).toFixed(1)}%)</span>
            <TrendingUp size={14} color="var(--green)" />
          </div>
          <div style={{ fontSize: '16px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', marginBottom: '4px' }}>€{fmt(optimistic.gross)} <span style={{ fontSize: '10px', fontWeight: 'normal', color: 'var(--text3)' }}>Lordo</span></div>
          <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>€{fmt(optimistic.netLiquidation)} <span style={{ fontSize: '10px', color: 'var(--text3)' }}>Netto Liq.</span></div>
          <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>€{fmt(optimistic.netDonation)} <span style={{ fontSize: '10px', color: 'var(--text3)' }}>Donazione</span></div>
        </div>
      </div>
    </div>
  );
}
