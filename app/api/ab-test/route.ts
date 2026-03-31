import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { getDb } from '@/lib/db';

// GET: A/B test results for a sequence
// Shows performance metrics per template variant
export async function GET(req: NextRequest) {
  try {
    const { userId, role } = getUserFromRequest(req);
    const sequenceId = req.nextUrl.searchParams.get('sequence_id');

    if (!sequenceId) {
      return NextResponse.json({ error: 'sequence_id required' }, { status: 400 });
    }

    const db = getDb();

    // Get variant performance from completed queue items
    const variants = db.prepare(`
      SELECT
        q.template_variant as variant,
        q.action_type,
        COUNT(*) as total_sent,
        SUM(CASE WHEN c.status IN ('connected', 'msg_sent', 'replied', 'engaged') THEN 1 ELSE 0 END) as accepted,
        SUM(CASE WHEN c.status = 'replied' OR c.status = 'engaged' THEN 1 ELSE 0 END) as replied,
        SUM(CASE WHEN c.status = 'invite_declined' OR c.status = 'no_response' THEN 1 ELSE 0 END) as rejected
      FROM queue q
      JOIN contacts c ON q.contact_id = c.id
      WHERE q.sequence_id = ?
        AND q.status = 'completed'
        AND q.template_variant IS NOT NULL
        ${role !== 'admin' ? 'AND q.user_id = ?' : ''}
      GROUP BY q.template_variant, q.action_type
      ORDER BY q.template_variant
    `).all(...(role !== 'admin' ? [sequenceId, userId] : [sequenceId]));

    // Calculate rates
    const results = (variants as any[]).map(v => ({
      variant: v.variant,
      action_type: v.action_type,
      total_sent: v.total_sent,
      accepted: v.accepted,
      replied: v.replied,
      rejected: v.rejected,
      accept_rate: v.total_sent > 0 ? ((v.accepted / v.total_sent) * 100).toFixed(1) : '0.0',
      reply_rate: v.total_sent > 0 ? ((v.replied / v.total_sent) * 100).toFixed(1) : '0.0',
    }));

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
