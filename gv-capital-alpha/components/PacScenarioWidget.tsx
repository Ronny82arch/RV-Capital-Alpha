'use client';
import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Target, ShieldCheck, Gift } from 'lucide-react';

interface Props {
  currentValue: number;
  currentAllocated: number;
}

export default function PacScenarioWidget({ currentValue, currentAllocated }: Props) {
  const [years, setYears] = useState<number>(10);
  const [monthlyDeposit, setMonthlyDeposit] = useState<number>(200);

  // Return rates
  const rates = {
    pessimistic: 0.03, // 3%
    real: 0.065,       // 6.5%
    optimistic: 0.10,  // 10%
  };

  const calculateScenario = (rate: number) => {
    let finalValue = currentValue;
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

    const totalInvested = currentAllocated + (monthlyDeposit * months);
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
            <div style={{ fontSize: '16px', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>€{real.totalInvested.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</div>
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
            <div style={{ fontSize: '24px', fontFamily: 'var(--font-mono)', fontWeight: '900', color: 'var(--text)' }}>€{real.gross.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</div>
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={{ background: 'var(--bg)', padding: '8px', borderRadius: '4px', borderLeft: '2px solid var(--red)' }}>
              <div style={{ fontSize: '9px', color: 'var(--text3)' }}>Netto con Liquidazione (Tasse 26%)</div>
              <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>€{real.netLiquidation.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</div>
            </div>
            <div style={{ background: 'var(--bg)', padding: '8px', borderRadius: '4px', borderLeft: '2px solid var(--green)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Gift size={10} color="var(--green)" />
                <span style={{ fontSize: '9px', color: 'var(--text3)' }}>Netto con Donazione (Esente)</span>
              </div>
              <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--green)' }}>€{real.netDonation.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</div>
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
          <div style={{ fontSize: '16px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', marginBottom: '4px' }}>€{pessimistic.gross.toLocaleString('it-IT', { maximumFractionDigits: 0 })} <span style={{ fontSize: '10px', fontWeight: 'normal', color: 'var(--text3)' }}>Lordo</span></div>
          <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>€{pessimistic.netLiquidation.toLocaleString('it-IT', { maximumFractionDigits: 0 })} <span style={{ fontSize: '10px', color: 'var(--text3)' }}>Netto Liq.</span></div>
          <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>€{pessimistic.netDonation.toLocaleString('it-IT', { maximumFractionDigits: 0 })} <span style={{ fontSize: '10px', color: 'var(--text3)' }}>Donazione</span></div>
        </div>
        
        {/* OPTIMISTIC */}
        <div style={{ background: 'var(--bg3)', padding: '12px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>Ottimistico ({(rates.optimistic*100).toFixed(1)}%)</span>
            <TrendingUp size={14} color="var(--green)" />
          </div>
          <div style={{ fontSize: '16px', fontFamily: 'var(--font-mono)', fontWeight: 'bold', marginBottom: '4px' }}>€{optimistic.gross.toLocaleString('it-IT', { maximumFractionDigits: 0 })} <span style={{ fontSize: '10px', fontWeight: 'normal', color: 'var(--text3)' }}>Lordo</span></div>
          <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>€{optimistic.netLiquidation.toLocaleString('it-IT', { maximumFractionDigits: 0 })} <span style={{ fontSize: '10px', color: 'var(--text3)' }}>Netto Liq.</span></div>
          <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>€{optimistic.netDonation.toLocaleString('it-IT', { maximumFractionDigits: 0 })} <span style={{ fontSize: '10px', color: 'var(--text3)' }}>Donazione</span></div>
        </div>
      </div>
    </div>
  );
}
