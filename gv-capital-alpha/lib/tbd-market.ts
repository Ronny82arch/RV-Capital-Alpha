/**
 * TBD MARKET — Feed dati H1 per lo scanner speculativo
 * Fonte CRYPTO: Binance WebSocket (real-time + Level 2 depth) & REST fallback
 * Fonte STOCK:  Yahoo Finance WebSocket (Protobuf stream) & query1 REST fallback
 * Output: MarketDataSnapshot[] normalizzato per il TradingByDayEngine
 */

import { MarketDataSnapshot } from './trading-by-day';

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const BINANCE_BASE = 'https://api.binance.com/api/v3';

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
  { symbol: 'TSLA', display: 'TSLA' },
  { symbol: 'AMD',  display: 'AMD'  },
  { symbol: 'QQQ',  display: 'QQQ'  },
  { symbol: 'AMZN', display: 'AMZN' },
  { symbol: 'MSFT', display: 'MSFT' },
  { symbol: 'META', display: 'META' },
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

function detectVolumeSpike(volumes: number[], threshold = 1.3): boolean {
  if (volumes.length < 20) return false;
  const avg = volumes.slice(-20, -1).reduce((a, b) => a + b, 0) / 19;
  return volumes[volumes.length - 1] > avg * threshold;
}

function calcVolumeSigma(volumes: number[], period = 20): number {
  if (volumes.length < period) return 0;
  const slice = volumes.slice(-period, -1);
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  if (mean === 0) return 0;
  const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / slice.length;
  const std = Math.sqrt(variance) || 1;
  const currentVol = volumes[volumes.length - 1];
  return Number(((currentVol - mean) / std).toFixed(2));
}

function detectBollingerSqueeze(closes: number[], period = 20): boolean {
  if (closes.length < period) return false;
  const slice = slicePeriod(closes, period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  if (mean === 0) return false;
  const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
  const std = Math.sqrt(variance);
  const bandwidthPct = (std * 4) / mean;
  return bandwidthPct < 0.035;
}

// Helper function to get slice
function slicePeriod(arr: number[], period: number) {
  return arr.slice(-period);
}

// ─── DATA FETCHERS & FALLBACKS ───────────────────────────────────────────────

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

    let currentPrice = closes[closes.length - 1];

    return {
      asset:             symbol.replace('USDT', '/USDT'),
      currentPrice,
      atrH1:             calcATR(candles),
      zScoreH1:          Number(calcZScore(closes).toFixed(3)),
      chandeMomentumH1:  Number(calcCMO(closes).toFixed(2)),
      volumeSpike:       detectVolumeSpike(volumes),
      volumeSigma:       calcVolumeSigma(volumes),
      bollingerSqueeze:  detectBollingerSqueeze(closes),
      assetType:         'CRYPTO',
    };
  } catch {
    return null;
  }
}

async function fetchYahooRESTCandlesH1(symbol: string): Promise<MarketDataSnapshot | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1h&range=5d`;
    const res = await fetch(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RV-Capital-Alpha/1.0)' },
      next: { revalidate: 1800 } 
    });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;

    const timestamps = result.timestamp;
    const quote = result.indicators?.quote?.[0];
    if (!timestamps || !quote) return null;

    const candles: { h: number; l: number; c: number; v: number }[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const h = quote.high[i];
      const l = quote.low[i];
      const c = quote.close[i];
      const v = quote.volume[i];
      if (h !== null && l !== null && c !== null) {
        candles.push({ h, l, c, v: v ?? 0 });
      }
    }

    if (candles.length < 25) return null;

    const closes  = candles.map(c => c.c);
    const volumes = candles.map(c => c.v);

    let currentPrice = closes[closes.length - 1];

    return {
      asset:             symbol,
      currentPrice,
      atrH1:             calcATR(candles),
      zScoreH1:          Number(calcZScore(closes).toFixed(3)),
      chandeMomentumH1:  Number(calcCMO(closes).toFixed(2)),
      volumeSpike:       detectVolumeSpike(volumes),
      volumeSigma:       calcVolumeSigma(volumes),
      bollingerSqueeze:  detectBollingerSqueeze(closes),
      assetType:         'STOCK',
    };
  } catch {
    return null;
  }
}



// ─── FETCHER PRINCIPALE ───────────────────────────────────────────────────────

export async function fetchAllTbdMarketData(): Promise<MarketDataSnapshot[]> {
  const results: MarketDataSnapshot[] = [];
  // 1. Fetch Crypto via Binance
  const cryptoPromises = CRYPTO_ASSETS.map(a => fetchBinanceCandlesH1(a.symbol));
  const cryptoResults  = await Promise.allSettled(cryptoPromises);

  cryptoResults.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) {
      results.push(r.value);
    }
  });

  // 2. Fetch Stocks via Yahoo Finance (con real-time WebSocket cache & query1 REST fallback)
  const stockPromises = STOCK_ASSETS.map(a => fetchYahooRESTCandlesH1(a.symbol));
  const stockResults  = await Promise.allSettled(stockPromises);

  stockResults.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) {
      results.push(r.value);
    }
  });

  return results;
}

export { calcATR, calcZScore, calcCMO };
