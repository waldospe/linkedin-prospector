import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { subscriptions, getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const teamId = parseInt(session.metadata?.team_id);
        if (teamId && session.subscription) {
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(session.subscription as string) as any;
          subscriptions.create({
            team_id: teamId,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: sub.id,
            plan: determinePlan(sub),
            status: sub.status,
            current_period_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : undefined,
            current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : undefined,
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as any;
        subscriptions.update(sub.id, {
          status: sub.status,
          plan: determinePlan(sub),
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as any;
        subscriptions.update(sub.id, { status: 'canceled' });
        break;
      }

      default:
        break;
    }
  } catch (error: any) {
    console.error('Webhook handler error:', error.message);
  }

  return NextResponse.json({ received: true });
}

function determinePlan(sub: any): string {
  const priceId = sub.items?.data?.[0]?.price?.id;
  if (priceId === process.env.STRIPE_STARTER_PRICE_ID) return 'starter';
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro';
  if (priceId === process.env.STRIPE_AGENCY_PRICE_ID) return 'agency';
  return 'starter';
}
