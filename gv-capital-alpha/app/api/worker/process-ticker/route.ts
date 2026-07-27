import { NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { WATCHLIST, fetchMarketData } from '@/lib/market';
import {
  calculateRSI, calculateSMA, calculateMomentum, calculateVolatility, calculateATR,
  estimateFallbackWinProbability, calculateKelly, calculatePositionSize,
} from '@/lib/kelly';
import { lookupCalibratedProbability } from '@/lib/backtest';
import { getCalibrationTable, getPortfolio, addSignal, generateId } from '@/lib/storage';
import { Signal } from '@/types';

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
});

export async function POST(req: Request) {
  try {
    const signature = req.headers.get('upstash-signature');
    if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 401 });

    const bodyText = await req.text();
    const isValid = await receiver.verify({ signature, body: bodyText });
    if (!isValid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

    const payload = JSON.parse(bodyText);
    const { ticker, strategy } = payload;

    const portfolio = await getPortfolio();
    const today = new Date().toISOString().split('T')[0];

    // ✅ FIX idempotenza: controlla sui segnali già presenti in memoria, stessa strategy
    const already = portfolio.signals.find(s =>
      s.symbol === ticker && s.strategy === strategy && s.createdAt.startsWith(today)
    );
    if (already) {
      return NextResponse.json({ success: true, message: 'Segnale già generato oggi per questo ticker.', signal_id: already.id });
    }

    // ✅ FIX: dati di mercato REALI (stessa fonte usata dal resto dell'app)
    const item = WATCHLIST.find(w => w.symbol === ticker);
    if (!item) return NextResponse.json({ error: `Ticker ${ticker} non in watchlist` }, { status: 400 });

    const market = await fetchMarketData(item);
    if (!market) {
      // Rate limit o dati non disponibili: QStash riproverà automaticamente
      return NextResponse.json({ error: 'Dati di mercato non disponibili (rate limit?)' }, { status: 425 });
    }

    const closes = market.history.map(h => h.close).filter(p => p > 0);
    if (closes.length < 20) {
      return NextResponse.json({ success: true, message: 'Storico insufficiente, segnale scartato.' });
    }

    const price = market.price;
    const rsi = calculateRSI(closes);
    const sma20 = calculateSMA(closes, 20);
    const sma50 = calculateSMA(closes, 50);
    const momentum = calculateMomentum(closes, 20);
    const volatility = calculateVolatility(closes, 20);
    const priceVsSMA20 = price - sma20;
    const priceVsSMA50 = price - sma50;

    // ✅ FIX: probabilità reale (calibrazione storica se disponibile, altrimenti fallback neutro dichiarato)
    const calibration = await getCalibrationTable();
    const prob = calibration
      ? lookupCalibratedProbability(calibration.table, rsi, momentum, priceVsSMA50)
      : { ...estimateFallbackWinProbability(rsi, momentum, priceVsSMA20, priceVsSMA50), sampleSize: 0, trusted: false };

    // ✅ FIX: SL/TP basati su ATR reale, non finti
    const atr = calculateATR(market.history, 14);
    const atrPct = atr / price;
    const slPct = atrPct > 0 ? atrPct * 2.0 : 0.05;
    const tpPct = slPct * 2.0;
    const stopLoss = parseFloat((price * (1 - slPct)).toFixed(2));
    const takeProfit = parseFloat((price * (1 + tpPct)).toFixed(2));
    const rewardRiskRatio = tpPct / slPct;

    // ✅ FIX: Kelly reale, non hardcoded 2%
    const kelly = calculateKelly(prob.winProbability, rewardRiskRatio, volatility, portfolio.targetAnnualReturn);
    if (kelly.recommendedFraction <= 0) {
      return NextResponse.json({ success: true, message: 'Segnale scartato dal risk management (Kelly <= 0)' });
    }

    const sizing = calculatePositionSize(portfolio.capitalAvailable, kelly.recommendedFraction, price, stopLoss);
    if (sizing.capitalToAllocate < 100) {
      return NextResponse.json({ success: true, message: 'Segnale scartato: capitale allocabile insufficiente' });
    }

    const signal: Signal = {
      id: generateId(),
      symbol: ticker,
      name: item.name,
      type: item.type,
      action: 'BUY',
      suggestedPrice: price,
      quantity: sizing.quantity,
      capitalToAllocate: sizing.capitalToAllocate,
      stopLoss, takeProfit,
      stopLossPercent: slPct * 100,
      takeProfitPercent: tpPct * 100,
      kellyFraction: kelly.recommendedFraction,
      winProbability: prob.winProbability,
      winProbabilitySampleSize: prob.sampleSize,
      winProbabilityTrusted: prob.trusted,
      expectedReturn: kelly.expectedValue,
      reasoning: `Generato da worker asincrono QStash (${strategy})`,
      strategy: strategy || 'QUONTEST_ASYNC',
      urgency: 'MEDIUM',
      technicals: { rsi, momentum, trend: priceVsSMA20 > 0 && priceVsSMA50 > 0 ? 'BULLISH' : priceVsSMA20 < 0 && priceVsSMA50 < 0 ? 'BEARISH' : 'NEUTRAL' } as any,
      createdAt: new Date().toISOString(),
      status: 'PENDING',
    };

    // ✅ FIX: salva con la stessa funzione usata dal resto dell'app (schema corretto, niente colonne inventate)
    await addSignal(signal);

    return NextResponse.json({ success: true, signal_id: signal.id });
  } catch (err: any) {
    console.error('Worker error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
