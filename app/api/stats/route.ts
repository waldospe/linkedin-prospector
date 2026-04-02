import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/api-auth';
import { stats, users } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { effectiveUserId, isAll, userId } = getEffectiveUser(req);
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get('days')) || 30;

    const user = users.getById(userId) as any;
    const timezone = user?.timezone;

    if (isAll) {
      const daily = stats.getDailyTeam(days, user?.team_id);
      const today = stats.getTodayTeam(user?.team_id, timezone);
      return NextResponse.json({ daily, today });
    }

    // When viewing as another user, use that user's timezone
    const targetUser = effectiveUserId !== userId ? users.getById(effectiveUserId!) as any : user;
    const tz = targetUser?.timezone || timezone;

    const daily = stats.getDaily(days, effectiveUserId!);
    const today = stats.getToday(effectiveUserId!, tz);
    return NextResponse.json({ daily, today });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
