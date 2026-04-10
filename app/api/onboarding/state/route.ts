import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { users, getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { userId } = getUserFromRequest(req);
    const user = users.getById(userId) as any;
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const db = getDb();

    // Step 1: LinkedIn connected (unipile_account_id is set and not pending)
    const linkedinConnected = !!user.unipile_account_id && user.unipile_account_id !== 'pending';

    // Step 2: Schedule is set — accept either the explicit confirmation flag, or
    // any non-empty send_schedule + timezone (data-driven fallback so we don't
    // depend on a side-effect flag that could be missed by older save paths).
    const hasScheduleData = !!(user.send_schedule && (typeof user.send_schedule === 'object'
      ? Object.keys(user.send_schedule).length > 0
      : String(user.send_schedule).length > 2));
    const scheduleSet = !!user.onboarding_schedule_confirmed || (hasScheduleData && !!user.timezone);

    // Step 3: Has contacts (at least 1)
    const contactCount = db.prepare('SELECT COUNT(*) as count FROM contacts WHERE user_id = ?').get(userId) as any;
    const hasContacts = (contactCount?.count || 0) > 0;

    // Step 4: Has at least 1 contact assigned to a sequence (queued or beyond)
    const sequencedCount = db.prepare(`
      SELECT COUNT(DISTINCT contact_id) as count FROM queue WHERE user_id = ?
    `).get(userId) as any;
    const hasSequenceAssigned = (sequencedCount?.count || 0) > 0;

    const steps = {
      linkedin_connected: linkedinConnected,
      schedule_set: scheduleSet,
      contacts_imported: hasContacts,
      sequence_assigned: hasSequenceAssigned,
    };

    const completed = Object.values(steps).filter(Boolean).length;
    const total = Object.keys(steps).length;
    const percent = Math.round((completed / total) * 100);
    const allDone = completed === total;

    return NextResponse.json({ steps, completed, total, percent, allDone, dismissed: !!user.onboarding_dismissed });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
