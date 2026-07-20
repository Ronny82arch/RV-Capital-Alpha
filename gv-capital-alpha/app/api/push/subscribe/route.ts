import { NextResponse } from 'next/server';
import { savePushSubscription, getPushSubscriptions } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// Public VAPID Key (usata dal client per registrare la PushSubscription)
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa40yYyO7yJk316rU2B1mN14Hq4v2T4R1E2T3y4U5v6W7x8Y9z0A';

export async function GET() {
  return NextResponse.json({
    success: true,
    publicKey: VAPID_PUBLIC_KEY,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.subscription || !body.subscription.endpoint) {
      return NextResponse.json({ success: false, error: 'Invalid subscription payload' }, { status: 400 });
    }

    await savePushSubscription(body.subscription);

    return NextResponse.json({
      success: true,
      message: 'Iscrizione alle notifiche salvata con successo',
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
