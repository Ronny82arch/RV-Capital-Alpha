import { NextRequest, NextResponse } from 'next/server';
import { getPortfolio, mutatePortfolio } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { name, targetAllocationPct } = await req.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Nome portafoglio invalido' }, { status: 400 });
    }

    const cleanName = name.trim();

    await mutatePortfolio(p => {
      p.customPortfolios = p.customPortfolios || [];
      if (!p.customPortfolios.includes(cleanName)) {
        p.customPortfolios.push(cleanName);
      }

      p.targets = p.targets || {};
      p.targets[cleanName] = targetAllocationPct || 10;
    });

    const portfolio = await getPortfolio();
    return NextResponse.json({ success: true, data: portfolio, portfolio });
  } catch (err: any) {
    console.error('[API custom portfolio POST error]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const name = req.nextUrl.searchParams.get('name');
    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Nome portafoglio mancante o invalido' }, { status: 400 });
    }

    const cleanName = name.trim();

    await mutatePortfolio(p => {
      p.customPortfolios = (p.customPortfolios || []).filter(c => c !== cleanName);
      if (p.targets) {
        delete p.targets[cleanName];
      }
    });

    const portfolio = await getPortfolio();
    return NextResponse.json({ success: true, data: portfolio, portfolio });
  } catch (err: any) {
    console.error('[API custom portfolio DELETE error]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
