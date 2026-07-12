/**
 * GET /api/quontest?ticker=NVDA&regime=REFLATION
 * Analisi quantitativa stile Quantaste.
 * FIX: regime non più hardcodato — letto da env NEXT_PUBLIC_MARKET_REGIME
 * (override tramite query param ?regime=STAGFLATION per test manuali).
 */

import { NextResponse } from 'next/server';
import { calculateAdvancedQuantSystem, getActiveRegime, detectMacroRegime, MarketRegime } from '@/lib/quontest';
import { WATCHLIST } from '@/lib/market';

interface HistoricalOHLCV { close: number[]; high: number[]; low: number[]; volume: number[]; }

async function fetchDeepHistory(ticker: string): Promise<HistoricalOHLCV | null> {
  const item = WATCHLIST.find(w => w.symbol.toUpperCase() === ticker.toUpperCase());

  if (item?.type === 'CRYPTO' && item.coinId) {
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/${item.coinId}/market_chart?vs_currency=eur&days=200&interval=daily`,
        { next: { revalidate: 3600 } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const close  = (data.prices  || []).map(([, p]: [number, number]) => p);
      const volume = (data.total_volumes || []).map(([, v]: [number, number]) => v);
      return { close, high: close.map((c: number) => c * 1.005), low: close.map((c: number) => c * 0.995), volume };
    } catch { return null; }
  }

  const yahooSymbol = item?.yahooSymbol || ticker;
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=200d`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RV-Capital-Alpha/1.0)' }, next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const json   = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return null;
    const q = result.indicators?.quote?.[0];
    const valid = (q?.close || [])
      .map((c: number|null, i: number) => ({ c, h: q.high[i], l: q.low[i], v: q.volume[i] }))
      .filter((d: {c:number|null}) => d.c != null) as { c:number; h:number; l:number; v:number }[];
    return { close: valid.map(d=>d.c), high: valid.map(d=>d.h), low: valid.map(d=>d.l), volume: valid.map(d=>d.v??0) };
  } catch { return null; }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = (searchParams.get('ticker') || 'BTC').toUpperCase();
  const regimeOverride = searchParams.get('regime')?.toUpperCase();
  const activeRegime = getActiveRegime(regimeOverride);

  // Resolve AUTO regime
  let targetRegime: 'GOLDILOCKS' | 'REFLATION' | 'STAGFLATION' | 'DEFLATION' = 'REFLATION';
  let growthUp = true;
  let inflationUp = true;
  let isAuto = false;

  if (activeRegime === 'AUTO') {
    isAuto = true;
    const detection = await detectMacroRegime();
    targetRegime = detection.regime;
    growthUp = detection.growthUp;
    inflationUp = detection.inflationUp;
  } else {
    targetRegime = activeRegime;
  }

  const history = await fetchDeepHistory(ticker);
  if (!history || history.close.length < 22) {
    return NextResponse.json({ success: false, error: `Dati insufficienti per ${ticker}` }, { status: 404 });
  }

  const result = calculateAdvancedQuantSystem(history, targetRegime);

  let sentiment = 'Fase Neutrale — Consolidamento Quantitativo';
  if (result.score >= 75)      sentiment = 'Fortemente Rialzista — Setup Quantitativo ad Alta Probabilità';
  else if (result.score >= 55) sentiment = 'Moderatamente Rialzista — Momentum in Costruzione';
  else if (result.score <= 25) sentiment = 'Fortemente Ribassista — Distribuzione Istituzionale';
  else if (result.score <= 35) sentiment = 'Ribassista — Debolezza Strutturale';

  return NextResponse.json({
    success: true,
    dataSource: 'live',
    data: {
      ticker, 
      score: result.score, 
      zScoreRaw: result.zScoreRaw,
      regime: isAuto ? `AUTO (${targetRegime})` : targetRegime,
      detectedRegime: targetRegime,
      growthUp,
      inflationUp,
      breakdown: { trend: result.breakdown.trend, momentum: result.breakdown.momentum, valuation: result.breakdown.valuation },
      levels: result.levels,
      sentiment,
    },
  });
}
