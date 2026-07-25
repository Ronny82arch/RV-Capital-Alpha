import { NextResponse } from 'next/server';
import { getPortfolio, syncEtoroPortfolio } from '@/lib/storage';

export async function GET() {
  try {
    const portfolio = await getPortfolio();
    
    try {
      await syncEtoroPortfolio();
      return NextResponse.json({ success: true, message: 'Sync completato con successo!', positionsCount: portfolio.positions.length });
    } catch (syncErr: any) {
      return NextResponse.json({ success: false, error: syncErr.message || String(syncErr), stack: syncErr.stack });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || String(err), phase: 'getPortfolio' });
  }
}
