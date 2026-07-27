import { MarketData, WatchlistItem, AssetType } from '@/types';

const YAHOO_BASE = 'https://query1.finance.yahoo.com';
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

// ─── NUOVE ENV VAR ───────────────────────────────────────────────────────────
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const POLYGON_KEY = process.env.POLYGON_API_KEY;

// ─── WATCHLIST SEPARATE ──────────────────────────────────────────────────────

export const CORE_WATCHLIST: WatchlistItem[] = [
  { symbol: 'VWCE', name: 'Vanguard All-World ETF', type: 'ETF', yahooSymbol: 'VWCE.DE' },
  { symbol: 'SPY', name: 'S&P 500 ETF', type: 'ETF', yahooSymbol: 'SPY' },
  { symbol: 'QQQ', name: 'Nasdaq 100 ETF', type: 'ETF', yahooSymbol: 'QQQ' },
  { symbol: 'IWM', name: 'Russell 2000 ETF', type: 'ETF', yahooSymbol: 'IWM' },
  { symbol: 'GLD', name: 'Gold ETF', type: 'ETF', yahooSymbol: 'GLD' },
  { symbol: 'XLE', name: 'Energy Select Sector', type: 'ETF', yahooSymbol: 'XLE' },
  { symbol: 'COPX', name: 'Global Copper Miners', type: 'ETF', yahooSymbol: 'COPX' },
  { symbol: 'TLT', name: 'Treasury 20+ Year', type: 'ETF', yahooSymbol: 'TLT' },
  { symbol: 'SHY', name: 'Treasury 1-3 Year', type: 'ETF', yahooSymbol: 'SHY' },
  { symbol: 'LQD', name: 'Inv Grade Corporate', type: 'ETF', yahooSymbol: 'LQD' },
  { symbol: 'USRT', name: 'iShares U.S. REIT', type: 'ETF', yahooSymbol: 'USRT' },
  { symbol: 'EIMI', name: 'Emerging Markets', type: 'ETF', yahooSymbol: 'EIMI.DE' },
];

export const ALPHA_WATCHLIST: WatchlistItem[] = [
  // Tech
  { symbol: 'NVDA', name: 'NVIDIA', type: 'STOCK', yahooSymbol: 'NVDA' },
  { symbol: 'AAPL', name: 'Apple', type: 'STOCK', yahooSymbol: 'AAPL' },
  { symbol: 'MSFT', name: 'Microsoft', type: 'STOCK', yahooSymbol: 'MSFT' },
  { symbol: 'TSLA', name: 'Tesla', type: 'STOCK', yahooSymbol: 'TSLA' },
  { symbol: 'META', name: 'Meta', type: 'STOCK', yahooSymbol: 'META' },
  { symbol: 'AMD', name: 'AMD', type: 'STOCK', yahooSymbol: 'AMD' },
  { symbol: 'TSM', name: 'Taiwan Semiconductor', type: 'STOCK', yahooSymbol: 'TSM' },
  // Crypto
  { symbol: 'BTC', name: 'Bitcoin', type: 'CRYPTO', coinId: 'bitcoin' },
  { symbol: 'ETH', name: 'Ethereum', type: 'CRYPTO', coinId: 'ethereum' },
  { symbol: 'SOL', name: 'Solana', type: 'CRYPTO', coinId: 'solana' },
  { symbol: 'BNB', name: 'Binance Coin', type: 'CRYPTO', coinId: 'binancecoin' },
  // Index (per TBD/Satellite)
  { symbol: 'QQQ', name: 'Nasdaq 100 ETF', type: 'ETF', yahooSymbol: 'QQQ' },
  { symbol: 'SPY', name: 'S&P 500 ETF', type: 'ETF', yahooSymbol: 'SPY' },
  { symbol: 'IWM', name: 'Russell 2000 ETF', type: 'ETF', yahooSymbol: 'IWM' },
  // Finance
  { symbol: 'JPM', name: 'JPMorgan', type: 'STOCK', yahooSymbol: 'JPM' },
  { symbol: 'COIN', name: 'Coinbase', type: 'STOCK', yahooSymbol: 'COIN' },
  // Healthcare
  { symbol: 'LLY', name: 'Eli Lilly', type: 'STOCK', yahooSymbol: 'LLY' },
  { symbol: 'NVO', name: 'Novo Nordisk', type: 'STOCK', yahooSymbol: 'NVO' },
  // Consumi / Industria
  { symbol: 'MC.PA', name: 'LVMH', type: 'STOCK', yahooSymbol: 'MC.PA' },
  { symbol: 'CAT', name: 'Caterpillar', type: 'STOCK', yahooSymbol: 'CAT' },
  // Hedging
  { symbol: 'VIXY', name: 'VIX Short-Term', type: 'ETF', yahooSymbol: 'VIXY' },
  { symbol: 'SQQQ', name: 'Nasdaq -3x Inverse', type: 'ETF', yahooSymbol: 'SQQQ' },
];

// Unione per compatibilità legacy
export const WATCHLIST: WatchlistItem[] = [...CORE_WATCHLIST, ...ALPHA_WATCHLIST];

export function getAlphaWatchlist(): WatchlistItem[] {
  return ALPHA_WATCHLIST;
}

export function getCoreWatchlist(): WatchlistItem[] {
  return CORE_WATCHLIST;
}

// ─── EXCHANGE RATE CACHE ────────────────────────────────────────────────────────
let cachedUsdRate = 0.963;
let lastRateFetch = 0;

export async function getUsdToEurRate(): Promise<number> {
  if (Date.now() - lastRateFetch < 3600000) return cachedUsdRate; // 1 hour cache
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates && typeof data.rates.EUR === 'number') {
        cachedUsdRate = data.rates.EUR;
        lastRateFetch = Date.now();
        return cachedUsdRate;
      }
    }
  } catch (err: any) {
    console.warn('[market] Exchange rate fetch failed, using fallback:', err.message);
  }
  return cachedUsdRate;
}

// ─── YAHOO FINANCE ────────────────────────────────────────────────────────────
export async function fetchYahooFinance(item: WatchlistItem): Promise<MarketData | null> {
  const yahooSymbol = item.yahooSymbol || item.symbol;

  try {
    const url = `${YAHOO_BASE}/v8/finance/chart/${yahooSymbol}?interval=1d&range=90d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RV-Capital-Alpha/1.0)' },
      next: { revalidate: 5 },
    });

    if (!res.ok) return null;
    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const currency = meta.currency || 'USD';
    const rate = currency.toUpperCase() === 'USD' ? await getUsdToEurRate() : 1.0;

    const timestamps: number[] = result.timestamp || [];
    const closes: number[] = result.indicators?.quote?.[0]?.close || [];
    const highs: number[] = result.indicators?.quote?.[0]?.high || [];
    const lows: number[] = result.indicators?.quote?.[0]?.low || [];

    const history = timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().split('T')[0],
        close: closes[i] * rate,
        high: highs[i] * rate,
        low: lows[i] * rate
      }))
      .filter(h => h.close != null && h.close > 0);

    const currentPrice = (meta.regularMarketPrice || meta.previousClose) * rate;
    const prevClose = (meta.previousClose || currentPrice) * rate;

    return {
      symbol: item.symbol,
      name: item.name,
      type: item.type,
      price: currentPrice,
      change: currentPrice - prevClose,
      changePercent: ((currentPrice - prevClose) / prevClose) * 100,
      high24h: (meta.regularMarketDayHigh || currentPrice) * rate,
      low24h: (meta.regularMarketDayLow || currentPrice) * rate,
      volume: meta.regularMarketVolume || 0,
      history,
    };
  } catch {
    return null;
  }
}

// ─── COINGECKO ────────────────────────────────────────────────────────────────
export async function fetchCryptoData(item: WatchlistItem): Promise<MarketData | null> {
  if (!item.coinId) return null;

  try {
    const [priceRes, histRes] = await Promise.all([
      fetch(
        `${COINGECKO_BASE}/simple/price?ids=${item.coinId}&vs_currencies=eur&include_24hr_change=true&include_24hr_vol=true&include_24hr_high=true&include_24hr_low=true`,
        { next: { revalidate: 15 } }
      ),
      fetch(
        `${COINGECKO_BASE}/coins/${item.coinId}/market_chart?vs_currency=eur&days=90&interval=daily`,
        { next: { revalidate: 3600 } }
      ),
    ]);

    if (!priceRes.ok) return null;

    const priceData = await priceRes.json();
    const histData = histRes.ok ? await histRes.json() : { prices: [] };

    const coin = priceData[item.coinId!];
    if (!coin) return null;

    const currentPrice = coin.eur;
    const change24h = coin.eur_24h_change || 0;
    const previousPrice = currentPrice / (1 + change24h / 100);

    const closesForVol = (histData.prices || []).map(([, p]: [number, number]) => p);
    const returns = closesForVol.slice(1).map((c: number, i: number) => Math.abs(Math.log(c / closesForVol[i])));
    const avgDailyVol = returns.length > 0 ? returns.reduce((a: number, b: number) => a + b, 0) / returns.length : 0.02;

    const history = (histData.prices || []).map(([ts, price]: [number, number]) => ({
      date: new Date(ts).toISOString().split('T')[0],
      close: price,
      high: price * (1 + avgDailyVol),
      low: price * (1 - avgDailyVol),
    }));

    return {
      symbol: item.symbol,
      name: item.name,
      type: item.type,
      price: currentPrice,
      change: currentPrice - previousPrice,
      changePercent: change24h,
      high24h: coin.eur_24h_high || currentPrice * 1.05,
      low24h: coin.eur_24h_low || currentPrice * 0.95,
      volume: coin.eur_24h_vol || 0,
      history,
    };
  } catch {
    return null;
  }
}

// ─── UNIFIED FETCHER ──────────────────────────────────────────────────────────
export async function fetchMarketData(item: WatchlistItem): Promise<MarketData | null> {
  if (item.type === 'CRYPTO') return fetchCryptoData(item);
  return fetchYahooFinance(item);
}

export async function fetchAllMarketData(extraItems?: WatchlistItem[]): Promise<MarketData[]> {
  const list = extraItems ? [...WATCHLIST, ...extraItems] : WATCHLIST;
  const uniqueList = list.filter((item, index, self) =>
    self.findIndex(t => t.symbol === item.symbol) === index
  );
  
  const BATCH_SIZE = 5;
  const DELAY_MS = 500;
  const results: PromiseSettledResult<MarketData | null>[] = [];

  for (let i = 0; i < uniqueList.length; i += BATCH_SIZE) {
    const batch = uniqueList.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(batch.map(fetchMarketData));
    results.push(...batchResults);
    if (i + BATCH_SIZE < uniqueList.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  return results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => (r as PromiseFulfilledResult<MarketData>).value);
}

// ─── CURRENT PRICE LOOKUP ─────────────────────────────────────────────────────
export async function fetchCurrentPrice(symbol: string, type: AssetType): Promise<number | null> {
  const item = WATCHLIST.find(w => w.symbol === symbol);
  if (!item) return null;
  const data = await fetchMarketData(item);
  return data?.price ?? null;
}

export async function fetchLivePrice(symbol: string): Promise<number | null> {
  const item = WATCHLIST.find(w => w.symbol === symbol);
  let yahooSymbol = item?.yahooSymbol || symbol;
  if (yahooSymbol === 'GOLD') yahooSymbol = 'GC=F';
  else if (yahooSymbol === 'BTC') yahooSymbol = 'BTC-USD';
  else if (yahooSymbol === 'ETH') yahooSymbol = 'ETH-USD';
  else if (yahooSymbol === 'SOL') yahooSymbol = 'SOL-USD';

  try {
    const url = `${YAHOO_BASE}/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RV-Capital-Alpha/1.0)' },
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta;
    const currentPrice = meta.regularMarketPrice || meta.previousClose;
    const currency = meta.currency || 'USD';
    const rate = currency.toUpperCase() === 'USD' ? 0.92 : 1.0;
    return currentPrice * rate;
  } catch {
    return null;
  }
}

// ─── FETCH LUNGO PERIODO (per calibrazione storica) ──────────────────────────
// Usato SOLO da /api/cron/calibrate — non dal cron di scan giornaliero.
// 2 anni di storia per avere campioni statisticamente significativi per bucket.
async function fetchCryptoDataForCalibration(item: WatchlistItem): Promise<MarketData | null> {
  if (!item.coinId) return null;

  try {
    const [priceRes, histRes] = await Promise.all([
      fetch(
        `${COINGECKO_BASE}/simple/price?ids=${item.coinId}&vs_currencies=eur&include_24hr_change=true&include_24hr_vol=true&include_24hr_high=true&include_24hr_low=true`,
        { next: { revalidate: 86400 } }
      ),
      fetch(
        `${COINGECKO_BASE}/coins/${item.coinId}/market_chart?vs_currency=eur&days=730&interval=daily`,
        { next: { revalidate: 86400 } }
      ),
    ]);

    if (!priceRes.ok) return null;

    const priceData = await priceRes.json();
    const histData = histRes.ok ? await histRes.json() : { prices: [] };

    const coin = priceData[item.coinId!];
    if (!coin) return null;

    const currentPrice = coin.eur;
    const change24h = coin.eur_24h_change || 0;
    const previousPrice = currentPrice / (1 + change24h / 100);

    const closesForVol = (histData.prices || []).map(([, p]: [number, number]) => p);
    const returns = closesForVol.slice(1).map((c: number, i: number) => Math.abs(Math.log(c / closesForVol[i])));
    const avgDailyVol = returns.length > 0 ? returns.reduce((a: number, b: number) => a + b, 0) / returns.length : 0.02;

    const history = (histData.prices || []).map(([ts, price]: [number, number]) => ({
      date: new Date(ts).toISOString().split('T')[0],
      close: price,
      high: price * (1 + avgDailyVol), // ✅ FIX: banda proporzionale alla volatilità reale, non fissa
      low: price * (1 - avgDailyVol),
    }));

    return {
      symbol: item.symbol,
      name: item.name,
      type: item.type,
      price: currentPrice,
      change: currentPrice - previousPrice,
      changePercent: change24h,
      high24h: coin.eur_24h_high || currentPrice * 1.05,
      low24h: coin.eur_24h_low || currentPrice * 0.95,
      volume: coin.eur_24h_vol || 0,
      history,
    };
  } catch {
    return null;
  }
}

async function fetchYahooFinanceForCalibration(item: WatchlistItem): Promise<MarketData | null> {
  const yahooSymbol = item.yahooSymbol || item.symbol;
  try {
    const url = `${YAHOO_BASE}/v8/finance/chart/${yahooSymbol}?interval=1d&range=2y`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RV-Capital-Alpha/1.0)' },
      next: { revalidate: 86400 }, // cache 24h — dati solo per calibrazione offline
    });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const currency = meta.currency || 'USD';
    const rate = currency.toUpperCase() === 'USD' ? 0.92 : 1.0;

    const timestamps: number[] = result.timestamp || [];
    const closes: number[] = result.indicators?.quote?.[0]?.close || [];
    const highs:  number[] = result.indicators?.quote?.[0]?.high  || [];
    const lows:   number[] = result.indicators?.quote?.[0]?.low   || [];

    const history = timestamps
      .map((ts, i) => ({
        date:  new Date(ts * 1000).toISOString().split('T')[0],
        close: closes[i] * rate,
        high:  highs[i] * rate,
        low:   lows[i] * rate,
      }))
      .filter(h => h.close != null && h.close > 0);

    const currentPrice = (meta.regularMarketPrice || meta.previousClose) * rate;
    const prevClose    = (meta.previousClose || currentPrice) * rate;

    return {
      symbol: item.symbol, name: item.name, type: item.type,
      price: currentPrice,
      change: currentPrice - prevClose,
      changePercent: ((currentPrice - prevClose) / prevClose) * 100,
      high24h: (meta.regularMarketDayHigh || currentPrice) * rate,
      low24h:  (meta.regularMarketDayLow  || currentPrice) * rate,
      volume:  meta.regularMarketVolume  || 0,
      history,
    };
  } catch { return null; }
}

export async function fetchAllMarketDataForCalibration(extraItems?: WatchlistItem[]): Promise<MarketData[]> {
  const list = extraItems ? [...WATCHLIST, ...extraItems] : WATCHLIST;
  const uniqueList = list.filter((item, index, self) =>
    self.findIndex(t => t.symbol === item.symbol) === index
  );
  
  const BATCH_SIZE = 5;
  const DELAY_MS = 1000; // Un po' più lento per richieste a 2 anni
  const results: PromiseSettledResult<MarketData | null>[] = [];

  for (let i = 0; i < uniqueList.length; i += BATCH_SIZE) {
    const batch = uniqueList.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(item => item.type === 'CRYPTO' ? fetchCryptoDataForCalibration(item) : fetchYahooFinanceForCalibration(item))
    );
    results.push(...batchResults);
    if (i + BATCH_SIZE < uniqueList.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  return results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => (r as PromiseFulfilledResult<MarketData>).value);
}


// ─── NUOVI FETCHER ───────────────────────────────────────────────────────────

export async function fetchAlphaVantageHistory(
  symbol: string
): Promise<{ date: string; close: number; high: number; low: number }[] | null> {
  if (!ALPHA_VANTAGE_KEY) return null;
  try {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&outputsize=full&apikey=${ALPHA_VANTAGE_KEY}`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const data = await res.json();
    const series = data['Time Series (Daily)'];
    if (!series) return null;
    return Object.entries(series)
      .map(([date, values]: [string, any]) => ({
        date,
        close: parseFloat(values['5. adjusted close']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return null;
  }
}

export async function fetchPolygonAggregates(
  ticker: string,
  from: string,
  to: string,
  multiplier: number = 1,
  timespan: 'hour' | 'day' = 'hour'
): Promise<{ date: string; close: number; high: number; low: number; volume: number }[] | null> {
  if (!POLYGON_KEY) return null;
  try {
    const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&apiKey=${POLYGON_KEY}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.results) return null;
    return data.results.map((r: any) => ({
      date: new Date(r.t).toISOString(),
      close: r.c,
      high: r.h,
      low: r.l,
      volume: r.v,
    }));
  } catch {
    return null;
  }
}

// ─── FRED MACRO DATA ─────────────────────────────────────────────────────────

export async function fetchFredSeries(seriesId: string): Promise<{ date: string; value: number }[] | null> {
  const key = process.env.FRED_API_KEY;
  if (!key) return null;
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&file_type=json&api_key=${key}&sort_order=asc&observation_start=2020-01-01`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    const data = await res.json();
    if (!data.observations) return null;
    return data.observations
      .filter((o: any) => o.value !== '.')
      .map((o: any) => ({ date: o.date, value: parseFloat(o.value) }));
  } catch {
    return null;
  }
}

// Helper per leggere VIX attuale
export async function getCurrentVIX(): Promise<number | null> {
  const series = await fetchFredSeries('VIXCLS');
  return series && series.length > 0 ? series[series.length - 1].value : null;
}