import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { getDb } from '@/lib/db';

// Analyze reply patterns to find optimal send times
export async function GET(req: NextRequest) {
  try {
    const { userId, role } = getUserFromRequest(req);
    const db = getDb();

    // Get all messages that received replies, with timing data
    const replyData = db.prepare(`
      SELECT
        m.sent_at,
        m.replied_at,
        CAST(strftime('%H', m.sent_at) AS INTEGER) as send_hour,
        CAST(strftime('%w', m.sent_at) AS INTEGER) as send_dow,
        CAST(strftime('%H', m.replied_at) AS INTEGER) as reply_hour,
        CAST(julianday(m.replied_at) - julianday(m.sent_at)) * 24 as response_hours
      FROM messages m
      WHERE m.replied_at IS NOT NULL
        ${role !== 'admin' ? 'AND m.user_id = ?' : ''}
      ORDER BY m.sent_at DESC
      LIMIT 500
    `).all(...(role !== 'admin' ? [userId] : [])) as any[];

    // Also analyze connection accept patterns
    const acceptData = db.prepare(`
      SELECT
        q.executed_at as send_time,
        CAST(strftime('%H', q.executed_at) AS INTEGER) as send_hour,
        CAST(strftime('%w', q.executed_at) AS INTEGER) as send_dow,
        c.status
      FROM queue q
      JOIN contacts c ON q.contact_id = c.id
      WHERE q.action_type = 'connection'
        AND q.status = 'completed'
        AND q.executed_at IS NOT NULL
        ${role !== 'admin' ? 'AND q.user_id = ?' : ''}
      ORDER BY q.executed_at DESC
      LIMIT 1000
    `).all(...(role !== 'admin' ? [userId] : [])) as any[];

    // Calculate hourly reply rates
    const hourlyStats: Record<number, { sent: number; replied: number }> = {};
    for (let h = 0; h < 24; h++) hourlyStats[h] = { sent: 0, replied: 0 };

    for (const row of acceptData) {
      if (row.send_hour !== null) {
        hourlyStats[row.send_hour].sent++;
        if (row.status === 'connected' || row.status === 'replied' || row.status === 'engaged') {
          hourlyStats[row.send_hour].replied++;
        }
      }
    }

    for (const row of replyData) {
      if (row.send_hour !== null) {
        hourlyStats[row.send_hour].sent++;
        hourlyStats[row.send_hour].replied++;
      }
    }

    // Calculate day-of-week rates
    const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dowStats: Record<number, { sent: number; replied: number }> = {};
    for (let d = 0; d < 7; d++) dowStats[d] = { sent: 0, replied: 0 };

    for (const row of acceptData) {
      if (row.send_dow !== null) {
        dowStats[row.send_dow].sent++;
        if (row.status === 'connected' || row.status === 'replied' || row.status === 'engaged') {
          dowStats[row.send_dow].replied++;
        }
      }
    }

    // Find optimal hours (top 3 by reply rate with minimum sample size)
    const hourlyRates = Object.entries(hourlyStats)
      .map(([hour, stats]) => ({
        hour: parseInt(hour),
        sent: stats.sent,
        replied: stats.replied,
        rate: stats.sent >= 5 ? (stats.replied / stats.sent) * 100 : 0,
      }))
      .sort((a, b) => b.rate - a.rate);

    const optimalHours = hourlyRates.filter(h => h.sent >= 5).slice(0, 3);

    const dowRates = Object.entries(dowStats)
      .map(([dow, stats]) => ({
        day: dowNames[parseInt(dow)],
        dow: parseInt(dow),
        sent: stats.sent,
        replied: stats.replied,
        rate: stats.sent >= 5 ? (stats.replied / stats.sent) * 100 : 0,
      }))
      .sort((a, b) => b.rate - a.rate);

    // Average response time
    const avgResponseHours = replyData.length > 0
      ? replyData.reduce((sum, r) => sum + (r.response_hours || 0), 0) / replyData.length
      : null;

    return NextResponse.json({
      hourlyRates,
      dowRates,
      optimalHours,
      avgResponseHours: avgResponseHours ? parseFloat(avgResponseHours.toFixed(1)) : null,
      sampleSize: { replies: replyData.length, connections: acceptData.length },
      recommendation: optimalHours.length > 0
        ? `Best send times: ${optimalHours.map(h => `${h.hour}:00 (${h.rate.toFixed(0)}% response rate)`).join(', ')}`
        : 'Not enough data yet. Need at least 5 sends per hour to calculate optimal times.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
