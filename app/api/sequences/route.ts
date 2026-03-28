import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { sequences } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { userId } = getUserFromRequest(req);
    const allSequences = sequences.getAll(userId);
    const parsed = allSequences.map((s: any) => ({
      ...s,
      steps: typeof s.steps === 'string' ? JSON.parse(s.steps) : s.steps,
    }));
    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch sequences' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = getUserFromRequest(req);
    const { name, steps } = await req.json();
    const result = sequences.create(userId, name, steps);
    return NextResponse.json({ id: result.lastInsertRowid });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create sequence' }, { status: 500 });
  }
}
