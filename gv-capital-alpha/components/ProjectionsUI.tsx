'use client';

import React from 'react';
import { runMonteCarlo, type MonteCarloResult } from '@/lib/monte-carlo';

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
  /** Proiezione pre-calcolata dal cron (opzionale — fallback a calcolo live) */
  cached?: MonteCarloResult;
}

export function ProjectionCard({ bucket, years = 1, cached }: ProjectionCardProps) {
  // Usa la proiezione pre-calcolata dal cron se disponibile, altrimenti calcola live
  const result: MonteCarloResult = cached ?? runMonteCarlo(
    bucket.currentValue, 0, bucket.mu, bucket.sigma,
    years, undefined, 10000
  );

  const fmtEur = (v: number) =>
    v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

  const fmtPct = (v: number) => {
    const pct = ((v / bucket.currentValue) - 1) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
  };

  const p10pct = ((result.p10 / bucket.currentValue) - 1) * 100;
  const p50pct = ((result.p50 / bucket.currentValue) - 1) * 100;
  const p90pct = ((result.p90 / bucket.currentValue) - 1) * 100;

  // Normalizza la barra mediana: 0% → 50%, range ±50%
  const barWidth = Math.min(100, Math.max(5, (p50pct + 50) / 100 * 100));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">{bucket.name}</h3>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          {bucket.allocationPct}%
        </span>
      </div>

      {/* Valore attuale */}
      <div className="mb-4">
        <div className="text-2xl font-bold text-slate-900">{fmtEur(bucket.currentValue)}</div>
        <div className="text-xs text-slate-500">Valore attuale</div>
      </div>

      <div className="space-y-4">
        {/* Barra mediana */}
        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>Proiezione {years === 1 ? 'annua' : `${years}a`} (p50)</span>
            <span className={p50pct >= 0 ? 'font-medium text-emerald-600' : 'font-medium text-rose-600'}>
              {fmtPct(result.p50)}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>

        {/* Range p10 / p50 / p90 */}
        <div className="flex justify-between text-xs">
          <div className="text-left">
            <div className="mb-0.5 text-slate-400">p10 (pessimista)</div>
            <div className="font-semibold text-rose-600">{fmtPct(result.p10)}</div>
          </div>
          <div className="text-center">
            <div className="mb-0.5 text-slate-400">mediana</div>
            <div className="font-semibold text-indigo-600">{fmtPct(result.p50)}</div>
          </div>
          <div className="text-right">
            <div className="mb-0.5 text-slate-400">p90 (ottimista)</div>
            <div className="font-semibold text-emerald-600">{fmtPct(result.p90)}</div>
          </div>
        </div>

        {/* Box info */}
        <div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          <div className="flex justify-between">
            <span>Intervallo 80% CI:</span>
            <span className="font-medium text-slate-800">
              [{p10pct.toFixed(1)}%, {p90pct.toFixed(1)}%]
            </span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>P(rendimento &gt; 0):</span>
            <span className="font-medium text-slate-800">{result.successRate.toFixed(0)}%</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>Rendimento medio atteso:</span>
            <span className="font-medium text-slate-800">{fmtPct(result.mean)}</span>
          </div>
          {!isNaN(result.maxDrawdown) && (
            <div className="mt-1 flex justify-between">
              <span>Max drawdown medio:</span>
              <span className="font-medium text-rose-600">-{result.maxDrawdown.toFixed(1)}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProjectionsDashboard({
  buckets,
  cachedProjections,
  years = 1,
}: {
  buckets: BucketProjection[];
  cachedProjections?: Record<string, MonteCarloResult>;
  years?: number;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {buckets.map(bucket => (
        <ProjectionCard
          key={bucket.name}
          bucket={bucket}
          years={years}
          cached={cachedProjections?.[bucket.name]}
        />
      ))}
    </div>
  );
}
