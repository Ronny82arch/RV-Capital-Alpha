/**
 * TBD MARKET — Feed dati H1 per lo scanner speculativo
 * Fonte CRYPTO: Binance API pubblica (gratuita, no key)
 * Fonte STOCK:  Twelve Data (placeholder key — da configurare a fine sviluppo)
 * Output: MarketDataSnapshot[] normalizzato per il TradingByDayEngine
 */

import { MarketDataSnapshot } from './trading-by-day';

// ─── CONFIG ───────────────────────────────────────────────────────────────────

// TODO: Aggiungere TWELVE_DATA_API_KEY nelle env vars Vercel quando pronto
const TWELVE_DATA_KEY = process.env.TWELVE_DATA_API_KEY ?? 'PLACEHOLDER_KEY';
const BINANCE_BASE    = 'https://api.binance.com/api/v3';
const TWELVE_BASE     = 'https://api.twelvedata.com';

// Paniere speculativo H1
const CRYPTO_ASSETS = [
  { symbol: 'BTCUSDT', name: 'BTC',  display: 'BTC/USDT' },
  { symbol: 'ETHUSDT', name: 'ETH',  display: 'ETH/USDT' },
  { symbol: 'SOLUSDT', name: 'SOL',  display: 'SOL/USDT' },
  { symbol: 'BNBUSDT', name: 'BNB',  display: 'BNB/USDT' },
];

const STOCK_ASSETS = [
  { symbol: 'NVDA', display: 'NVDA' },
  { symbol: 'AAPL', display: 'AAPL' },
];

// ─── CALCOLI STATISTICI ───────────────────────────────────────────────────────

function calcATR(candles: { h: number; l: number; c: number }[], period = 14): number {
  if (candles.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    trs.push(Math.max(
      candles[i].h - candles[i].l,
      Math.abs(candles[i].h - candles[i - 1].c),
      Math.abs(candles[i].l - candles[i - 1].c),
    ));
  }
  // Wilder's smoothing
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return atr;
}

function calcZScore(closes: number[], period = 22): number {
  if (closes.length < period) return 0;
  const slice = closes.slice(-period);
  const mean  = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  const std  = Math.sqrt(variance) || 1;
  return (closes[closes.length - 1] - mean) / std;
}

function calcCMO(closes: number[], period = 14): number {
  if (closes.length <= period) return 0;
  const clip = closes.slice(-(period + 1));
  let up = 0, down = 0;
  for (let i = 1; i < clip.length; i++) {
    const diff = clip[i] - clip[i - 1];
    if (diff > 0) up += diff; else down += Math.abs(diff);
  }
  const denom = up + down;
  return denom === 0 ? 0 : ((up - down) / denom) * 100;
}

function detectVolumeSpike(volumes: number[], threshold = 1.8): boolean {
  if (volumes.length < 20) return false;
  const avg = volumes.slice(-20, -1).reduce((a, b) => a + b, 0) / 19;
  return volumes[volumes.length - 1] > avg * threshold;
}

// ─── BINANCE CRYPTO H1 ────────────────────────────────────────────────────────

async function fetchBinanceCandlesH1(symbol: string): Promise<MarketDataSnapshot | null> {
  try {
    const url = `${BINANCE_BASE}/klines?symbol=${symbol}&interval=1h&limit=50`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const raw: number[][] = await res.json();
    if (!raw || raw.length < 25) return null;

    const candles = raw.map(k => ({
      h: parseFloat(k[2] as unknown as string),
      l: parseFloat(k[3] as unknown as string),
      c: parseFloat(k[4] as unknown as string),
      v: parseFloat(k[5] as unknown as string),
    }));

    const closes  = candles.map(c => c.c);
    const volumes = candles.map(c => c.v);

    return {
      asset:             symbol.replace('USDT', '/USDT'),
      currentPrice:      closes[closes.length - 1],
      atrH1:             calcATR(candles),
      zScoreH1:          Number(calcZScore(closes).toFixed(3)),
      chandeMomentumH1:  Number(calcCMO(closes).toFixed(2)),
      volumeSpike:       detectVolumeSpike(volumes),
      assetType:         'CRYPTO',
    };
  } catch {
    return null;
  }
}

// ─── TWELVE DATA STOCK H1 ─────────────────────────────────────────────────────

async function fetchTwelveDataH1(symbol: string): Promise<MarketDataSnapshot | null> {
  // Non chiamare se la key è placeholder
  if (TWELVE_DATA_KEY === 'PLACEHOLDER_KEY') return null;

  try {
    const url = `${TWELVE_BASE}/time_series?symbol=${symbol}&interval=1h&outputsize=50&apikey=${TWELVE_DATA_KEY}`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === 'error' || !data.values) return null;

    const values: { high: string; low: string; close: string; volume: string }[] =
      data.values.reverse(); // Twelve Data è in ordine decrescente

    const candles = values.map(v => ({
      h: parseFloat(v.high),
      l: parseFloat(v.low),
      c: parseFloat(v.close),
      v: parseFloat(v.volume),
    }));

    const closes  = candles.map(c => c.c);
    const volumes = candles.map(c => c.v);

    return {
      asset:             symbol,
      currentPrice:      closes[closes.length - 1],
      atrH1:             calcATR(candles),
      zScoreH1:          Number(calcZScore(closes).toFixed(3)),
      chandeMomentumH1:  Number(calcCMO(closes).toFixed(2)),
      volumeSpike:       detectVolumeSpike(volumes),
      assetType:         'STOCK',
    };
  } catch {
    return null;
  }
}

// ─── MOCK FALLBACK (quando le API non sono disponibili) ───────────────────────

function generateMockSnapshot(asset: string, assetType: 'CRYPTO' | 'STOCK'): MarketDataSnapshot {
  const basePrice = assetType === 'CRYPTO' ? 95000 + Math.random() * 5000 : 150 + Math.random() * 50;
  const zScore    = (Math.random() * 6) - 3; // [-3, +3]
  return {
    asset,
    currentPrice:     Number(basePrice.toFixed(2)),
    atrH1:            Number((basePrice * 0.008).toFixed(4)), // ~0.8% del prezzo
    zScoreH1:         Number(zScore.toFixed(3)),
    chandeMomentumH1: Number(((Math.random() * 140) - 70).toFixed(2)),
    volumeSpike:      Math.random() > 0.7,
    assetType,
  };
}

// ─── FETCHER PRINCIPALE ───────────────────────────────────────────────────────

export async function fetchAllTbdMarketData(): Promise<MarketDataSnapshot[]> {
  const results: MarketDataSnapshot[] = [];

  // Fetch crypto via Binance (sempre disponibile)
  const cryptoPromises = CRYPTO_ASSETS.map(a => fetchBinanceCandlesH1(a.symbol));
  const cryptoResults  = await Promise.allSettled(cryptoPromises);

  cryptoResults.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) {
      results.push(r.value);
    } else {
      // Fallback mock
      results.push(generateMockSnapshot(CRYPTO_ASSETS[i].display, 'CRYPTO'));
    }
  });

  // Fetch stocks via Twelve Data (quando key disponibile)
  const stockPromises = STOCK_ASSETS.map(a => fetchTwelveDataH1(a.symbol));
  const stockResults  = await Promise.allSettled(stockPromises);

  stockResults.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) {
      results.push(r.value);
    }
    // Se Twelve Data non disponibile, non aggiunge mock per stocks (dati poco realistici)
  });

  return results;
}

export { calcATR, calcZScore, calcCMO };
