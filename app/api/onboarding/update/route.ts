import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { userId } = getUserFromRequest(req);
    const { schedule_confirmed, dismissed } = await req.json();

    const db = getDb();
    const fields: string[] = [];
    const params: any[] = [];
    if (schedule_confirmed !== undefined) { fields.push('onboarding_schedule_confirmed = ?'); params.push(schedule_confirmed ? 1 : 0); }
    if (dismissed !== undefined) { fields.push('onboarding_dismissed = ?'); params.push(dismissed ? 1 : 0); }
    if (fields.length === 0) return NextResponse.json({ success: true });
    params.push(userId);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
