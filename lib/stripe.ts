import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

// Lazy init — won't crash if STRIPE_SECRET_KEY is not set (dev mode)
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!stripeSecretKey) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-04-30.basil' as any });
  }
  return _stripe;
}

export const PLANS = {
  free: {
    name: 'Free',
    priceId: null,
    limits: { contacts: 100, sequences: 1, dailyConnections: 5, teamMembers: 1 },
  },
  starter: {
    name: 'Starter',
    priceId: process.env.STRIPE_STARTER_PRICE_ID || '',
    limits: { contacts: 1000, sequences: 5, dailyConnections: 20, teamMembers: 3 },
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID || '',
    limits: { contacts: 10000, sequences: 25, dailyConnections: 50, teamMembers: 10 },
  },
  agency: {
    name: 'Agency',
    priceId: process.env.STRIPE_AGENCY_PRICE_ID || '',
    limits: { contacts: Infinity, sequences: Infinity, dailyConnections: 100, teamMembers: 50 },
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function getPlanLimits(plan: string) {
  return PLANS[plan as PlanKey]?.limits || PLANS.free.limits;
}
