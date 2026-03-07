import { NextRequest, NextResponse } from 'next/server';
import { queue } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { status, error } = await req.json();
    queue.updateStatus(Number(params.id), status, error);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update queue item' }, { status: 500 });
  }
}
