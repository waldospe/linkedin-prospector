import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/api-auth';
import { sequences, activityLog } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { effectiveUserId } = getEffectiveUser(req);
    const body = await req.json().catch(() => ({}));
    const result = sequences.duplicate(Number(params.id), effectiveUserId!, body?.name);
    if (!result) return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 });
    const newId = result.lastInsertRowid as number;
    activityLog.log(effectiveUserId!, 'sequence_created', 'sequence', newId, `Duplicated sequence #${params.id}`);
    return NextResponse.json({ id: newId });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to duplicate sequence' }, { status: 500 });
  }
}
