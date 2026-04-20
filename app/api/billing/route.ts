import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { subscriptions, users } from '@/lib/db';
import { getStripe, PLANS } from '@/lib/stripe';

// GET: current subscription status
export async function GET(req: NextRequest) {
  try {
    const { userId } = getUserFromRequest(req);
    const plan = subscriptions.getPlanForUser(userId);
    return NextResponse.json(plan);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: create Stripe checkout session
export async function POST(req: NextRequest) {
  try {
    const { userId } = getUserFromRequest(req);
    const { priceId } = await req.json();
    if (!priceId) return NextResponse.json({ error: 'priceId required' }, { status: 400 });

    const user = users.getById(userId) as any;
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const stripe = getStripe();

    // Get or create Stripe customer
    const { getDb } = await import('@/lib/db');
    const db = getDb();
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(user.team_id) as any;
    let customerId = team?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: team?.name || user.name,
        metadata: { team_id: String(user.team_id), user_id: String(userId) },
      });
      customerId = customer.id;
      db.prepare('UPDATE teams SET stripe_customer_id = ? WHERE id = ?').run(customerId, user.team_id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXTAUTH_URL || 'https://lp.moco.inc'}/settings?billing=success`,
      cancel_url: `${process.env.NEXTAUTH_URL || 'https://lp.moco.inc'}/settings?billing=cancelled`,
      metadata: { team_id: String(user.team_id) },
      subscription_data: {
        metadata: { team_id: String(user.team_id) },
        trial_period_days: 14,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe checkout error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
