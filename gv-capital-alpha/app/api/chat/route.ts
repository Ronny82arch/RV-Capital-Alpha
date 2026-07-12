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
          const systemPrompt = `Sei l'Assistente AI personale di RV Capital Alpha, l'Hedge Fund autonomo dell'utente.
Sei integrato direttamente nell'interfaccia dell'applicazione e hai accesso in tempo reale a tutti i dati del fondo.

Ecco lo stato attuale dell'Hedge Fund:
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

      Rispondi all'utente in modo professionale, analitico e cordiale. Usa la formattazione markdown quando utile. Sii conciso se la domanda è semplice.`;

    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620',
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
