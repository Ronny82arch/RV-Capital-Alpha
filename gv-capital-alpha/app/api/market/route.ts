import { NextResponse } from 'next/server';
import { fetchAllMarketData, WATCHLIST } from '@/lib/market';
import { getPortfolio, updatePositionPrices } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const portfolio = await getPortfolio();
    
    // Extract unique symbols from portfolio positions that are not in the default WATCHLIST
    const watchlistSymbols = new Set(WATCHLIST.map(w => w.symbol));
    const extraItems: any[] = [];
    
    if (portfolio && portfolio.positions) {
      const added = new Set<string>();
      portfolio.positions.forEach(pos => {
        if (!watchlistSymbols.has(pos.symbol) && !added.has(pos.symbol)) {
          added.add(pos.symbol);
          let coinId: string | undefined;
          let yahooSymbol: string | undefined;
const TICKER_TO_COINGECKO_ID: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  ADA: 'cardano', XRP: 'ripple', DOGE: 'dogecoin', DOT: 'polkadot',
  MATIC: 'matic-network', AVAX: 'avalanche-2', LINK: 'chainlink',
  LTC: 'litecoin', UNI: 'uniswap', ATOM: 'cosmos', XLM: 'stellar',
  ALGO: 'algorand', TRX: 'tron', ETC: 'ethereum-classic', FIL: 'filecoin',
  APT: 'aptos', ARB: 'arbitrum', OP: 'optimism', NEAR: 'near',
};

          if (pos.type === 'CRYPTO') {
            const ticker = pos.symbol.toUpperCase();
            coinId = TICKER_TO_COINGECKO_ID[ticker];
            if (!coinId) {
              console.warn(`[market] Nessun ID CoinGecko noto per il ticker "${ticker}" — prezzo live non aggiornato per questa posizione, verrà usato l'ultimo prezzo salvato.`);
            }
          } else {
            yahooSymbol = pos.symbol;
          }
          extraItems.push({
            symbol: pos.symbol,
            name: pos.name,
            type: pos.type,
            yahooSymbol,
            coinId
          });
        }
      });
    }

    const marketData = await fetchAllMarketData(extraItems);

    // Update open position prices
    const updates = portfolio.positions
      .filter(p => p.status === 'OPEN')
      .map(p => {
        const md = marketData.find(m => m.symbol === p.symbol);
        return md ? { positionId: p.id, currentPrice: md.price } : null;
      })
      .filter(Boolean) as { positionId: string; currentPrice: number }[];

    if (updates.length > 0) {
      await updatePositionPrices(updates);
    }

    return NextResponse.json({ success: true, data: marketData });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
