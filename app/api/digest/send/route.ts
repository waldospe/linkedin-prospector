import { NextRequest, NextResponse } from 'next/server';
import { users, getDb } from '@/lib/db';
import { sendDigestEmail } from '@/lib/email';

// Called by cron every hour. Sends digest to each user whose local hour matches
// their digest_send_hour preference and hasn't received one today.
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET || 'moco-cron-secret';
    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const allUsers = users.getAll() as any[];
    const sent: string[] = [];
    const skipped: string[] = [];

    for (const user of allUsers) {
      if (!user.email_daily_digest || user.email_daily_digest === 0) { skipped.push(user.name); continue; }
      if (!user.email) { skipped.push(user.name); continue; }

      const tz = user.timezone || 'America/Los_Angeles';
      const nowLocal = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
      const localHour = nowLocal.getHours();
      const localDate = nowLocal.toLocaleDateString('en-CA'); // YYYY-MM-DD

      const targetHour = user.digest_send_hour || 8;
      if (localHour !== targetHour) { skipped.push(user.name); continue; }

      // Don't send twice on same date
      if (user.last_digest_sent === localDate) { skipped.push(user.name); continue; }

      // Calculate yesterday's date in user's timezone
      const yesterday = new Date(nowLocal);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDate = yesterday.toLocaleDateString('en-CA');

      // Yesterday's stats
      const yesterdayStats = db.prepare(`
        SELECT connections_sent, messages_sent, replies_received FROM daily_stats
        WHERE user_id = ? AND date = ?
      `).get(user.id, yesterdayDate) as any;

      // Yesterday's connection acceptances (count contacts that moved to 'connected' status via queue completions)
      // Approximation: count queue items that completed yesterday where the contact is now 'connected'
      const yesterdayStart = `${yesterdayDate}T00:00:00`;
      const yesterdayEnd = `${yesterdayDate}T23:59:59`;
      const acceptedRow = db.prepare(`
        SELECT COUNT(DISTINCT c.id) as count FROM contacts c
        WHERE c.user_id = ? AND c.status IN ('connected', 'msg_sent', 'replied', 'positive', 'engaged', 'meeting_booked')
        AND EXISTS (
          SELECT 1 FROM queue q WHERE q.contact_id = c.id AND q.action_type = 'connection'
          AND q.status = 'completed' AND q.executed_at >= ? AND q.executed_at <= ?
        )
      `).get(user.id, yesterdayStart, yesterdayEnd) as any;

      // Today's queue size (pending items scheduled for today or earlier)
      const queueRow = db.prepare(`
        SELECT COUNT(*) as count FROM queue
        WHERE user_id = ? AND status = 'pending'
      `).get(user.id) as any;

      const connectionsSent = yesterdayStats?.connections_sent || 0;
      const messagesSent = yesterdayStats?.messages_sent || 0;
      const replies = yesterdayStats?.replies_received || 0;
      const accepted = acceptedRow?.count || 0;
      const queued = queueRow?.count || 0;

      // Skip if there's nothing to report
      const total = connectionsSent + messagesSent + replies + accepted + queued;
      if (total === 0) { skipped.push(user.name); continue; }

      await sendDigestEmail({
        to: user.email,
        userName: user.name,
        connectionsAcceptedYesterday: accepted,
        repliesYesterday: replies,
        messagesSentYesterday: messagesSent,
        connectionsSentYesterday: connectionsSent,
        queuedToday: queued,
        dailyLimit: user.daily_limit || 20,
      });

      db.prepare('UPDATE users SET last_digest_sent = ? WHERE id = ?').run(localDate, user.id);
      sent.push(user.name);
    }

    return NextResponse.json({ sent, skipped, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error('Digest error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
