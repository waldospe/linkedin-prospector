import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/api-auth';
import { getDb, users, globalConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { effectiveUserId, userId } = getEffectiveUser(req);
    const uid = effectiveUserId || userId;
    const db = getDb();

    // 1. Contacts needing a reply (replied status, not handled in inbox)
    const needsReply = db.prepare(`
      SELECT c.id, c.first_name, c.last_name, c.name, c.company, c.title, c.avatar_url, c.status,
        (SELECT ce.details FROM contact_events ce WHERE ce.contact_id = c.id AND ce.event_type = 'reply_received' ORDER BY ce.created_at DESC LIMIT 1) as reply_preview,
        (SELECT ce.created_at FROM contact_events ce WHERE ce.contact_id = c.id AND ce.event_type = 'reply_received' ORDER BY ce.created_at DESC LIMIT 1) as replied_at
      FROM contacts c
      WHERE c.user_id = ? AND c.status IN ('replied', 'engaged')
        AND COALESCE(c.inbox_status, 'unread') != 'handled'
      ORDER BY replied_at DESC NULLS LAST
      LIMIT 10
    `).all(uid) as any[];

    // 2. Contacts stuck — connected but no message sent yet (might need manual message)
    const connectedNoMsg = db.prepare(`
      SELECT c.id, c.first_name, c.last_name, c.name, c.company, c.avatar_url
      FROM contacts c
      WHERE c.user_id = ? AND c.status = 'connected'
        AND c.id NOT IN (SELECT contact_id FROM queue WHERE user_id = ? AND action_type = 'message' AND status IN ('pending', 'completed'))
        AND c.id NOT IN (SELECT contact_id FROM messages WHERE user_id = ?)
      ORDER BY c.created_at DESC LIMIT 5
    `).all(uid, uid, uid) as any[];

    // 3. Campaign progress
    const campaignProgress = db.prepare(`
      SELECT camp.id, camp.name, camp.status,
        (SELECT COUNT(*) FROM campaign_contacts cc WHERE cc.campaign_id = camp.id) as total,
        (SELECT COUNT(*) FROM campaign_contacts cc JOIN contacts co ON cc.contact_id = co.id
         WHERE cc.campaign_id = camp.id AND co.status IN ('connected','msg_sent','replied','engaged')) as connected,
        (SELECT COUNT(*) FROM campaign_contacts cc JOIN contacts co ON cc.contact_id = co.id
         WHERE cc.campaign_id = camp.id AND co.status IN ('replied','engaged')) as replied,
        (SELECT COUNT(*) FROM queue q JOIN campaign_contacts cc ON q.contact_id = cc.contact_id
         WHERE cc.campaign_id = camp.id AND q.user_id = ? AND q.status = 'completed') as actions_done,
        (SELECT COUNT(*) FROM queue q JOIN campaign_contacts cc ON q.contact_id = cc.contact_id
         WHERE cc.campaign_id = camp.id AND q.user_id = ?) as actions_total
      FROM campaigns camp
      WHERE camp.user_id = ? AND camp.status = 'active'
      ORDER BY camp.created_at DESC LIMIT 5
    `).all(uid, uid, uid) as any[];

    // 4. Account alerts
    const alerts: Array<{ type: string; severity: 'info' | 'warning' | 'error'; message: string; action?: string; actionUrl?: string }> = [];

    // Disconnected LinkedIn check
    const user = users.getById(uid) as any;
    if (user?.unipile_account_id) {
      const recentDisconnect = db.prepare(`
        SELECT COUNT(*) as cnt FROM queue
        WHERE user_id = ? AND status = 'failed' AND error LIKE '%disconnected_account%'
          AND executed_at >= datetime('now', '-1 day')
      `).get(uid) as any;
      if (recentDisconnect?.cnt > 0) {
        alerts.push({
          type: 'disconnected',
          severity: 'error',
          message: 'Your LinkedIn account is disconnected. Outreach is paused until you reconnect.',
          action: 'Reconnect LinkedIn',
          actionUrl: '/settings',
        });
      }
    } else if (!user?.unipile_account_id) {
      alerts.push({
        type: 'no_linkedin',
        severity: 'warning',
        message: 'Connect your LinkedIn account to start sending outreach.',
        action: 'Connect LinkedIn',
        actionUrl: '/settings',
      });
    }

    // Failed items
    const failedCount = (db.prepare("SELECT COUNT(*) as cnt FROM queue WHERE user_id = ? AND status = 'failed'").get(uid) as any)?.cnt || 0;
    if (failedCount > 10) {
      alerts.push({
        type: 'failures',
        severity: 'warning',
        message: `${failedCount} queue items have failed. Check the queue for details.`,
        action: 'View Queue',
        actionUrl: '/queue',
      });
    }

    // Running low on contacts in active sequences
    const pendingInvites = (db.prepare("SELECT COUNT(*) as cnt FROM queue WHERE user_id = ? AND status = 'pending' AND action_type = 'connection'").get(uid) as any)?.cnt || 0;
    if (pendingInvites < 20 && pendingInvites > 0) {
      alerts.push({
        type: 'low_contacts',
        severity: 'info',
        message: `Only ${pendingInvites} connection requests left in queue. Import more contacts to keep outreach running.`,
        action: 'Import Contacts',
        actionUrl: '/contacts',
      });
    } else if (pendingInvites === 0) {
      const hasAnyContacts = (db.prepare("SELECT COUNT(*) as cnt FROM contacts WHERE user_id = ?").get(uid) as any)?.cnt > 0;
      if (hasAnyContacts) {
        alerts.push({
          type: 'no_pending',
          severity: 'info',
          message: 'No outreach queued. Create a campaign or add contacts to a sequence to keep growing.',
          action: 'New Campaign',
          actionUrl: '/campaigns',
        });
      }
    }

    // 5. Weekly trend (compare this week vs last week)
    const thisWeek = db.prepare(`
      SELECT COALESCE(SUM(connections_sent),0) as connections, COALESCE(SUM(messages_sent),0) as messages, COALESCE(SUM(replies_received),0) as replies
      FROM daily_stats WHERE user_id = ? AND date >= date('now', '-7 days')
    `).get(uid) as any;
    const lastWeek = db.prepare(`
      SELECT COALESCE(SUM(connections_sent),0) as connections, COALESCE(SUM(messages_sent),0) as messages, COALESCE(SUM(replies_received),0) as replies
      FROM daily_stats WHERE user_id = ? AND date >= date('now', '-14 days') AND date < date('now', '-7 days')
    `).get(uid) as any;

    const trend = {
      connections: { current: thisWeek?.connections || 0, previous: lastWeek?.connections || 0 },
      messages: { current: thisWeek?.messages || 0, previous: lastWeek?.messages || 0 },
      replies: { current: thisWeek?.replies || 0, previous: lastWeek?.replies || 0 },
    };

    return NextResponse.json({
      needsReply,
      connectedNoMsg,
      campaignProgress,
      alerts,
      trend,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
