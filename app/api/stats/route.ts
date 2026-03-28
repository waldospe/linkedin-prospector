import { NextRequest, NextResponse } from 'next/server';
import { stats } from '@/lib/db-mem';

function getUserId(req: NextRequest): number | undefined {
  const userId = req.headers.get('x-user-id');
  return userId ? parseInt(userId) : 1;
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get('days')) || 30;
    const daily = stats.getDaily(days, userId);
    const today = stats.getToday(userId);
    return NextResponse.json({ daily, today });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
