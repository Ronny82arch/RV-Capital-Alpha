import { NextResponse } from 'next/server';
import { getPushSubscriptions, addAlert } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const testTitle = '🧪 Test Notifica Push';
    const testMessage = 'Se vedi questo messaggio sul telefono, le Notifiche Push di RV Capital Alpha funzionano perfettamente! 🚀';

    // 1. Salva alert nel portafoglio (questo attiva automaticamente il dispatch push a tutti gli endpoint registrati)
    await addAlert({
      title: testTitle,
      message: testMessage,
      type: 'SUCCESS'
    });

    const subs = await getPushSubscriptions();

    return NextResponse.json({
      success: true,
      subscriptionsCount: subs.length,
      message: `Test inviato a ${subs.length} dispositivo/i registrato/i!`
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
