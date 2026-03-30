import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/api-auth';
import { stats, users } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { effectiveUserId, isAll, userId } = getEffectiveUser(req);
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get('days')) || 30;

    if (isAll) {
      const user = users.getById(userId) as any;
      const daily = stats.getDailyTeam(days, user?.team_id);
      const today = stats.getTodayTeam(user?.team_id);
      return NextResponse.json({ daily, today });
    }

    const daily = stats.getDaily(days, effectiveUserId!);
    const today = stats.getToday(effectiveUserId!);
    return NextResponse.json({ daily, today });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
