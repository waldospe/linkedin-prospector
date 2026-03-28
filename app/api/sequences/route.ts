import { NextRequest, NextResponse } from 'next/server';
import { sequences } from '@/lib/db-mem';

function getUserId(req: NextRequest): number | undefined {
  const userId = req.headers.get('x-user-id');
  return userId ? parseInt(userId) : 1;
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const allSequences = sequences.getAll(userId);
    const parsed = allSequences.map((s: any) => ({
      ...s,
      steps: typeof s.steps === 'string' ? JSON.parse(s.steps) : s.steps
    }));
    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch sequences' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const { name, steps } = await req.json();
    
    const result = sequences.create({
      name,
      steps: JSON.stringify(steps),
      user_id: userId,
      active: 1
    });
    
    return NextResponse.json({ id: result.id });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create sequence' }, { status: 500 });
  }
}
