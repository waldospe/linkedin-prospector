import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { globalConfig, users } from '@/lib/db';

// Backfill avatar URLs for contacts that have a LinkedIn URL but no avatar.
// Groups by LinkedIn URL so each person is only looked up once.
// Processes a small batch per call to spread load.
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET || 'moco-cron-secret';
    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cfg = globalConfig.get();
    if (!cfg?.unipile_api_key) {
      return NextResponse.json({ error: 'Unipile not configured', processed: 0 });
    }

    // Find a user with a Unipile account to make API calls through
    const allUsers = users.getAll() as any[];
    const apiUser = allUsers.find(u => u.unipile_account_id && u.unipile_account_id !== 'pending');
    if (!apiUser) {
      return NextResponse.json({ error: 'No linked Unipile account', processed: 0 });
    }

    const db = getDb();
    const dsn = cfg.unipile_dsn || 'api21.unipile.com:15135';
    const baseUrl = `https://${dsn}/api/v1`;

    // Get unique LinkedIn URLs that need avatars (limit 10 per cycle)
    const needAvatars = db.prepare(`
      SELECT DISTINCT linkedin_url
      FROM contacts
      WHERE linkedin_url != '' AND linkedin_url IS NOT NULL
        AND (avatar_url IS NULL OR avatar_url = '')
      LIMIT 10
    `).all() as any[];

    if (needAvatars.length === 0) {
      return NextResponse.json({ processed: 0, message: 'All avatars up to date' });
    }

    let processed = 0;
    let errors = 0;

    for (const row of needAvatars) {
      const url = row.linkedin_url;
      const slugMatch = url.match(/linkedin\.com\/in\/([a-zA-Z0-9\-_.]+)/);
      if (!slugMatch) continue;

      try {
        const res = await fetch(
          `${baseUrl}/users/${slugMatch[1]}?account_id=${apiUser.unipile_account_id}`,
          { headers: { 'X-API-KEY': cfg.unipile_api_key, 'Accept': 'application/json' } }
        );

        if (!res.ok) {
          errors++;
          continue;
        }

        const profile = await res.json();
        const avatarUrl = profile.profile_picture_url || profile.profile_picture_url_large || '';

        if (avatarUrl) {
          // Update ALL contacts with this LinkedIn URL across all users
          const result = db.prepare(
            'UPDATE contacts SET avatar_url = ? WHERE linkedin_url = ? AND (avatar_url IS NULL OR avatar_url = ?)'
          ).run(avatarUrl, url, '');
          processed += result.changes;
        } else {
          // Mark as checked so we don't keep retrying (set to 'none')
          db.prepare(
            "UPDATE contacts SET avatar_url = 'none' WHERE linkedin_url = ? AND (avatar_url IS NULL OR avatar_url = '')"
          ).run(url);
        }

        // Small delay between API calls
        await new Promise(r => setTimeout(r, 500));

      } catch {
        errors++;
      }
    }

    return NextResponse.json({
      processed,
      looked_up: needAvatars.length,
      errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
