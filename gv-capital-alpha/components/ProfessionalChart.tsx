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
}

type FilterType = '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';

// Generate a random walk ending at currentValue
function generateMockHistory(currentValue: number, days: number) {
  const data = [];
  let val = currentValue * 0.7; // Start 30% lower 1 year ago (assuming some growth)
  const now = new Date();
  
  // To make it look realistic, we'll use a sine wave + random noise + upward trend
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    
    // As we get closer to day 0 (today), value approaches currentValue
    const progress = (days - i) / days;
    const trend = currentValue * 0.7 + (currentValue * 0.3 * progress);
    const noise = (Math.random() - 0.5) * (currentValue * 0.05);
    const sine = Math.sin(progress * Math.PI * 4) * (currentValue * 0.02);
    
    const dayVal = i === 0 ? currentValue : trend + noise + sine;
    
    data.push({
      date: d.toISOString().split('T')[0],
      timestamp: d.getTime(),
      value: dayVal,
      displayDate: d.toLocaleDateString('it-IT', { month: 'short', day: 'numeric' })
    });
  }
  return data;
}

export default function ProfessionalChart({ currentValue, label }: Props) {
  const [filter, setFilter] = useState<FilterType>('1M');
  
  // Memoize history so it doesn't regenerate on every re-render unless currentValue changes significantly
  const fullHistory = useMemo(() => generateMockHistory(currentValue, 365), [Math.round(currentValue / 1000)]);

  const filteredData = useMemo(() => {
    const now = new Date().getTime();
    const msPerDay = 24 * 60 * 60 * 1000;
    let cutoff = 0;
    
    switch (filter) {
      case '1W': cutoff = now - 7 * msPerDay; break;
      case '1M': cutoff = now - 30 * msPerDay; break;
      case '3M': cutoff = now - 90 * msPerDay; break;
      case '6M': cutoff = now - 180 * msPerDay; break;
      case 'YTD': 
        const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();
        cutoff = startOfYear;
        break;
      case '1Y': cutoff = now - 365 * msPerDay; break;
      case 'ALL': cutoff = 0; break;
    }
    
    return fullHistory.filter(d => d.timestamp >= cutoff);
  }, [fullHistory, filter]);

  const minVal = Math.min(...filteredData.map(d => d.value));
  const maxVal = Math.max(...filteredData.map(d => d.value));
  const padding = (maxVal - minVal) * 0.1;

  const startValue = filteredData[0]?.value || 0;
  const endValue = filteredData[filteredData.length - 1]?.value || 0;
  const isPositive = endValue >= startValue;
  const color = isPositive ? '#00d4aa' : '#ef4444'; // var(--green) or var(--red)

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
            ANDAMENTO PORTAFOGLIO: {label.toUpperCase()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg3)', padding: '4px', borderRadius: '8px' }}>
          {(['1W', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'] as FilterType[]).map(f => (
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
              hide={true} // We hide the Y axis for a cleaner look, value is in tooltip
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
