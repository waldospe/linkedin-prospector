import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { stats } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { userId } = getUserFromRequest(req);
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get('days')) || 30;
    const daily = stats.getDaily(days, userId);
    const today = stats.getToday(userId);
    return NextResponse.json({ daily, today });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
