import { NextResponse } from 'next/server';
import { getPortfolio, syncEtoroPortfolio, savePortfolio, recalcPortfolio } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (process.env.ETORO_API_KEY && process.env.ETORO_USER_KEY) {
      const portfolio = await getPortfolio();
      const isMock = portfolio.positions.some(p => /^d\d+$/.test(p.id));
      if (isMock) {
        console.log('[API portfolio] Dati mock rilevati. Avvio sincronizzazione automatica eToro...');
        await syncEtoroPortfolio();
      }
    }

    const portfolio = await getPortfolio();

    // Aggiornamento saldo eToro in tempo reale ad ogni GET se le chiavi sono presenti!
    if (process.env.ETORO_API_KEY && process.env.ETORO_USER_KEY) {
      try {
        const { getEtoroBalance } = await import('@/lib/etoro');
        const balance = await getEtoroBalance();
        if (balance && typeof balance.AvailableBalance === 'number') {
          let updated = false;
          if (portfolio.capitalAvailable !== balance.AvailableBalance) {
            portfolio.capitalAvailable = balance.AvailableBalance;
            updated = true;
          }
          if (balance.TotalEquity && balance.TotalEquity > 0 && portfolio.totalValue !== balance.TotalEquity) {
            portfolio.totalValue = balance.TotalEquity;
            updated = true;
          }
          if (updated) {
            await recalcPortfolio(portfolio);
            if (balance.TotalEquity && balance.TotalEquity > 0) {
              portfolio.totalValue = balance.TotalEquity;
            }
            await savePortfolio(portfolio);
          }
        }
      } catch (e) {
        console.warn('[API portfolio] Impossibile aggiornare saldo eToro live:', e);
      }
    }

    // Aggiornamento dei prezzi in tempo reale su ogni chiamata GET!
    if (portfolio.positions && portfolio.positions.length > 0) {
      const openPositions = portfolio.positions.filter(p => p.status === 'OPEN' && !p.id.startsWith('etoro_mirror_'));
      if (openPositions.length > 0) {
        const uniqueSymbols = Array.from(new Set(openPositions.map(p => p.symbol)));
        const { fetchLivePrice } = await import('@/lib/market');
        const priceMap = new Map<string, number>();
        await Promise.all(uniqueSymbols.map(async (symbol) => {
          try {
            const price = await fetchLivePrice(symbol);
            if (price !== null) priceMap.set(symbol, price);
          } catch {}
        }));

        let changed = false;
        portfolio.positions.forEach(pos => {
          if (pos.status === 'OPEN' && !pos.id.startsWith('etoro_mirror_')) {
            const livePrice = priceMap.get(pos.symbol);
            if (livePrice !== undefined && livePrice !== pos.currentPrice) {
              pos.currentPrice = livePrice;
              pos.unrealizedPnl = pos.action === 'BUY'
                ? (livePrice - pos.entryPrice) * pos.quantity
                : (pos.entryPrice - livePrice) * pos.quantity;
              pos.unrealizedPnlPercent = pos.capitalAllocated > 0 ? (pos.unrealizedPnl / pos.capitalAllocated) * 100 : 0;
              changed = true;
            }
          }
        });

        if (changed) {
          await recalcPortfolio(portfolio);
          await savePortfolio(portfolio);
        }
      }
    }

    return NextResponse.json({ success: true, data: portfolio });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // no-op if body is empty or not JSON
    }

    if (body.type === 'update_capital_base' || body.type === 'update_deposited_funds') {
      const val = body.depositedFunds ?? body.capitalBase;
      const portfolio = await getPortfolio();
      portfolio.depositedFunds = val;
      await recalcPortfolio(portfolio);
      await savePortfolio(portfolio);
      return NextResponse.json({ success: true, message: 'Fondi depositati aggiornati', data: portfolio });
    }

    if (body.type === 'update_exclude_copy_trading') {
      const { excludeCopyTrading } = body;
      const portfolio = await getPortfolio();
      portfolio.excludeCopyTrading = excludeCopyTrading;
      await recalcPortfolio(portfolio);
      await savePortfolio(portfolio);
      return NextResponse.json({ success: true, message: excludeCopyTrading ? 'Copy trading escluso' : 'Copy trading incluso', data: portfolio });
    }

    if (body.type === 'update_portfolio_targets') {
      const { targets } = body;
      const portfolio = await getPortfolio();
      portfolio.targets = targets;
      await savePortfolio(portfolio);
      return NextResponse.json({ success: true, message: 'Target aggiornati', data: portfolio });
    }

    if (body.type === 'update_ai_mode') {
      const { aiMode } = body;
      const portfolio = await getPortfolio();
      portfolio.aiMode = aiMode;
      await savePortfolio(portfolio);
      return NextResponse.json({ success: true, message: `Modalità AI aggiornata a ${aiMode}`, data: portfolio });
    }

    if (!process.env.ETORO_API_KEY || !process.env.ETORO_USER_KEY) {
      return NextResponse.json({ success: false, error: 'Chiavi API eToro non configurate' }, { status: 400 });
    }
    console.log('[API portfolio] Richiesta sincronizzazione manuale eToro...');
    await syncEtoroPortfolio();
    const portfolio = await getPortfolio();
    return NextResponse.json({ success: true, data: portfolio });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

// DELETE: wipe all positions and portfolios - then re-sync from eToro clean
export async function DELETE() {
  try {
    const { defaultPortfolio } = await import('@/lib/storage');
    const portfolio = defaultPortfolio();
    await savePortfolio(portfolio);

    // If eToro keys available, immediately re-sync
    if (process.env.ETORO_API_KEY && process.env.ETORO_USER_KEY) {
      await syncEtoroPortfolio();
    }

    const fresh = await getPortfolio();
    return NextResponse.json({ success: true, message: 'Portfolio resettato e risincronizzato', data: fresh });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
