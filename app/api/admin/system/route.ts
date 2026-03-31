import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { getDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
  } catch {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 });
  }

  try {
    const db = getDb();

    // Teams with member counts
    const teams = db.prepare(`
      SELECT t.id, t.name, COUNT(u.id) as member_count,
             SUM(CASE WHEN u.unipile_account_id IS NOT NULL AND u.unipile_account_id != 'pending' THEN 1 ELSE 0 END) as linked_count
      FROM teams t LEFT JOIN users u ON u.team_id = t.id
      GROUP BY t.id ORDER BY t.name
    `).all();

    // All users with status
    const users = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.team_id, u.unipile_account_id,
             u.daily_limit, u.timezone, u.invite_status, u.created_at,
             t.name as team_name,
             (SELECT COUNT(*) FROM contacts WHERE user_id = u.id) as contact_count,
             (SELECT COUNT(*) FROM queue WHERE user_id = u.id AND status = 'pending') as pending_queue,
             (SELECT COUNT(*) FROM queue WHERE user_id = u.id AND status = 'completed') as completed_queue,
             (SELECT COUNT(*) FROM queue WHERE user_id = u.id AND status = 'failed') as failed_queue
      FROM users u LEFT JOIN teams t ON u.team_id = t.id
      ORDER BY u.created_at DESC
    `).all();

    // Today's stats per user
    const today = new Date().toISOString().split('T')[0];
    const todayStats = db.prepare(`
      SELECT ds.user_id, u.name as user_name, ds.connections_sent, ds.messages_sent, ds.replies_received
      FROM daily_stats ds JOIN users u ON ds.user_id = u.id
      WHERE ds.date = ?
    `).all(today);

    // System-wide totals
    const totals = db.prepare(`
      SELECT
        COALESCE(SUM(connections_sent), 0) as total_connections,
        COALESCE(SUM(messages_sent), 0) as total_messages,
        COALESCE(SUM(replies_received), 0) as total_replies
      FROM daily_stats
    `).get() as any;

    const todayTotals = db.prepare(`
      SELECT
        COALESCE(SUM(connections_sent), 0) as connections_today,
        COALESCE(SUM(messages_sent), 0) as messages_today,
        COALESCE(SUM(replies_received), 0) as replies_today
      FROM daily_stats WHERE date = ?
    `).get(today) as any;

    // Queue overview
    const queueStats = db.prepare(`
      SELECT status, COUNT(*) as count FROM queue GROUP BY status
    `).all();

    // Contact status overview
    const contactStats = db.prepare(`
      SELECT status, COUNT(*) as count FROM contacts GROUP BY status
    `).all();

    // Recent errors (last 20 failed queue items)
    const recentErrors = db.prepare(`
      SELECT q.id, q.user_id, u.name as user_name, c.name as contact_name,
             q.action_type, q.error, q.executed_at
      FROM queue q
      JOIN users u ON q.user_id = u.id
      JOIN contacts c ON q.contact_id = c.id
      WHERE q.status = 'failed' AND q.error IS NOT NULL
      ORDER BY q.id DESC LIMIT 20
    `).all();

    // Cron status
    let cronLastRun = null;
    let cronLogSize = 0;
    const cronLogPath = path.join(process.cwd(), 'data', 'cron.log');
    try {
      const stat = fs.statSync(cronLogPath);
      cronLogSize = stat.size;
      cronLastRun = stat.mtime.toISOString();
    } catch { /* no cron log */ }

    // DB size
    let dbSize = 0;
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'app.db');
    try {
      dbSize = fs.statSync(dbPath).size;
    } catch { /* */ }

    // Daily activity for last 14 days
    const dailyActivity = db.prepare(`
      SELECT date,
        SUM(connections_sent) as connections,
        SUM(messages_sent) as messages,
        SUM(replies_received) as replies
      FROM daily_stats
      WHERE date >= date('now', '-14 days')
      GROUP BY date ORDER BY date
    `).all();

    return NextResponse.json({
      teams,
      users,
      todayStats,
      totals: { ...totals, ...todayTotals },
      queueStats,
      contactStats,
      recentErrors,
      cronLastRun,
      cronLogSize,
      dbSize,
      dailyActivity,
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
