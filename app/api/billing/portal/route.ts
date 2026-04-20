import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { users, getDb } from '@/lib/db';
import { getStripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const { userId } = getUserFromRequest(req);
    const user = users.getById(userId) as any;
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const db = getDb();
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(user.team_id) as any;
    if (!team?.stripe_customer_id) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 400 });
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: team.stripe_customer_id,
      return_url: `${process.env.NEXTAUTH_URL || 'https://lp.moco.inc'}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
