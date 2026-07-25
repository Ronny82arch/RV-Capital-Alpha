import { NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { SignalStateMachine, TradingSignalFSM } from '@/lib/fsm';
import { supabaseAdmin } from '@/lib/supabase/client';

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
});

export async function POST(req: Request) {
  try {
    // 1. Verifica della firma di sicurezza di QStash
    const signature = req.headers.get('upstash-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    const bodyText = await req.text();
    const isValid = await receiver.verify({
      signature,
      body: bodyText,
    });

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 2. Parsing del Payload
    const payload = JSON.parse(bodyText);
    const { portfolio_id, ticker, strategy, user_id } = payload;
    
    const today = new Date().toISOString().split('T')[0];
    
    const { data: existingSignal } = await supabaseAdmin
      .from('trading_signals')
      .select('id')
      .eq('portfolio_id', portfolio_id)
      .eq('ticker', ticker)
      .gte('created_at', today + 'T00:00:00Z')
      .maybeSingle();
    
    if (existingSignal) {
      console.log(`[Worker] Segnale già esistente per ${ticker} oggi. Skip.`);
      return NextResponse.json({ 
        success: true, 
        message: 'Segnale già generato oggi per questo ticker.',
        signal_id: existingSignal.id 
      });
    }

    console.log(`[Worker] Elaborazione Ticker ${ticker} per portafoglio ${portfolio_id}`);

    // TODO: Recuperare i dati di mercato da eToro/Broker (implementazione mock per ora)
    const marketData = await mockFetchMarketData(ticker);
    
    if (marketData.rateLimited) {
      // 3. Gestione Rate Limit: Ritorna 425 Too Early o 429 Too Many Requests
      // QStash riproverà automaticamente la consegna
      return NextResponse.json({ error: 'Rate Limited by Broker API' }, { status: 425 });
    }

    // 4. Backtest e Generazione Segnale (FSM: DRAFT)
    const currentPrice = marketData.price;
    let signal = SignalStateMachine.create(ticker, currentPrice);

    // 5. Valutazione Rischio (FSM: RISK_CHECK_PASSED o CANCELLED)
    // Esempio fittizio: calcoliamo un kelly allocation > 0
    const mockKellyAllocation = 0.02; // 2%
    signal = SignalStateMachine.evaluateRisk(signal, mockKellyAllocation);

    if (signal.state === 'CANCELLED') {
      return NextResponse.json({ success: true, message: 'Segnale scartato dal risk management' });
    }

    // 7. Salvataggio nel Data Layer (Supabase) in stato RISK_CHECK_PASSED o DRAFT/TRIGGERED
    const { error: dbError } = await supabaseAdmin
      .from('trading_signals')
      .insert({
        id: signal.id,
        portfolio_id,
        ticker,
        state: signal.state,
        requested_price: signal.requestedPrice,
        kelly_allocation: signal.kellyAllocation
      } as any);

    if (dbError) {
      console.error('Errore salvataggio segnale su Supabase:', dbError);
      return NextResponse.json({ error: 'DB Error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, signal_id: signal.id, state: signal.state });

  } catch (err: any) {
    console.error('Worker error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Simulazione fetch mercato
async function mockFetchMarketData(ticker: string): Promise<{ price: number, rateLimited: boolean }> {
  // Simuliamo occasionalmente un rate limit per testare l'architettura
  const isRateLimited = Math.random() > 0.9;
  return {
    price: 150.00 + (Math.random() * 10),
    rateLimited: isRateLimited
  };
}
