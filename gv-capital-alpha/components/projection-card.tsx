'use client';

import React from 'react';
import { BucketProjection } from '@/lib/types';
import { useApp, formatCurrency, formatPercent } from './providers';

interface ProjectionCardProps {
  name: string;
  allocationPct: number;
  currentValue: number;
  projection?: BucketProjection;
  color: string;
}

export function ProjectionCard({ name, allocationPct, currentValue, projection, color }: ProjectionCardProps) {
  const { hideValues } = useApp();

  const p10pct = projection ? ((projection.p10 / currentValue) - 1) * 100 : 0;
  const p50pct = projection ? ((projection.p50 / currentValue) - 1) * 100 : 0;
  const p90pct = projection ? ((projection.p90 / currentValue) - 1) * 100 : 0;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm transition-all hover:shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">{name}</h3>
        </div>
        <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
          {allocationPct}%
        </span>
      </div>

      <div className="mb-4">
        <div className="text-2xl font-bold text-slate-900 dark:text-white">
          {formatCurrency(currentValue, hideValues)}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">Valore attuale</div>
      </div>

      {projection ? (
        <div className="space-y-4">
          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Proiezione annua (p50)</span>
              <span className={p50pct >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-rose-600 dark:text-rose-400 font-medium'}>
                {formatPercent(p50pct, hideValues)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.max(5, (p50pct + 30) / 60 * 100))}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>

          <div className="flex justify-between text-xs">
            <div className="text-left">
              <div className="mb-0.5 text-slate-400 dark:text-slate-500">p10 worst</div>
              <div className="font-semibold text-rose-600 dark:text-rose-400">{formatPercent(p10pct, hideValues)}</div>
            </div>
            <div className="text-center">
              <div className="mb-0.5 text-slate-400 dark:text-slate-500">mediana</div>
              <div className="font-semibold text-indigo-600 dark:text-indigo-400">{formatPercent(p50pct, hideValues)}</div>
            </div>
            <div className="text-right">
              <div className="mb-0.5 text-slate-400 dark:text-slate-500">p90 best</div>
              <div className="font-semibold text-emerald-600 dark:text-emerald-400">{formatPercent(p90pct, hideValues)}</div>
            </div>
          </div>

          <div className="mt-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>Intervallo confidenza:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">[{formatPercent(p10pct, hideValues)}, {formatPercent(p90pct, hideValues)}]</span>
            </div>
            <div className="flex justify-between mt-1">
              <span>Probabilità anno positivo:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{projection.successRate.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-4 text-center text-xs text-slate-400">
          Calibrazione in corso...
        </div>
      )}
    </div>
  );
}
