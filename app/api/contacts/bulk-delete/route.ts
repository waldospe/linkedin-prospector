import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/api-auth';
import { getDb, activityLog } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { effectiveUserId, userId: authUserId } = getEffectiveUser(req);
    const userId = effectiveUserId || authUserId;
    const { ids } = await req.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No contact IDs provided' }, { status: 400 });
    }

    // Delete in a transaction, scoped to user
    const db = getDb();
    const placeholders = ids.map(() => '?').join(',');
    const result = db.prepare(
      `DELETE FROM contacts WHERE id IN (${placeholders}) AND user_id = ?`
    ).run(...ids, userId);

    // Also clean up queue items for these contacts
    db.prepare(
      `DELETE FROM queue WHERE contact_id IN (${placeholders}) AND user_id = ?`
    ).run(...ids, userId);

    activityLog.log(userId, 'bulk_delete', 'contact', undefined, `Deleted ${result.changes} contacts`);
    return NextResponse.json({ deleted: result.changes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
