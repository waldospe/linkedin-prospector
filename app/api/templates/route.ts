import { NextRequest, NextResponse } from 'next/server';
import { templates } from '@/lib/db-mem';

function getUserId(req: NextRequest): number | undefined {
  const userId = req.headers.get('x-user-id');
  return userId ? parseInt(userId) : 1;
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const allTemplates = templates.getAll(userId);
    return NextResponse.json(allTemplates);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const data = await req.json();
    const result = templates.create({
      ...data,
      user_id: userId
    });
    return NextResponse.json({ id: result.id });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
