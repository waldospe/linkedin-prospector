import { NextRequest, NextResponse } from 'next/server';
import { stats } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get('days')) || 30;
    const daily = stats.getDaily(days);
    const today = stats.getToday();
    return NextResponse.json({ daily, today });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
