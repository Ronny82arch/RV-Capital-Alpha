'use client';

import { useState, useCallback } from 'react';
import { Signal } from '@/lib/types';

interface SatelliteResponse {
  success: boolean;
  signalsGenerated?: number;
  topSignal?: Signal;
  error?: string;
}

export function useSatellite() {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<SatelliteResponse | null>(null);

  const triggerScan = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/cron/satellite-scan', {
        headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ''}` },
      });
      const data: SatelliteResponse = await res.json();
      setLastResult(data);
      return data;
    } catch (err: any) {
      const errRes = { success: false, error: err.message };
      setLastResult(errRes);
      return errRes;
    } finally {
      setLoading(false);
    }
  }, []);

  const approveSignal = useCallback(async (signalId: string) => {
    try {
      const res = await fetch('/api/signals/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId }),
      });
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  return {
    loading,
    lastResult,
    triggerScan,
    approveSignal,
  };
}
