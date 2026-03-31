import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { activityLog } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { userId, role } = getUserFromRequest(req);
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50');

    // Admins see all, users see their own
    const logs = role === 'admin' ? activityLog.getRecent(limit) : activityLog.getRecent(limit, userId);
    return NextResponse.json(logs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
