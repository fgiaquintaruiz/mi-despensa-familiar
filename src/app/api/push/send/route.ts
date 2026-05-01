import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getWebPush } from '@/lib/webpush';

interface SendPushBody {
  userId: string;
  payload: {
    title: string;
    body: string;
    url?: string;
  };
}

export const POST = async (req: Request) => {
  // This route is internal — called from server actions only.
  // It still validates the session to prevent misuse if ever exposed.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  let body: SendPushBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const { userId, payload } = body;

  if (!userId || !payload?.title || !payload?.body) {
    return NextResponse.json({ error: 'Parámetros incompletos' }, { status: 400 });
  }

  const { data: subscriptions, error: fetchError } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const wp = getWebPush();
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      wp.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
      ),
    ),
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  // Clean up expired subscriptions (status 410 Gone)
  const expiredEndpoints: string[] = [];
  results.forEach((result, index) => {
    if (
      result.status === 'rejected' &&
      (result.reason as { statusCode?: number })?.statusCode === 410
    ) {
      expiredEndpoints.push(subscriptions[index].endpoint);
    }
  });

  if (expiredEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', expiredEndpoints);
  }

  return NextResponse.json({ ok: true, sent, failed });
};
