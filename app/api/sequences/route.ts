import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/api-auth';
import { sequences, activityLog } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { effectiveUserId } = getEffectiveUser(req);
    const allSequences = sequences.getAll(effectiveUserId!) as any[];
    const stats = sequences.getStatsForSequences(effectiveUserId!, allSequences.map(s => s.id));
    const parsed = allSequences.map((s: any) => ({
      ...s,
      steps: typeof s.steps === 'string' ? JSON.parse(s.steps) : s.steps,
      stats: stats[s.id] || { totalContacts: 0, byStage: {}, queueCompleted: 0, queueTotal: 0 },
    }));
    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch sequences' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { effectiveUserId } = getEffectiveUser(req);
    const { name, steps, visibility, shared_with_user_ids } = await req.json();
    const result = sequences.create(effectiveUserId!, name, steps, visibility, shared_with_user_ids);
    activityLog.log(effectiveUserId!, 'sequence_created', 'sequence', result.lastInsertRowid as number, `Created "${name}"`);
    return NextResponse.json({ id: result.lastInsertRowid });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create sequence' }, { status: 500 });
  }
}
