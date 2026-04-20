import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/api-auth';
import { accountHealth } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { effectiveUserId } = getEffectiveUser(req);
    const health = accountHealth.getScore(effectiveUserId!);
    return NextResponse.json(health);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
