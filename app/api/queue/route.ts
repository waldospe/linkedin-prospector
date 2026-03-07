import { NextRequest, NextResponse } from 'next/server';
import { queue } from '@/lib/db';

export async function GET() {
  try {
    const items = queue.getAll();
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const result = queue.create(data);
    return NextResponse.json({ id: result.lastInsertRowid });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create queue item' }, { status: 500 });
  }
}
