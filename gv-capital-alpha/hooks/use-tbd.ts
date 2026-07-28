'use client';

import { useState, useCallback, useEffect } from 'react';

interface TbdScanResponse {
  success: boolean;
  circuitBreaker?: boolean;
  antigravityStatus?: string;
  tbdCapitalToday?: number;
  scannedAssets?: number;
  newSignals?: number;
  signals?: Array<{
    asset: string;
    direction: string;
    expectedPnL: number;
    qualityScore: number;
    riskReward: number;
  }>;
  message?: string;
  error?: string;
}

interface TbdStatus {
  riskBudget: number;
  tradesToday: number;
  maxTrades: number;
  streakLoss: number;
  nextScan: string;
  active: boolean;
}

export function useTbd() {
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<TbdScanResponse | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [tbdLog, setTbdLog] = useState<any>(null);

  const fetchTbdLog = useCallback(async () => {
    try {
      const res = await fetch('/api/tbd/log');
      const data = await res.json();
      if (data.success && data.data) {
        setTbdLog(data.data);
      }
    } catch (e) {
      console.warn('[useTbd] Errore fetch tbd log:', e);
    }
  }, []);

  const triggerScan = useCallback(async () => {
    try {
      setScanning(true);
      setScanError(null);
      const res = await fetch('/api/tbd/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ''}`,
        },
      });
      const data: TbdScanResponse = await res.json();
      if (data.success) {
        setLastScan(data);
        await fetchTbdLog(); // Ricarica il log per mostrare le posizioni aggiornate
      } else {
        setScanError(data.error || 'Scan fallito');
      }
      return data;
    } catch (err: any) {
      setScanError(err.message);
      return null;
    } finally {
      setScanning(false);
    }
  }, [fetchTbdLog]);

  const getStatus = useCallback(async (): Promise<TbdStatus | null> => {
    try {
      const res = await fetch('/api/tbd/status');
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    fetchTbdLog();
  }, [fetchTbdLog]);

  return {
    scanning,
    lastScan,
    scanError,
    triggerScan,
    getStatus,
    tbdLog,
    refreshTbd: fetchTbdLog,
  };
}
