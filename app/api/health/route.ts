import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  // DB connectivity + schema version
  try {
    const db = getDb();
    const row = db.prepare('SELECT version FROM schema_version LIMIT 1').get() as any;
    checks.database = { ok: true, detail: `schema v${row?.version}` };
  } catch (e: any) {
    checks.database = { ok: false, detail: e.message };
  }

  // Queue health
  try {
    const db = getDb();
    const lastCompleted = db.prepare(`
      SELECT executed_at FROM queue WHERE status = 'completed' AND executed_at IS NOT NULL
      ORDER BY executed_at DESC LIMIT 1
    `).get() as any;
    const pendingCount = (db.prepare("SELECT COUNT(*) as cnt FROM queue WHERE status = 'pending'").get() as any)?.cnt || 0;
    const failedCount = (db.prepare("SELECT COUNT(*) as cnt FROM queue WHERE status = 'failed'").get() as any)?.cnt || 0;
    const retryCount = (db.prepare("SELECT COUNT(*) as cnt FROM queue WHERE status = 'pending' AND retry_count > 0").get() as any)?.cnt || 0;
    checks.queue = {
      ok: failedCount < 50,
      detail: `${pendingCount} pending, ${retryCount} retrying, ${failedCount} failed, last: ${lastCompleted?.executed_at || 'never'}`,
    };
  } catch (e: any) {
    checks.queue = { ok: false, detail: e.message };
  }

  // Data counts
  try {
    const db = getDb();
    const contacts = (db.prepare('SELECT COUNT(*) as cnt FROM contacts').get() as any)?.cnt || 0;
    const users = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as any)?.cnt || 0;
    checks.data = { ok: true, detail: `${contacts} contacts, ${users} users` };
  } catch (e: any) {
    checks.data = { ok: false, detail: e.message };
  }

  const allOk = Object.values(checks).every(c => c.ok);
  return NextResponse.json(
    { status: allOk ? 'healthy' : 'degraded', checks, timestamp: new Date().toISOString() },
    { status: allOk ? 200 : 503 }
  );
}
