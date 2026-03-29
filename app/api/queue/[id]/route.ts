import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { queue, contacts } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = getUserFromRequest(req);
    const data = await req.json();

    // Retry: reset failed item back to pending
    if (data.retry) {
      queue.updateStatus(Number(params.id), 'pending', userId);
      return NextResponse.json({ success: true });
    }

    queue.updateStatus(Number(params.id), data.status, userId, data.error);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update queue item' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = getUserFromRequest(req);
    queue.delete(Number(params.id), userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete queue item' }, { status: 500 });
  }
}
