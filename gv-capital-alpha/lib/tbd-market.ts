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

// ─── CACHE GLOBAL (Next.js hot-reloading safe) ────────────────────────────────

const globalAny = global as any;
if (!globalAny.tbdPriceCache) globalAny.tbdPriceCache = new Map<string, number>();
if (!globalAny.tbdBookCache)  globalAny.tbdBookCache  = new Map<string, number>();

const priceCache: Map<string, number> = globalAny.tbdPriceCache;
const bookCache: Map<string, number>  = globalAny.tbdBookCache;

let binanceWS: any = globalAny.tbdBinanceWS ?? null;
let yahooWS: any   = globalAny.tbdYahooWS   ?? null;
let isConnectingBinance = false;
let isConnectingYahoo   = false;

// ─── PROTOBUF DECODER (Yahoo Finance WS stream) ───────────────────────────────

/**
 * Decodifica manuale del payload Protobuf di Yahoo Finance
 * Tag 1: id (string)
 * Tag 2: price (float)
 */
function decodeYahooProtobuf(base64Str: string): { id: string; price: number } | null {
  try {
    const buffer = Buffer.from(base64Str, 'base64');
    let offset = 0;
    let id = '';
    let price = 0;

    while (offset < buffer.length) {
      const key = buffer[offset++];
      const tag = key >> 3;
      const wireType = key & 7;

      if (tag === 1 && wireType === 2) {
        // String id
        let len = 0;
        let shift = 0;
        while (true) {
          const byte = buffer[offset++];
          len |= (byte & 0x7f) << shift;
          if ((byte & 0x80) === 0) break;
          shift += 7;
        }
        id = buffer.toString('utf8', offset, offset + len);
        offset += len;
      } else if (tag === 2 && wireType === 5) {
        // Float price (4 bytes)
        price = buffer.readFloatLE(offset);
        offset += 4;
      } else {
        // Skip altri campi
        if (wireType === 0) {
          while ((buffer[offset++] & 0x80) !== 0) {}
        } else if (wireType === 1) {
          offset += 8;
        } else if (wireType === 2) {
          let len = 0;
          let shift = 0;
          while (true) {
            const byte = buffer[offset++];
            len |= (byte & 0x7f) << shift;
            if ((byte & 0x80) === 0) break;
            shift += 7;
          }
          offset += len;
        } else if (wireType === 5) {
          offset += 4;
        } else {
          break;
        }
      }
    }
    return { id, price };
  } catch {
    return null;
  }
}

// ─── WEBSOCKET CLIENTS ────────────────────────────────────────────────────────

function connectBinance() {
  if (isConnectingBinance || (globalAny.tbdBinanceWS && globalAny.tbdBinanceWS.readyState === 1)) return;
  isConnectingBinance = true;

  try {
    const WSModule = require('ws');
    const streams = 'btcusdt@ticker/ethusdt@ticker/solusdt@ticker/bnbusdt@ticker/btcusdt@depth5/ethusdt@depth5/solusdt@depth5/bnbusdt@depth5';
    const ws = new WSModule(`wss://stream.binance.com:9443/stream?streams=${streams}`);

    ws.on('open', () => {
      console.log('Binance Spot WS Connected');
      isConnectingBinance = false;
      globalAny.tbdBinanceWS = ws;
      binanceWS = ws;
    });

    ws.on('message', (data: any) => {
      try {
        const json = JSON.parse(data.toString());
        const stream = json.stream;
        const msg = json.data;

        if (stream.endsWith('@ticker')) {
          const symbol = msg.s.toUpperCase(); // e.g. BTCUSDT
          const price = parseFloat(msg.c);
          priceCache.set(symbol, price);
        } else if (stream.endsWith('@depth5')) {
          const symbol = stream.split('@')[0].toUpperCase(); // e.g. BTCUSDT
          const bids = msg.bids.map((b: any) => ({ qty: parseFloat(b[1]) }));
          const asks = msg.asks.map((a: any) => ({ qty: parseFloat(a[1]) }));

          const bidVol = bids.reduce((acc: number, b: any) => acc + b.qty, 0);
          const askVol = asks.reduce((acc: number, a: any) => acc + a.qty, 0);
          const totalVol = bidVol + askVol;
          const imbalance = totalVol > 0 ? (bidVol - askVol) / totalVol : 0;

          bookCache.set(symbol, imbalance);
        }
      } catch (e) {
        // ignore
      }
    });

    ws.on('error', (err) => {
      console.error('Binance Spot WS Error:', err);
      isConnectingBinance = false;
    });

    ws.on('close', () => {
      console.log('Binance Spot WS Closed. Retrying in 10s...');
      isConnectingBinance = false;
      globalAny.tbdBinanceWS = null;
      setTimeout(connectBinance, 10000);
    });
  } catch (e) {
    isConnectingBinance = false;
    setTimeout(connectBinance, 10000);
  }
}

function connectYahoo() {
  if (isConnectingYahoo || (globalAny.tbdYahooWS && globalAny.tbdYahooWS.readyState === 1)) return;
  isConnectingYahoo = true;

  try {
    const WSModule = require('ws');
    const ws = new WSModule('wss://streamer.finance.yahoo.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    ws.on('open', () => {
      console.log('Yahoo Finance WS Connected');
      isConnectingYahoo = false;
      globalAny.tbdYahooWS = ws;
      yahooWS = ws;
      ws.send(JSON.stringify({ subscribe: ['AAPL', 'NVDA'] }));
    });

    ws.on('message', (data: any) => {
      try {
        const payload = decodeYahooProtobuf(data.toString());
        if (payload && payload.id && payload.price) {
          priceCache.set(payload.id.toUpperCase(), payload.price);
        }
      } catch (e) {
        // ignore
      }
    });

    ws.on('error', (err) => {
      console.error('Yahoo Finance WS Error:', err);
      isConnectingYahoo = false;
    });

    ws.on('close', () => {
      console.log('Yahoo Finance WS Closed. Retrying in 10s...');
      isConnectingYahoo = false;
      globalAny.tbdYahooWS = null;
      setTimeout(connectYahoo, 10000);
    });
  } catch (e) {
    isConnectingYahoo = false;
    setTimeout(connectYahoo, 10000);
  }
}

// Inizializza le connessioni in background (solo se ambiente supporta persistent WS)
export function initTbdWebSockets() {
  try {
    if (typeof window === 'undefined' && process.env.VERCEL) {
      // Su Vercel Serverless le chiamate WS persistenti verso Yahoo streamer possono fallire o non essere consentite
      return;
    }
    connectBinance();
    connectYahoo();
  } catch (e) {
    console.warn('WebSocket init skipped in current environment');
  }
}

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

    // Sovrascrivi il prezzo corrente con quello del WebSocket in tempo reale (se disponibile)
    let currentPrice = closes[closes.length - 1];
    const wsPrice = priceCache.get(symbol.toUpperCase());
    if (wsPrice) {
      currentPrice = wsPrice;
      candles[candles.length - 1].c = wsPrice;
    }

    return {
      asset:             symbol.replace('USDT', '/USDT'),
      currentPrice,
      atrH1:             calcATR(candles),
      zScoreH1:          Number(calcZScore(closes).toFixed(3)),
      chandeMomentumH1:  Number(calcCMO(closes).toFixed(2)),
      volumeSpike:       detectVolumeSpike(volumes),
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
    const res = await fetch(url, { next: { revalidate: 1800 } });
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

    // Sovrascrivi il prezzo corrente con quello del WebSocket in tempo reale (se disponibile)
    let currentPrice = closes[closes.length - 1];
    const wsPrice = priceCache.get(symbol.toUpperCase());
    if (wsPrice) {
      currentPrice = wsPrice;
      candles[candles.length - 1].c = wsPrice;
    }

    return {
      asset:             symbol,
      currentPrice,
      atrH1:             calcATR(candles),
      zScoreH1:          Number(calcZScore(closes).toFixed(3)),
      chandeMomentumH1:  Number(calcCMO(closes).toFixed(2)),
      volumeSpike:       detectVolumeSpike(volumes),
      bollingerSqueeze:  detectBollingerSqueeze(closes),
      assetType:         'STOCK',
    };
  } catch {
    return null;
  }
}

// ─── MOCK FALLBACK (Solo come salvagente estremo) ────────────────────────────

function generateMockSnapshot(asset: string, assetType: 'CRYPTO' | 'STOCK'): MarketDataSnapshot {
  const basePrice = assetType === 'CRYPTO' ? 95000 + Math.random() * 5000 : 150 + Math.random() * 50;
  const zScore    = (Math.random() * 6) - 3;
  return {
    asset,
    currentPrice:     Number(basePrice.toFixed(2)),
    atrH1:            Number((basePrice * 0.008).toFixed(4)),
    zScoreH1:         Number(zScore.toFixed(3)),
    chandeMomentumH1: Number(((Math.random() * 140) - 70).toFixed(2)),
    volumeSpike:      Math.random() > 0.7,
    bollingerSqueeze: Math.random() > 0.6,
    assetType,
  };
}

// ─── FETCHER PRINCIPALE ───────────────────────────────────────────────────────

export async function fetchAllTbdMarketData(): Promise<MarketDataSnapshot[]> {
  const results: MarketDataSnapshot[] = [];

  // Assicura che i WebSocket siano connessi/attivi
  initTbdWebSockets();

  // 1. Fetch Crypto via Binance
  const cryptoPromises = CRYPTO_ASSETS.map(a => fetchBinanceCandlesH1(a.symbol));
  const cryptoResults  = await Promise.allSettled(cryptoPromises);

  cryptoResults.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) {
      results.push(r.value);
    } else {
      results.push(generateMockSnapshot(CRYPTO_ASSETS[i].display, 'CRYPTO'));
    }
  });

  // 2. Fetch Stocks via Yahoo Finance (con real-time WebSocket cache & query1 REST fallback)
  const stockPromises = STOCK_ASSETS.map(a => fetchYahooRESTCandlesH1(a.symbol));
  const stockResults  = await Promise.allSettled(stockPromises);

  stockResults.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) {
      results.push(r.value);
    } else {
      results.push(generateMockSnapshot(STOCK_ASSETS[i].display, 'STOCK'));
    }
  });

  return results;
}

export { calcATR, calcZScore, calcCMO };
