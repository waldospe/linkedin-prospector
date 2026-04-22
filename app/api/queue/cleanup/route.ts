import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const maxDuration = 60;

// Automatic queue cleanup — resolves failed items that can be resolved.
// Called by cron or manually. Secured by CRON_SECRET.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET;
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const actions: Record<string, number> = {};

  // ─── 1. "fetch failed" → retry (reset to pending) ─────────────
  // These are transient Unipile timeouts. Give them another chance.
  const fetchFailed = db.prepare(`
    UPDATE queue SET status = 'pending', error = NULL,
      retry_count = COALESCE(retry_count, 0) + 1,
      scheduled_at = datetime('now', '+5 minutes')
    WHERE status = 'failed' AND error = 'fetch failed'
      AND COALESCE(retry_count, 0) < 3
  `).run();
  actions['fetch_failed_retried'] = fetchFailed.changes;

  // Permanently fail fetch-failed items that have been retried 3+ times
  const fetchFailedPerm = db.prepare(`
    UPDATE queue SET error = '[permanent] fetch failed after retries'
    WHERE status = 'failed' AND error = 'fetch failed'
      AND COALESCE(retry_count, 0) >= 3
  `).run();
  actions['fetch_failed_permanent'] = fetchFailedPerm.changes;

  // ─── 2. "Cannot message — not connected" → resolve based on contact status ──
  // If contact is no_response or invite_sent, the message was never going to work.
  // Cancel the queue item cleanly.
  const cantMessageDead = db.prepare(`
    UPDATE queue SET status = 'completed',
      error = 'Resolved: contact never connected'
    WHERE status = 'failed'
      AND error = 'Cannot message — not connected on LinkedIn'
      AND contact_id IN (
        SELECT id FROM contacts WHERE status IN ('no_response', 'invite_sent', 'invite_pending', 'new', 'queued', 'invite_declined', 'opted_out')
      )
  `).run();
  actions['not_connected_resolved'] = cantMessageDead.changes;

  // If contact IS connected/msg_sent/replied now, the error is stale — mark completed
  const cantMessageStale = db.prepare(`
    UPDATE queue SET status = 'completed',
      error = 'Resolved: contact is now connected'
    WHERE status = 'failed'
      AND error = 'Cannot message — not connected on LinkedIn'
      AND contact_id IN (
        SELECT id FROM contacts WHERE status IN ('connected', 'msg_sent', 'replied', 'engaged')
      )
  `).run();
  actions['not_connected_now_connected'] = cantMessageStale.changes;

  // ─── 3. "already invited recently" → mark completed, update contact ──
  const alreadyInvited = db.prepare(`
    SELECT q.id, q.contact_id, q.user_id FROM queue q
    WHERE q.status = 'failed' AND q.error LIKE '%already_invited_recently%'
  `).all() as Array<{ id: number; contact_id: number; user_id: number }>;
  for (const item of alreadyInvited) {
    db.prepare("UPDATE queue SET status = 'completed', error = 'Resolved: invite already sent' WHERE id = ?").run(item.id);
    // Update contact to invite_sent if still queued
    db.prepare("UPDATE contacts SET status = 'invite_sent' WHERE id = ? AND user_id = ? AND status IN ('queued', 'new')").run(item.contact_id, item.user_id);
  }
  actions['already_invited_resolved'] = alreadyInvited.length;

  // ─── 4. "cannot invite attendee" (declined) → mark contact as declined ──
  const cantInvite = db.prepare(`
    SELECT q.id, q.contact_id, q.user_id FROM queue q
    WHERE q.status = 'failed' AND q.error LIKE '%cannot_invite_attendee%'
  `).all() as Array<{ id: number; contact_id: number; user_id: number }>;
  for (const item of cantInvite) {
    db.prepare("UPDATE queue SET status = 'completed', error = 'Resolved: invite was declined' WHERE id = ?").run(item.id);
    db.prepare("UPDATE contacts SET status = 'invite_declined' WHERE id = ? AND user_id = ?").run(item.contact_id, item.user_id);
  }
  actions['declined_resolved'] = cantInvite.length;

  // ─── 5. "invalid recipient" → permanent, mark contact ──
  const invalidRecipient = db.prepare(`
    SELECT q.id, q.contact_id, q.user_id FROM queue q
    WHERE q.status = 'failed' AND q.error LIKE '%invalid_recipient%'
  `).all() as Array<{ id: number; contact_id: number; user_id: number }>;
  for (const item of invalidRecipient) {
    db.prepare("UPDATE queue SET status = 'completed', error = 'Resolved: invalid LinkedIn profile' WHERE id = ?").run(item.id);
    // Cancel any other pending items for this contact
    db.prepare("UPDATE queue SET status = 'completed', error = 'Cancelled: invalid profile' WHERE contact_id = ? AND user_id = ? AND status = 'pending'").run(item.contact_id, item.user_id);
  }
  actions['invalid_recipient_resolved'] = invalidRecipient.length;

  // ─── 6. "No LinkedIn URL" → permanent ──
  const noUrl = db.prepare(`
    UPDATE queue SET status = 'completed', error = 'Resolved: no LinkedIn URL'
    WHERE status = 'failed' AND error = 'No LinkedIn URL'
  `).run();
  actions['no_url_resolved'] = noUrl.changes;

  // ─── Summary ──
  const remainingFailed = (db.prepare("SELECT COUNT(*) as cnt FROM queue WHERE status = 'failed'").get() as any)?.cnt || 0;

  return NextResponse.json({
    actions,
    remainingFailed,
    timestamp: new Date().toISOString(),
  });
}
