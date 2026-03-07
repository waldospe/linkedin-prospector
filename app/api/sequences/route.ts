import { NextRequest, NextResponse } from 'next/server';
import { sequences } from '@/lib/db';

export async function GET() {
  try {
    const allSequences = sequences.getAll();
    const parsed = allSequences.map((s: any) => ({
      ...s,
      steps: JSON.parse(s.steps)
    }));
    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch sequences' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, steps } = await req.json();
    const result = sequences.create(name, steps);
    return NextResponse.json({ id: result.lastInsertRowid });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create sequence' }, { status: 500 });
  }
}
