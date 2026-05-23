import { NextResponse } from 'next/server';
import { getPortfolio } from '@/lib/storage';

export async function GET() {
  try {
    const portfolio = await getPortfolio();
    return NextResponse.json({ success: true, data: portfolio });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
