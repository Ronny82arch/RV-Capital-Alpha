'use client';

import { useState, useEffect, useCallback } from 'react';
import { PortfolioState, CustomPortfolio } from '@/lib/types';

interface PortfolioResponse {
  success: boolean;
  data?: PortfolioState;
  portfolio?: PortfolioState; // For redundancy
  error?: string;
}

export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<PortfolioState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/portfolio', {
        headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ''}` },
      });
      const data: PortfolioResponse = await res.json();
      const p = data.data || data.portfolio;
      
      if (data.success && p) {
        // Map string[] customPortfolios to CustomPortfolio[] objects dynamically
        const rawPortfolios = p.customPortfolios || [];
        p.customPortfolios = rawPortfolios.map((item: any, idx: number) => {
          if (typeof item === 'string') {
            const openPositions = p.positions?.filter((pos: any) => pos.portfolio === item && pos.status === 'OPEN') || [];
            const val = openPositions.reduce((acc: number, pos: any) => acc + ((pos.capitalAllocated || 0) + (pos.unrealizedPnl || 0)), 0);
            const target = p.targets?.[item] ?? 10;
            const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#06b6d4'];
            return {
              name: item,
              targetAllocationPct: target,
              currentValue: val,
              color: colors[idx % colors.length]
            };
          }
          return item;
        });

        setPortfolio(p);
        setError(null);
      } else {
        setError(data.error || 'Errore caricamento portfolio');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Aggiorna portfolio (mutazioni atomiche)
  const updatePortfolio = useCallback(async (updates: Partial<PortfolioState>) => {
    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        setPortfolio(prev => prev ? { ...prev, ...updates, _version: (prev._version || 0) + 1 } : null);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // Crea/aggiungi portfolio custom
  const addCustomPortfolio = useCallback(async (name: string, targetAllocationPct: number, color?: string) => {
    try {
      const res = await fetch('/api/portfolio/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, targetAllocationPct, color }),
      });
      const data = await res.json();
      const p = data.data || data.portfolio;
      if (data.success && p) {
        // Map string[] to CustomPortfolio[]
        const rawPortfolios = p.customPortfolios || [];
        p.customPortfolios = rawPortfolios.map((item: any, idx: number) => {
          if (typeof item === 'string') {
            const openPositions = p.positions?.filter((pos: any) => pos.portfolio === item && pos.status === 'OPEN') || [];
            const val = openPositions.reduce((acc: number, pos: any) => acc + ((pos.capitalAllocated || 0) + (pos.unrealizedPnl || 0)), 0);
            const target = p.targets?.[item] ?? 10;
            const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#06b6d4'];
            return {
              name: item,
              targetAllocationPct: target,
              currentValue: val,
              color: colors[idx % colors.length]
            };
          }
          return item;
        });

        setPortfolio(p);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [fetchPortfolio]);

  // Elimina portfolio custom
  const removeCustomPortfolio = useCallback(async (name: string) => {
    try {
      const res = await fetch(`/api/portfolio/custom?name=${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      const p = data.data || data.portfolio;
      if (data.success && p) {
        // Map string[] to CustomPortfolio[]
        const rawPortfolios = p.customPortfolios || [];
        p.customPortfolios = rawPortfolios.map((item: any, idx: number) => {
          if (typeof item === 'string') {
            const openPositions = p.positions?.filter((pos: any) => pos.portfolio === item && pos.status === 'OPEN') || [];
            const val = openPositions.reduce((acc: number, pos: any) => acc + ((pos.capitalAllocated || 0) + (pos.unrealizedPnl || 0)), 0);
            const target = p.targets?.[item] ?? 10;
            const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#06b6d4'];
            return {
              name: item,
              targetAllocationPct: target,
              currentValue: val,
              color: colors[idx % colors.length]
            };
          }
          return item;
        });

        setPortfolio(p);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [fetchPortfolio]);

  useEffect(() => {
    fetchPortfolio();
    // Polling ogni 30 secondi per prezzi aggiornati
    const interval = setInterval(fetchPortfolio, 30000);
    return () => clearInterval(interval);
  }, [fetchPortfolio]);

  return {
    portfolio,
    loading,
    error,
    refresh: fetchPortfolio,
    updatePortfolio,
    addCustomPortfolio,
    removeCustomPortfolio,
  };
}
