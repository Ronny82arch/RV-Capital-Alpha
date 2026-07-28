/**
 * POST /api/chat
 * Fix modello Claude valido — usa fetch nativo (no SDK, coerente con lib/ai.ts).
 */

import { NextRequest, NextResponse } from 'next/server';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { messages, system } = await req.json();
    const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: system || 'You are a quantitative trading analyst.',
        messages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Chat API] Anthropic error ${res.status}:`, errText);
      return NextResponse.json({ error: `Anthropic API error: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({
      content: data.content,
      model: data.model,
      usage: data.usage,
    });

  } catch (err: any) {
    console.error('[Chat API Error]', err);
    return NextResponse.json(
      { error: err.message || 'AI request failed' }, { status: 500 }
    );
  }
}
