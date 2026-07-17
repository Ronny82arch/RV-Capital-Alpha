import { MarketData, WatchlistItem, AssetType } from '@/types';

const YAHOO_BASE = 'https://query1.finance.yahoo.com';
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

// ─── WATCHLIST ────────────────────────────────────────────────────────────────
export const WATCHLIST: WatchlistItem[] = [
  // Safe ETF base (10)
  { symbol: 'VWCE', name: 'Vanguard All-World ETF', type: 'ETF', yahooSymbol: 'VWCE.DE' },
  { symbol: 'SPY', name: 'S&P 500 ETF', type: 'ETF', yahooSymbol: 'SPY' },
  { symbol: 'QQQ', name: 'Nasdaq 100 ETF', type: 'ETF', yahooSymbol: 'QQQ' },
  { symbol: 'GLD', name: 'Gold ETF', type: 'ETF', yahooSymbol: 'GLD' },
  { symbol: 'XDWD', name: 'iShares MSCI World ETF', type: 'ETF', yahooSymbol: 'XDWD.DE' },
  { symbol: 'EIMI', name: 'iShares MSCI Emerging Markets ETF', type: 'ETF', yahooSymbol: 'EIMI.DE' },
  { symbol: 'IUSN', name: 'iShares MSCI World Small Cap ETF', type: 'ETF', yahooSymbol: 'IUSN.DE' },
  { symbol: 'INRG', name: 'iShares Global Clean Energy ETF', type: 'ETF', yahooSymbol: 'INRG.DE' },
  { symbol: 'USRT', name: 'iShares U.S. REIT ETF', type: 'ETF', yahooSymbol: 'USRT' },
  { symbol: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF', type: 'ETF', yahooSymbol: 'TLT' },

  // Big Tech & Semiconductors (12)
  { symbol: 'NVDA', name: 'NVIDIA', type: 'STOCK', yahooSymbol: 'NVDA' },
  { symbol: 'MSFT', name: 'Microsoft', type: 'STOCK', yahooSymbol: 'MSFT' },
  { symbol: 'AAPL', name: 'Apple', type: 'STOCK', yahooSymbol: 'AAPL' },
  { symbol: 'META', name: 'Meta', type: 'STOCK', yahooSymbol: 'META' },
  { symbol: 'AMZN', name: 'Amazon', type: 'STOCK', yahooSymbol: 'AMZN' },
  { symbol: 'TSLA', name: 'Tesla', type: 'STOCK', yahooSymbol: 'TSLA' },
  { symbol: 'GOOGL', name: 'Alphabet (Google)', type: 'STOCK', yahooSymbol: 'GOOGL' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', type: 'STOCK', yahooSymbol: 'AMD' },
  { symbol: 'AVGO', name: 'Broadcom', type: 'STOCK', yahooSymbol: 'AVGO' },
  { symbol: 'ASML', name: 'ASML Holding', type: 'STOCK', yahooSymbol: 'ASML' },
  { symbol: 'NFLX', name: 'Netflix', type: 'STOCK', yahooSymbol: 'NFLX' },
  { symbol: 'SMCI', name: 'Super Micro Computer', type: 'STOCK', yahooSymbol: 'SMCI' },

  // Finanza (6)
  { symbol: 'JPM', name: 'JPMorgan Chase', type: 'STOCK', yahooSymbol: 'JPM' },
  { symbol: 'BAC', name: 'Bank of America', type: 'STOCK', yahooSymbol: 'BAC' },
  { symbol: 'V', name: 'Visa', type: 'STOCK', yahooSymbol: 'V' },
  { symbol: 'MA', name: 'Mastercard', type: 'STOCK', yahooSymbol: 'MA' },
  { symbol: 'GS', name: 'Goldman Sachs', type: 'STOCK', yahooSymbol: 'GS' },
  { symbol: 'COIN', name: 'Coinbase', type: 'STOCK', yahooSymbol: 'COIN' },

  // Healthcare (6)
  { symbol: 'LLY', name: 'Eli Lilly', type: 'STOCK', yahooSymbol: 'LLY' },
  { symbol: 'NVO', name: 'Novo Nordisk', type: 'STOCK', yahooSymbol: 'NVO' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', type: 'STOCK', yahooSymbol: 'JNJ' },
  { symbol: 'UNH', name: 'UnitedHealth Group', type: 'STOCK', yahooSymbol: 'UNH' },
  { symbol: 'MRK', name: 'Merck & Co.', type: 'STOCK', yahooSymbol: 'MRK' },
  { symbol: 'PFE', name: 'Pfizer', type: 'STOCK', yahooSymbol: 'PFE' },

  // Consumi (6)
  { symbol: 'MC.PA', name: 'LVMH', type: 'STOCK', yahooSymbol: 'MC.PA' },
  { symbol: 'NKE', name: 'Nike', type: 'STOCK', yahooSymbol: 'NKE' },
  { symbol: 'KO', name: 'Coca-Cola', type: 'STOCK', yahooSymbol: 'KO' },
  { symbol: 'PEP', name: 'PepsiCo', type: 'STOCK', yahooSymbol: 'PEP' },
  { symbol: 'COST', name: 'Costco', type: 'STOCK', yahooSymbol: 'COST' },
  { symbol: 'WMT', name: 'Walmart', type: 'STOCK', yahooSymbol: 'WMT' },

  // Industria / Energia (4)
  { symbol: 'XOM', name: 'ExxonMobil', type: 'STOCK', yahooSymbol: 'XOM' },
  { symbol: 'CVX', name: 'Chevron', type: 'STOCK', yahooSymbol: 'CVX' },
  { symbol: 'CAT', name: 'Caterpillar', type: 'STOCK', yahooSymbol: 'CAT' },
  { symbol: 'GE', name: 'General Electric', type: 'STOCK', yahooSymbol: 'GE' },

  // Cryptovalute (6)
  { symbol: 'BTC', name: 'Bitcoin', type: 'CRYPTO', coinId: 'bitcoin' },
  { symbol: 'ETH', name: 'Ethereum', type: 'CRYPTO', coinId: 'ethereum' },
  { symbol: 'SOL', name: 'Solana', type: 'CRYPTO', coinId: 'solana' },
  { symbol: 'BNB', name: 'Binance Coin', type: 'CRYPTO', coinId: 'binancecoin' },
  { symbol: 'ADA', name: 'Cardano', type: 'CRYPTO', coinId: 'cardano' },
  { symbol: 'XRP', name: 'Ripple', type: 'CRYPTO', coinId: 'ripple' },
];
// (Fetch API logic...)
// (Lines between 25 and 131 remain unchanged)


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
    const rate = currency.toUpperCase() === 'USD' ? 0.92 : 1.0;

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

    const history = (histData.prices || []).map(([ts, price]: [number, number]) => ({
      date: new Date(ts).toISOString().split('T')[0],
      close: price,
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
  const results = await Promise.allSettled(uniqueList.map(fetchMarketData));
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

    const history = (histData.prices || []).map(([ts, price]: [number, number]) => ({
      date: new Date(ts).toISOString().split('T')[0],
      close: price,
      high: price * 1.005, // Mock high/low for crypto history since CoinGecko doesn't provide it
      low: price * 0.995,
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
  const results = await Promise.allSettled(
    uniqueList.map(item =>
      item.type === 'CRYPTO' ? fetchCryptoDataForCalibration(item) : fetchYahooFinanceForCalibration(item)
    )
  );
  return results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => (r as PromiseFulfilledResult<MarketData>).value);
}
