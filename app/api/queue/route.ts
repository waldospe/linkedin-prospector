import { NextRequest, NextResponse } from 'next/server';
import { queue } from '@/lib/db-mem';

function getUserId(req: NextRequest): number | undefined {
  const userId = req.headers.get('x-user-id');
  return userId ? parseInt(userId) : 1;
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const items = queue.getAll(userId);
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const result = queue.create(data);
    return NextResponse.json({ id: result.id });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create queue item' }, { status: 500 });
  }
}
