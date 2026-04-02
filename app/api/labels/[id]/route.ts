import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { labels, users } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = getUserFromRequest(req);
    const user = users.getById(userId) as any;
    if (!user?.team_id) return NextResponse.json({ error: 'No team' }, { status: 400 });

    const data = await req.json();
    labels.update(Number(params.id), user.team_id, data);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Label name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = getUserFromRequest(req);
    const user = users.getById(userId) as any;
    if (!user?.team_id) return NextResponse.json({ error: 'No team' }, { status: 400 });

    labels.delete(Number(params.id), user.team_id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
