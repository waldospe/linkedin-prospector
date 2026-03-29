import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { queue } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { userId } = getUserFromRequest(req);
    queue.clearFailed(userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to clear queue' }, { status: 500 });
  }
}
