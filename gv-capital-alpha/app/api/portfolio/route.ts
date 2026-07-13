import { NextResponse } from 'next/server';
import { getPortfolio, syncEtoroPortfolio } from '@/lib/storage';

export async function GET() {
  try {
    if (process.env.ETORO_API_KEY && process.env.ETORO_USER_KEY) {
      const portfolio = await getPortfolio();
      const isMock = portfolio.positions.some(p => p.id.startsWith('d'));
      if (isMock) {
        console.log('[API portfolio] Dati mock rilevati. Avvio sincronizzazione automatica eToro...');
        await syncEtoroPortfolio();
      }
    }
    const portfolio = await getPortfolio();
    return NextResponse.json({ success: true, data: portfolio });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST() {
  try {
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

