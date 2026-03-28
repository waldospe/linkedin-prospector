import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { templates, users } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { userId } = getUserFromRequest(req);
    const user = users.getById(userId) as any;
    return NextResponse.json(templates.getAll(userId, user?.team_id));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = getUserFromRequest(req);
    const user = users.getById(userId) as any;
    const data = await req.json();

    const result = templates.create({
      user_id: userId,
      team_id: data.shared_with_team ? user?.team_id : null,
      shared_with_team: data.shared_with_team || false,
      name: data.name,
      subject: data.subject,
      body: data.body,
      variables: data.variables,
    });

    return NextResponse.json({ id: result.lastInsertRowid });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
