'use client';

import React from 'react';
import { runMonteCarlo } from '@/lib/math/monte-carlo';

interface BucketProjection {
  name: string;
  allocationPct: number;
  currentValue: number;
  mu: number;      // return atteso annuo (es. 0.18 per 18%)
  sigma: number;   // volatilità annua (es. 0.25)
}

interface ProjectionCardProps {
  bucket: BucketProjection;
  years?: number;
}

export function ProjectionCard({ bucket, years = 1 }: ProjectionCardProps) {
  const result = runMonteCarlo(
    bucket.currentValue, 0, bucket.mu, bucket.sigma,
    years, undefined, 10000
  );

  const fmtPct = (v: number) => {
    const pct = ((v / bucket.currentValue) - 1) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
  };

  const p10 = ((result.p10 / bucket.currentValue) - 1) * 100;
  const p50 = ((result.p50 / bucket.currentValue) - 1) * 100;
  const p90 = ((result.p90 / bucket.currentValue) - 1) * 100;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">{bucket.name}</h3>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          {bucket.allocationPct}%
        </span>
      </div>

      <div className="mb-4">
        <div className="text-2xl font-bold text-slate-900">
          {bucket.currentValue.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
        </div>
        <div className="text-xs text-slate-500">Valore attuale</div>
      </div>

      <div className="space-y-4">
        {/* Barra mediana */}
        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>Proiezione annua (p50)</span>
            <span className={p50 >= 0 ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
              {fmtPct(result.p50)}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${Math.min(100, Math.max(5, (p50 + 25) / 50 * 100))}%` }}
            />
          </div>
        </div>

        {/* Range p10 / p90 */}
        <div className="flex justify-between text-xs">
          <div className="text-left">
            <div className="mb-0.5 text-slate-400">p10 (worst)</div>
            <div className="font-semibold text-rose-600">{fmtPct(result.p10)}</div>
          </div>
          <div className="text-center">
            <div className="mb-0.5 text-slate-400">mediana</div>
            <div className="font-semibold text-indigo-600">{fmtPct(result.p50)}</div>
          </div>
          <div className="text-right">
            <div className="mb-0.5 text-slate-400">p90 (best)</div>
            <div className="font-semibold text-emerald-600">{fmtPct(result.p90)}</div>
          </div>
        </div>

        {/* Box info */}
        <div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          <div className="flex justify-between">
            <span>Intervallo di confidenza:</span>
            <span className="font-medium text-slate-800">[{p10.toFixed(1)}%, {p90.toFixed(1)}%]</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>Probabilità anno positivo:</span>
            <span className="font-medium text-slate-800">{result.successRate.toFixed(0)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProjectionsDashboard({ buckets }: { buckets: BucketProjection[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {buckets.map(bucket => (
        <ProjectionCard key={bucket.name} bucket={bucket} />
      ))}
    </div>
  );
}
