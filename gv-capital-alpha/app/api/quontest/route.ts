import { NextResponse } from 'next/server';
import { calculateAdvancedQuantSystem, MarketRegime } from '@/lib/quontest';
import { WATCHLIST } from '@/lib/market';

// ─── TIPI INTERNI ──────────────────────────────────────────────────────────────

interface HistoricalOHLCV {
  close: number[];
  high: number[];
  low: number[];
  volume: number[];
}

// ─── HELPER: Fetch storico deep da Yahoo Finance (150-200 giorni) ───────────────

async function fetchDeepHistory(ticker: string): Promise<HistoricalOHLCV | null> {
  const item = WATCHLIST.find(
    (w) => w.symbol.toUpperCase() === ticker.toUpperCase()
  );

  // Per asset crypto, usa CoinGecko con range esteso
  if (item?.type === 'CRYPTO' && item.coinId) {
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/${item.coinId}/market_chart?vs_currency=eur&days=200&interval=daily`,
        { next: { revalidate: 3600 } }
      );
      if (!res.ok) return null;
      const data = await res.json();

      const prices: [number, number][] = data.prices || [];
      const volumes: [number, number][] = data.total_volumes || [];

      const close = prices.map(([, p]) => p);
      const volume = volumes.map(([, v]) => v);

      // CoinGecko non restituisce high/low individuali nel market_chart:
      // si approssimano con ±0.5% del close (conservativo per ATR)
      const high = close.map((c) => c * 1.005);
      const low = close.map((c) => c * 0.995);

      return { close, high, low, volume };
    } catch {
      return null;
    }
  }

  // Per ETF e Stock, usa Yahoo Finance v8 con range 200 giorni
  const yahooSymbol = item?.yahooSymbol || ticker;
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=200d`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RV-Capital-Alpha/1.0)' },
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return null;

    const quote = result.indicators?.quote?.[0];
    const closes: (number | null)[] = quote?.close || [];
    const highs: (number | null)[] = quote?.high || [];
    const lows: (number | null)[] = quote?.low || [];
    const volumes: (number | null)[] = quote?.volume || [];

    // Filtra i valori null (giorni di chiusura mercato)
    const valid = closes
      .map((c, i) => ({ c, h: highs[i], l: lows[i], v: volumes[i] }))
      .filter((d) => d.c != null && d.h != null && d.l != null) as {
        c: number; h: number; l: number; v: number | null;
      }[];

    return {
      close: valid.map((d) => d.c),
      high: valid.map((d) => d.h),
      low: valid.map((d) => d.l),
      volume: valid.map((d) => d.v ?? 0),
    };
  } catch {
    return null;
  }
}

// ─── FALLBACK MOCK (usato solo se il fetch live fallisce) ──────────────────────

const MOCK_HISTORY: HistoricalOHLCV = {
  close: [
    88000, 88500, 89000, 88700, 89200, 89900, 90200, 91000, 90500, 91200,
    91000, 91500, 92000, 92400, 93000, 93500, 94000, 94200, 94800, 95400,
    95100, 95800,
  ],
  high: [
    88500, 89000, 89500, 89200, 89800, 90400, 90800, 91500, 91200, 91800,
    91500, 92000, 92500, 93000, 93500, 94200, 94500, 95000, 95500, 96000,
    95600, 96400,
  ],
  low: [
    87500, 88000, 88200, 88000, 88800, 89200, 89900, 90200, 90000, 90600,
    90500, 91000, 91200, 92000, 92200, 93000, 93800, 94000, 94200, 95000,
    94600, 95200,
  ],
  volume: [
    1100, 1300, 1400, 1050, 1250, 1600, 1450, 1800, 1200, 1500,
    1200, 1500, 1100, 1400, 1900, 2100, 1600, 1300, 1700, 2500,
    2100, 2900,
  ],
};

// ─── ENDPOINT GET ──────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = (searchParams.get('ticker') || 'BTC').toUpperCase();
  const regimeParam = searchParams.get('regime')?.toUpperCase();

  // Regime macro globale attivo — da mappare su CPI/GDP reali in futuro
  const currentGlobalRegime: MarketRegime = 'REFLATION';

  const activeRegime: MarketRegime = (
    ['GOLDILOCKS', 'REFLATION', 'STAGFLATION', 'DEFLATION'] as MarketRegime[]
  ).includes(regimeParam as MarketRegime)
    ? (regimeParam as MarketRegime)
    : currentGlobalRegime;

  // Fetch dati storici live (150-200 giorni), fallback su mock se non disponibili
  const liveHistory = await fetchDeepHistory(ticker);
  const history = liveHistory ?? MOCK_HISTORY;
  const dataSource = liveHistory ? 'live' : 'mock';

  const quantResult = calculateAdvancedQuantSystem(history, activeRegime);

  let sentimentMessage = 'Fase Neutrale — Consolidamento Quantitativo';
  if (quantResult.score >= 75) {
    sentimentMessage = 'Fortemente Rialzista — Setup Quantitativo ad Alta Probabilità Statistica';
  } else if (quantResult.score >= 55) {
    sentimentMessage = 'Moderatamente Rialzista — Momentum in Costruzione';
  } else if (quantResult.score <= 25) {
    sentimentMessage = 'Fortemente Ribassista — Distribuzione Istituzionale e Pressione in Vendita';
  } else if (quantResult.score <= 35) {
    sentimentMessage = 'Ribassista — Debolezza Strutturale, Monitorare i Livelli';
  }

  return NextResponse.json({
    success: true,
    dataSource,
    data: {
      ticker,
      score: quantResult.score,
      zScoreRaw: quantResult.zScoreRaw,
      regime: `${activeRegime} (Matrice Adattiva Quantaste)`,
      breakdown: {
        macro: activeRegime === 'GOLDILOCKS' || activeRegime === 'REFLATION' ? 85 : 35,
        trend: quantResult.breakdown.trend,
        momentum: quantResult.breakdown.momentum,
        valuation: quantResult.breakdown.valuation,
      },
      levels: quantResult.levels,
      sentiment: sentimentMessage,
    },
  });
}
