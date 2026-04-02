import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { sequences, activityLog } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId, role } = getUserFromRequest(req);
    const data = await req.json();
    const result = sequences.update(Number(params.id), userId, data, role === 'admin');
    if (!result) return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 });
    activityLog.log(userId, 'sequence_updated', 'sequence', Number(params.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update sequence' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId, role } = getUserFromRequest(req);
    const deleted = sequences.delete(Number(params.id), userId, role === 'admin');
    if (!deleted) return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 });
    activityLog.log(userId, 'sequence_deleted', 'sequence', Number(params.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete sequence' }, { status: 500 });
  }
}
