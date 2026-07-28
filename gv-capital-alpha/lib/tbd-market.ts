/**
 * lib/tbd-market.ts — Dati di mercato H1 per TBD Hunter Mode
 * 
 * Fonti:
 * - Crypto: Binance API (klines H1, illimitato)
 * - Stocks: Polygon.io H1 (free tier 5 call/min) → fallback Yahoo Finance
 */

import { getAlphaWatchlist } from './market';

export interface TbdMarketData {
  asset: string;
  assetType: 'CRYPTO' | 'STOCK';
  currentPrice: number;
  atrH1: number;
  zScoreH1: number;
  chandeMomentumH1: number;
  volumeSpike: boolean;
  volumeSigma: number;
  bollingerSqueeze: boolean;
}

const BINANCE_BASE = 'https://api.binance.com/api/v3';
const POLYGON_KEY = process.env.POLYGON_API_KEY;

// ─── CALCOLO INDICATORI ─────────────────────────────────────────────────────

function calcSMA(values: number[], period: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { out.push(NaN); continue; }
    const slice = values.slice(i - period + 1, i + 1);
    out.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  return out;
}

function calcStd(values: number[], period: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { out.push(NaN); continue; }
    const slice = values.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    out.push(Math.sqrt(variance));
  }
  return out;
}

function calcATR(highs: number[], lows: number[], closes: number[], period: number = 14): number[] {
  const trs: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const h = highs[i], l = lows[i], prevC = closes[i - 1];
    trs.push(Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC)));
  }
  const atr: number[] = [];
  for (let i = 0; i < trs.length; i++) {
    if (i < period - 1) { atr.push(NaN); continue; }
    if (i === period - 1) {
      atr.push(trs.slice(0, period).reduce((a, b) => a + b, 0) / period);
    } else {
      atr.push((atr[atr.length - 1] * (period - 1) + trs[i]) / period);
    }
  }
  return atr;
}

function calcZScore(prices: number[], period: number = 20): number {
  if (prices.length < period) return 0;
  const slice = prices.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (prices[prices.length - 1] - mean) / std;
}

function calcChandeMomentum(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 0;
  let sumUp = 0, sumDown = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) sumUp += diff;
    else sumDown += Math.abs(diff);
  }
  const denom = sumUp + sumDown;
  return denom === 0 ? 0 : ((sumUp - sumDown) / denom) * 100;
}

function calcVolumeSigma(volumes: number[]): number {
  if (volumes.length < 21) return 0;
  const today = volumes[volumes.length - 1];
  const hist = volumes.slice(-21, -1);
  const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
  const variance = hist.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / hist.length;
  const std = Math.sqrt(variance);
  return std === 0 ? 0 : (today - mean) / std;
}

function detectBollingerSqueeze(prices: number[], period: number = 20, multiplier: number = 2): boolean {
  if (prices.length < period + 5) return false;
  const sma = calcSMA(prices, period);
  const std = calcStd(prices, period);
  const idx = prices.length - 1;
  const bandWidth = std[idx] * 2 * multiplier;
  const avgBandWidth = std.slice(-5).filter(v => !isNaN(v)).reduce((a, b) => a + b, 0) / 5 * 2 * multiplier;
  return bandWidth < avgBandWidth * 0.6; // squeeze se banda < 60% della media 5 periodi
}

// ─── FETCHER BINANCE (Crypto H1) ────────────────────────────────────────────

async function fetchBinanceH1(symbol: string, limit: number = 100): Promise<{
  prices: number[]; highs: number[]; lows: number[]; volumes: number[];
} | null> {
  try {
    const url = `${BINANCE_BASE}/klines?symbol=${symbol}USDT&interval=1h&limit=${limit}`;
    const res = await fetch(url, { next: { revalidate: 300 } } as any);
    if (!res.ok) return null;
    const raw: any[][] = await res.json();
    return {
      prices: raw.map(k => parseFloat(k[4])),
      highs: raw.map(k => parseFloat(k[2])),
      lows: raw.map(k => parseFloat(k[3])),
      volumes: raw.map(k => parseFloat(k[5])),
    };
  } catch (err) {
    console.error(`[Binance] Error ${symbol}:`, err);
    return null;
  }
}

// ─── FETCHER POLYGON (Stocks H1) ────────────────────────────────────────────

async function fetchPolygonH1(ticker: string, days: number = 30): Promise<{
  prices: number[]; highs: number[]; lows: number[]; volumes: number[];
} | null> {
  if (!POLYGON_KEY) return null;
  try {
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/hour/${from}/${to}?adjusted=true&sort=asc&apiKey=${POLYGON_KEY}`;
    const res = await fetch(url, { next: { revalidate: 300 } } as any);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.results) return null;
    return {
      prices: data.results.map((r: any) => r.c),
      highs: data.results.map((r: any) => r.h),
      lows: data.results.map((r: any) => r.l),
      volumes: data.results.map((r: any) => r.v),
    };
  } catch (err) {
    console.error(`[Polygon] Error ${ticker}:`, err);
    return null;
  }
}

// ─── FETCHER YAHOO FALLBACK ─────────────────────────────────────────────────

async function fetchYahooH1Fallback(symbol: string): Promise<{
  prices: number[]; highs: number[]; lows: number[]; volumes: number[];
} | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1h&range=1mo`;
    const res = await fetch(url, { next: { revalidate: 300 } } as any);
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;
    return {
      prices: result.indicators.quote[0].close.filter((v: any) => v !== null),
      highs: result.indicators.quote[0].high.filter((v: any) => v !== null),
      lows: result.indicators.quote[0].low.filter((v: any) => v !== null),
      volumes: result.indicators.quote[0].volume.filter((v: any) => v !== null),
    };
  } catch (err) {
    console.error(`[Yahoo] Error ${symbol}:`, err);
    return null;
  }
}

// ─── COSTRUZIONE SNAPSHOT ───────────────────────────────────────────────────

async function buildSnapshot(
  item: { symbol: string; type: 'CRYPTO' | 'STOCK' | 'ETF'; yahooSymbol?: string }
): Promise<TbdMarketData | null> {
  let raw: { prices: number[]; highs: number[]; lows: number[]; volumes: number[] } | null = null;

  if (item.type === 'CRYPTO') {
    raw = await fetchBinanceH1(item.symbol, 100);
  } else {
    raw = await fetchPolygonH1(item.yahooSymbol || item.symbol, 30);
    if (!raw) raw = await fetchYahooH1Fallback(item.yahooSymbol || item.symbol);
  }

  if (!raw || raw.prices.length < 30) return null;

  const { prices, highs, lows, volumes } = raw;
  const atrSeries = calcATR(highs, lows, prices, 14);
  const atr = atrSeries[atrSeries.length - 1] || 0;
  const zScore = calcZScore(prices, 20);
  const chande = calcChandeMomentum(prices, 14);
  const volSigma = calcVolumeSigma(volumes);
  const volumeSpike = volSigma >= 1.5;
  const squeeze = detectBollingerSqueeze(prices, 20, 2);

  return {
    asset: item.symbol,
    assetType: item.type === 'CRYPTO' ? 'CRYPTO' : 'STOCK',
    currentPrice: prices[prices.length - 1],
    atrH1: atr,
    zScoreH1: zScore,
    chandeMomentumH1: chande,
    volumeSpike,
    volumeSigma: volSigma,
    bollingerSqueeze: squeeze,
  };
}

// ─── API PUBBLICA ───────────────────────────────────────────────────────────

export async function fetchAllTbdMarketData(): Promise<TbdMarketData[]> {
  const watchlist = getAlphaWatchlist().filter(w =>
    ['NVDA','TSLA','AAPL','META','AMD','BTC','ETH','SOL','BNB','QQQ','SPY','IWM'].includes(w.symbol)
  );

  const results: TbdMarketData[] = [];

  for (const item of watchlist) {
    const snapshot = await buildSnapshot(item);
    if (snapshot) results.push(snapshot);
    // Rate limit rispettato: nessun delay necessario con batch piccoli (12 asset)
  }

  return results;
}

export async function fetchSingleTbdMarketData(symbol: string): Promise<TbdMarketData | null> {
  const watchlist = getAlphaWatchlist();
  const item = watchlist.find(w => w.symbol === symbol);
  if (!item) return null;
  return buildSnapshot(item);
}
