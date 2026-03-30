import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    // Check DB connection
    const db = getDb();
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
    const queueCount = db.prepare('SELECT COUNT(*) as count FROM queue WHERE status = ?').get('pending') as any;

    return NextResponse.json({
      status: 'ok',
      users: userCount.count,
      pendingQueue: queueCount.count,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', error: error.message }, { status: 500 });
  }
}
