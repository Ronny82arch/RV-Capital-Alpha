'use client';

import React, { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface Props {
  currentValue: number;
  label: string;
  history?: { date: string; totalValue: number; pnlPercent: number }[];
}

type FilterType = '1H' | '1D' | '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';

// Deterministic mock function that scales volatility and trend to the chosen time filter
function getDeterministicValue(currentValue: number, timeMs: number, nowMs: number, filter: FilterType) {
  const diffDays = (nowMs - timeMs) / (1000 * 60 * 60 * 24);
  
  let vol = 0.03;          // Volatilità massima
  let expectedGain = 0.02; // Pendenza del trend atteso
  
  switch (filter) {
    case '1H':
      vol = 0.0015;        // Fluttuazione massima 0.15%
      expectedGain = 0.0003;
      break;
    case '1D':
      vol = 0.006;         // Fluttuazione massima 0.6%
      expectedGain = 0.002;
      break;
    case '1W':
      vol = 0.018;         // Fluttuazione massima 1.8%
      expectedGain = 0.008;
      break;
    case '1M':
      vol = 0.04;          // Fluttuazione massima 4%
      expectedGain = 0.03;
      break;
    case '3M':
      vol = 0.08;
      expectedGain = 0.06;
      break;
    case '6M':
      vol = 0.15;
      expectedGain = 0.12;
      break;
    case 'YTD':
    case '1Y':
      vol = 0.22;
      expectedGain = 0.18;
      break;
    case 'ALL':
      vol = 0.35;
      expectedGain = 0.30;
      break;
  }

  // Calcolo del trend lineare
  const maxPeriodDays = filter === '1H' ? 1/24 : filter === '1D' ? 1 : filter === '1W' ? 7 : filter === '1M' ? 30 : filter === '3M' ? 90 : filter === '6M' ? 180 : 365;
  const progress = Math.min(1, Math.max(0, 1 - (diffDays / maxPeriodDays)));
  const trend = currentValue * (1 - expectedGain * (1 - progress));

  // Rumore multi-frequenza normalizzato
  const t = diffDays * (365 / maxPeriodDays); 
  const noise = Math.sin(t * 1.5) * 0.5 + Math.cos(t * 4.7) * 0.3 + Math.sin(t * 12.3) * 0.2;

  // Smorzamento del rumore vicino al tempo presente (now) per far coincidere la fine con currentValue
  const dampening = Math.min(1, diffDays * (20 / maxPeriodDays));
  
  return trend + (noise * currentValue * vol * dampening);
}

export default function ProfessionalChart({ currentValue, label, history }: Props) {
  const [filter, setFilter] = useState<FilterType>('1M');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const filteredData = useMemo(() => {
    const now = new Date();
    const nowMs = now.getTime();
    const msPerHour = 60 * 60 * 1000;
    const msPerDay = 24 * msPerHour;
    
    let cutoff = 0;
    let format = 'date'; // 'time' or 'date' or 'datetime'
    
    switch (filter) {
      case '1H': cutoff = nowMs - msPerHour; format = 'time'; break;
      case '1D': cutoff = nowMs - msPerDay; format = 'time'; break;
      case '1W': cutoff = nowMs - 7 * msPerDay; format = 'datetime'; break;
      case '1M': cutoff = nowMs - 30 * msPerDay; format = 'date'; break;
      case '3M': cutoff = nowMs - 90 * msPerDay; format = 'date'; break;
      case '6M': cutoff = nowMs - 180 * msPerDay; format = 'date'; break;
      case 'YTD': 
        cutoff = new Date(now.getFullYear(), 0, 1).getTime(); 
        format = 'date'; 
        break;
      case '1Y': cutoff = nowMs - 365 * msPerDay; format = 'date'; break;
      case 'ALL': cutoff = nowMs - 730 * msPerDay; format = 'date'; break;
    }
    
    const data = [];
    const isShortTerm = filter === '1H' || filter === '1D';

    // Parse and filter history safely to prevent NaN issues
    const historyPoints = history
      ? history
          .map(h => ({
            timestamp: new Date(h.date).getTime(),
            value: Number(h.totalValue),
          }))
          .filter(p => !isNaN(p.timestamp) && !isNaN(p.value))
          .sort((a, b) => a.timestamp - b.timestamp)
      : [];

    if (historyPoints.length > 0 && !isShortTerm) {
      // Append current live value as the final point
      if (historyPoints[historyPoints.length - 1].timestamp < nowMs) {
        historyPoints.push({ timestamp: nowMs, value: currentValue });
      }

      const points = 100;
      const step = (nowMs - cutoff) / (points - 1);

      for (let i = 0; i < points; i++) {
        const timeMs = cutoff + (step * i);
        const isLast = i === points - 1;
        
        let val = currentValue;

        if (isLast) {
          val = currentValue;
        } else {
          const firstPoint = historyPoints[0];
          if (timeMs < firstPoint.timestamp) {
            val = firstPoint.value;
          } else {
            let prevPoint = historyPoints[0];
            let nextPoint = null;
            for (let j = 0; j < historyPoints.length; j++) {
              if (historyPoints[j].timestamp <= timeMs) {
                prevPoint = historyPoints[j];
              } else {
                nextPoint = historyPoints[j];
                break;
              }
            }

            if (nextPoint && prevPoint) {
              const denom = nextPoint.timestamp - prevPoint.timestamp;
              if (denom === 0) {
                val = prevPoint.value;
              } else {
                const ratio = (timeMs - prevPoint.timestamp) / denom;
                val = prevPoint.value + ratio * (nextPoint.value - prevPoint.value);
              }
            } else {
              val = prevPoint.value;
            }
          }
        }

        const d = new Date(timeMs);
        let displayDate = '';
        if (format === 'time') {
          displayDate = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        } else if (format === 'datetime') {
          displayDate = `${d.toLocaleDateString('it-IT', { weekday: 'short' })} ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
        } else {
          displayDate = d.toLocaleDateString('it-IT', { month: 'short', day: 'numeric' });
        }

        data.push({
          timestamp: timeMs,
          value: isNaN(val) ? currentValue : val,
          displayDate
        });
      }
    } else {
      // High-fidelity simulation for short-term filters or sub-portfolios with no history
      const points = 100;
      const step = (nowMs - cutoff) / (points - 1);
      
      for (let i = 0; i < points; i++) {
        const timeMs = cutoff + (step * i);
        const isLast = i === points - 1;
        const val = isLast ? currentValue : getDeterministicValue(currentValue, timeMs, nowMs, filter);
        
        const d = new Date(timeMs);
        let displayDate = '';
        if (format === 'time') {
          displayDate = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        } else if (format === 'datetime') {
          displayDate = `${d.toLocaleDateString('it-IT', { weekday: 'short' })} ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
        } else {
          displayDate = d.toLocaleDateString('it-IT', { month: 'short', day: 'numeric' });
        }

        data.push({
          timestamp: timeMs,
          value: isNaN(val) ? currentValue : val,
          displayDate
        });
      }
    }
    return data;
  }, [currentValue, filter, history]);

  const minVal = filteredData.length > 0 ? Math.min(...filteredData.map(d => d.value)) : 0;
  const maxVal = filteredData.length > 0 ? Math.max(...filteredData.map(d => d.value)) : 0;
  const padding = maxVal === minVal
    ? (maxVal === 0 ? 10 : Math.abs(maxVal) * 0.1)
    : (maxVal - minVal) * 0.1;

  const startValue = filteredData[0]?.value || 0;
  const endValue = filteredData[filteredData.length - 1]?.value || 0;
  const pnl = endValue - startValue;
  const pnlPct = startValue > 0 ? (pnl / startValue) * 100 : 0;
  const isPositive = pnl >= 0;
  const color = isPositive ? '#00d4aa' : '#ef4444';

  if (!mounted) {
    return (
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginTop: '24px', height: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>Caricamento grafico...</span>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginTop: '24px', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        
        {/* TOP LEFT: PnL Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
            PORTAFOGLIO: {label.toUpperCase()}
          </div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
            €{endValue.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color }}>
            {isPositive ? '+' : ''}€{pnl.toFixed(0)} ({isPositive ? '+' : ''}{pnlPct.toFixed(2)}%)
            <span style={{ color: 'var(--text3)', fontWeight: 'normal', marginLeft: '6px' }}>{filter}</span>
            {(!history || history.length === 0) && (
              <span style={{ fontSize: '9px', background: '#f59e0b22', color: '#f59e0b', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px', fontWeight: 'bold' }}>DATI DIMOSTRATIVI</span>
            )}
          </div>
        </div>

        {/* TOP RIGHT: Filters */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg3)', padding: '4px', borderRadius: '8px' }}>
          {(['1H', '1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? 'var(--border)' : 'transparent',
                border: 'none',
                color: filter === f ? 'var(--text)' : 'var(--text3)',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: filter === f ? 'bold' : 'normal',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', height: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filteredData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis 
              dataKey="displayDate" 
              stroke="var(--text3)" 
              fontSize={11} 
              tickLine={false}
              axisLine={false}
              minTickGap={30}
            />
            <YAxis 
              domain={[minVal - padding, maxVal + padding]} 
              hide={true}
            />
            <Tooltip 
              contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
              itemStyle={{ color: 'var(--text)', fontWeight: 'bold' }}
              formatter={(value: any) => [`€${Number(value).toLocaleString('it-IT', { maximumFractionDigits: 0 })}`, 'Valore']}
              labelStyle={{ color: 'var(--text2)', marginBottom: '4px' }}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={color} 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorValue)" 
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
