import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/api-auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { effectiveUserId } = getEffectiveUser(req);
    const db = getDb();

    // Get contacts who have replied or been messaged, most recent first
    // Include last message preview from contact_events if available
    const conversations = db.prepare(`
      SELECT
        c.id, c.first_name, c.last_name, c.name, c.company, c.title,
        c.linkedin_url, c.avatar_url, c.status,
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
      WHERE c.user_id = ? AND c.status IN ('replied', 'engaged', 'msg_sent', 'connected')
      ORDER BY
        CASE WHEN c.status = 'replied' THEN 0 WHEN c.status = 'engaged' THEN 1 ELSE 2 END,
        last_activity_at DESC NULLS LAST
      LIMIT 100
    `).all(effectiveUserId!) as any[];

    return NextResponse.json(conversations);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
