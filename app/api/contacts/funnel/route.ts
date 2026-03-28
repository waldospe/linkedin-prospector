import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { contacts } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { userId } = getUserFromRequest(req);
    const counts = contacts.getFunnelCounts(userId);
    return NextResponse.json(counts);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch funnel data' }, { status: 500 });
  }
}
