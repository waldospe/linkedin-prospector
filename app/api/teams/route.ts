import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, requireAdmin } from '@/lib/api-auth';
import { teams } from '@/lib/db';

export async function GET() {
  try {
    return NextResponse.json(teams.getAll());
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const { name } = await req.json();
    if (!name) return NextResponse.json({ error: 'Team name required' }, { status: 400 });
    const result = teams.create(name);
    return NextResponse.json({ id: result.lastInsertRowid });
  } catch (error: any) {
    if (error.message === 'Admin required') return NextResponse.json({ error: 'Admin required' }, { status: 403 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
