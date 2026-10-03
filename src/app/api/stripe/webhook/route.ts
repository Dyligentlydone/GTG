// POST /api/stripe/webhook (SPEC §10.2): subscription skeleton — keeps `subscriptions`
// in sync with Stripe. Pro plan only; no checkout UI yet.
import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { requireEnv } from '../../../../lib/env';

export async function POST(request: NextRequest) {
  const stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'));
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, requireEnv('STRIPE_WEBHOOK_SECRET'));
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type.startsWith('customer.subscription.')) {
    const sub = event.data.object as Stripe.Subscription;
    const admin = createAdminClient();
    const priceId = sub.items.data[0]?.price.id;
    const proPriceId = process.env.STRIPE_PRO_PRICE_ID;
    const { data: plan } = await admin.from('plans').select('id').eq('key', 'pro').single();
    const { data: profile } = await admin.from('profiles').select('id')
      // stripe_customer_id lives on subscriptions; find the owner via an existing row or metadata.
      .eq('id', (sub.metadata?.user_id as string) ?? '').maybeSingle();
    const userId = profile?.id ?? (sub.metadata?.user_id as string | undefined);
    if (event.type === 'customer.subscription.deleted') {
      await admin.from('subscriptions').update({ status: 'canceled' }).eq('stripe_subscription_id', sub.id);
    } else if (plan && userId && (!proPriceId || priceId === proPriceId)) {
      const periodEnd = (sub.items.data[0] as { current_period_end?: number } | undefined)?.current_period_end;
      await admin.from('subscriptions').upsert({
        user_id: userId,
        plan_id: plan.id,
        stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
        stripe_subscription_id: sub.id,
        status: sub.status,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      }, { onConflict: 'stripe_subscription_id' });
    }
  }
  return NextResponse.json({ received: true });
}
