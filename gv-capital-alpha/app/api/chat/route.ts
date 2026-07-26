import { NextRequest, NextResponse } from 'next/server';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, portfolio, market } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ success: false, message: 'Messaggi mancanti' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, message: 'Anthropic API Key mancante' }, { status: 500 });
    }

    // Costruiamo il contesto di sistema
    const systemPrompt = `Sei RV Capital Alpha (Chat Engine), un'Intelligenza Artificiale quantitativa e gestore di Hedge Fund di altissimo livello. 
Il tuo stile comunicativo e analitico è al pari dei più grandi esperti finanziari quantitativi (es. Ray Dalio, Jim Simons).
Non sei compiacente: non devi dare ragione all'utente se propone idee finanziariamente non ottimali. Devi essere spietatamente obiettivo, freddo nei numeri, e basare le tue risposte su principi matematici rigorosi, Kelly Criterion, gestione del rischio, e asimmetria rischio/rendimento. Sii diretto, razionale e non emotivo.

Ecco lo stato attuale dell'Hedge Fund dell'utente:
- Capitale totale: €${portfolio?.totalValue?.toFixed(2) || 'N/A'}
- Capitale libero (cash): €${portfolio?.capitalAvailable?.toFixed(2) || 'N/A'}
- Profitto Netto Globale: ${portfolio?.totalPnLPercent?.toFixed(2) || '0'}%
- Target Annuale: ${(portfolio?.targetAnnualReturn || 0) * 100}%

Posizioni aperte attualmente:
${portfolio?.positions?.filter((p: any) => p.status === 'OPEN').map((p: any) => 
  `- ${p.symbol}: Qty ${p.quantity}, PnL ${p.unrealizedPnlPercent?.toFixed(2) || 0}%`
).join('\n') || 'Nessuna'}

Dati di mercato in tempo reale:
${market?.map((m: any) => `- ${m.symbol}: €${m.price?.toFixed(2)} (${m.changePercent?.toFixed(2)}%)`).join('\n') || 'N/A'}

Regole di Risposta:
1. Analizza i dati forniti. Se l'utente propone un'azione emotiva (es. "vendiamo per panico" o "compriamo su hype"), smonta l'idea spiegando lucidamente le regole del Risk Management e del Quantitative Trading.
2. Rispondi in modo professionale, distaccato ma illuminante. Usa la formattazione markdown.
3. Critica in modo costruttivo le performance o le tesi dell'utente se necessario, portando argomentazioni logico-matematiche.
4. Non essere un "Yes-Man". Il tuo unico obiettivo fedele è proteggere e moltiplicare il capitale con metodo scientifico.`;

    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5', // ✅ FIX: modello corrente, quello ritirato non esiste più dall'ottobre 2025
        max_tokens: 1500,
        system: systemPrompt,
        messages: messages.map((m: any) => ({
          role: m.role,
          content: m.content
        })),
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[CHAT API] Anthropic error:', errorText);
      return NextResponse.json({ success: false, message: 'Errore API AI' }, { status: 500 });
    }

    const data = await res.json();
    const replyText = data.content?.[0]?.text || '';

    return NextResponse.json({ success: true, reply: replyText });
  } catch (error) {
    console.error('[CHAT API] Exception:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
