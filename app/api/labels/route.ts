import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { labels, users } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { userId } = getUserFromRequest(req);
    const user = users.getById(userId) as any;
    if (!user?.team_id) return NextResponse.json([]);
    return NextResponse.json(labels.getByTeam(user.team_id));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = getUserFromRequest(req);
    const user = users.getById(userId) as any;
    if (!user?.team_id) return NextResponse.json({ error: 'No team' }, { status: 400 });

    const { name, color } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const result = labels.create(user.team_id, { name, color });
    return NextResponse.json({ id: result.lastInsertRowid, name: name.trim(), color: color || '#6B7280' });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Label already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
