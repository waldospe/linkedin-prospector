import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/api-auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { effectiveUserId } = getEffectiveUser(req);
    const { searchParams } = new URL(req.url);
    const filterParam = searchParams.get('filter') || 'all';
    const validFilters = ['all', 'unread', 'handled'] as const;
    const filter = validFilters.includes(filterParam as any) ? filterParam : 'all';
    const db = getDb();

    // Build filter safely — all values are hardcoded, not from user input
    const inboxFilters: Record<string, string> = {
      all: "c.status IN ('replied', 'engaged', 'msg_sent', 'connected')",
      unread: "c.status IN ('replied', 'engaged', 'msg_sent', 'connected') AND COALESCE(c.inbox_status, 'unread') = 'unread'",
      handled: "c.status IN ('replied', 'engaged', 'msg_sent', 'connected') AND c.inbox_status = 'handled'",
    };
    const statusFilter = inboxFilters[filter];

    const conversations = db.prepare(`
      SELECT
        c.id, c.first_name, c.last_name, c.name, c.company, c.title,
        c.linkedin_url, c.avatar_url, c.status,
        COALESCE(c.inbox_status, 'unread') as inbox_status,
        (SELECT ce.details FROM contact_events ce
         WHERE ce.contact_id = c.id AND ce.event_type = 'reply_received'
         ORDER BY ce.created_at DESC LIMIT 1) as last_reply_preview,
        (SELECT ce.created_at FROM contact_events ce
         WHERE ce.contact_id = c.id AND ce.event_type = 'reply_received'
         ORDER BY ce.created_at DESC LIMIT 1) as last_reply_at,
        (SELECT ce.message_preview FROM contact_events ce
         WHERE ce.contact_id = c.id AND ce.event_type = 'message_sent'
         ORDER BY ce.created_at DESC LIMIT 1) as last_sent_preview,
        (SELECT ce.created_at FROM contact_events ce
         WHERE ce.contact_id = c.id AND (ce.event_type = 'message_sent' OR ce.event_type = 'reply_received')
         ORDER BY ce.created_at DESC LIMIT 1) as last_activity_at
      FROM contacts c
      WHERE c.user_id = ? AND ${statusFilter}
      ORDER BY
        CASE WHEN c.status = 'replied' THEN 0 WHEN c.status = 'engaged' THEN 1 ELSE 2 END,
        last_activity_at DESC NULLS LAST
      LIMIT 100
    `).all(effectiveUserId!) as any[];

    // Count unread
    const unreadCount = (db.prepare(`
      SELECT COUNT(*) as cnt FROM contacts
      WHERE user_id = ? AND status IN ('replied', 'engaged', 'msg_sent', 'connected')
      AND COALESCE(inbox_status, 'unread') = 'unread'
    `).get(effectiveUserId!) as any)?.cnt || 0;

    return NextResponse.json({ conversations, unreadCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { effectiveUserId } = getEffectiveUser(req);
    const { contact_id, inbox_status } = await req.json();
    if (!contact_id || !['unread', 'handled'].includes(inbox_status)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    getDb().prepare('UPDATE contacts SET inbox_status = ? WHERE id = ? AND user_id = ?').run(inbox_status, contact_id, effectiveUserId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
