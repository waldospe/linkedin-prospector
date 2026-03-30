import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/api-auth';
import { queue, users } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { effectiveUserId, isAll, userId } = getEffectiveUser(req);
    if (isAll) {
      const user = users.getById(userId) as any;
      return NextResponse.json(queue.getAllTeam(user?.team_id));
    }
    return NextResponse.json(queue.getAll(effectiveUserId!));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { effectiveUserId } = getEffectiveUser(req);
    const data = await req.json();
    const result = queue.create(effectiveUserId!, data);
    return NextResponse.json({ id: result.lastInsertRowid });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create queue item' }, { status: 500 });
  }
}
