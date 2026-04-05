import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { userId } = getUserFromRequest(req);
    const since = req.nextUrl.searchParams.get('since');
    if (!since) return NextResponse.json({ connections_accepted: 0, replies: 0, messages_sent: 0 });

    const db = getDb();

    // Connections accepted since last login (contacts that moved to 'connected' status)
    // We approximate this via activity log — fall back to counting contacts connected since that time
    const connections = db.prepare(`
      SELECT COUNT(*) as count FROM queue
      WHERE user_id = ? AND action_type = 'connection' AND status = 'completed'
      AND executed_at > ?
    `).get(userId, since) as any;

    // Replies received since last login (via daily_stats aggregation)
    const sinceDate = since.split('T')[0];
    const replies = db.prepare(`
      SELECT COALESCE(SUM(replies_received), 0) as count FROM daily_stats
      WHERE user_id = ? AND date >= ?
    `).get(userId, sinceDate) as any;

    // Messages sent since last login
    const messages = db.prepare(`
      SELECT COUNT(*) as count FROM queue
      WHERE user_id = ? AND action_type = 'message' AND status = 'completed'
      AND executed_at > ?
    `).get(userId, since) as any;

    return NextResponse.json({
      connections_sent: connections?.count || 0,
      replies: replies?.count || 0,
      messages_sent: messages?.count || 0,
      since,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
