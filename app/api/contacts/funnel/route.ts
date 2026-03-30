import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/api-auth';
import { contacts, users } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { effectiveUserId, isAll, userId } = getEffectiveUser(req);
    if (isAll) {
      const user = users.getById(userId) as any;
      return NextResponse.json(contacts.getFunnelCountsTeam(user?.team_id));
    }
    return NextResponse.json(contacts.getFunnelCounts(effectiveUserId!));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch funnel data' }, { status: 500 });
  }
}
