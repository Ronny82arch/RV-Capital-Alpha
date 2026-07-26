import { NextResponse } from 'next/server';
import { addAlert } from '@/lib/storage';

export async function POST(req: Request) {
  try {
    const { status, drift } = await req.json();

    let emoji = '⚠️';
    let title = 'Antigravity Alert';
    let alertType: 'INFO' | 'SUCCESS' | 'WARNING' = 'WARNING';
    
    if (status === 'PROFIT_MODE') {
      emoji = '🟢';
      title = 'Antigravity: Profit Mode';
      alertType = 'INFO';
    } else if (status === 'CAUTION') {
      emoji = '🟡';
      title = 'Antigravity: Caution';
      alertType = 'WARNING';
    } else if (status === 'EMERGENCY_STOP') {
      emoji = '🔴';
      title = 'Antigravity: EMERGENCY STOP';
      alertType = 'WARNING';
    }

    const message = `Deriva dal target: ${drift.toFixed(1)}%. Lo stato attuale del motore richiede attenzione per il ribilanciamento.`;

    await addAlert({
      title: `${emoji} ${title}`,
      message,
      type: alertType
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Leverage warning alert error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
