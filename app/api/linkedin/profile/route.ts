import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/api-auth';
import { globalConfig, users } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { effectiveUserId, userId: authUserId } = getEffectiveUser(req);
    const viewUserId = effectiveUserId || authUserId;
    const user = users.getById(viewUserId) as any;
    const cfg = globalConfig.get();

    if (!cfg?.unipile_api_key) {
      return NextResponse.json({ error: 'Unipile API not configured' }, { status: 400 });
    }
    if (!user?.unipile_account_id) {
      return NextResponse.json({ error: 'No Unipile account linked' }, { status: 400 });
    }

    const id = req.nextUrl.searchParams.get('id'); // provider_id or LinkedIn slug
    if (!id) {
      return NextResponse.json({ error: 'Profile ID required' }, { status: 400 });
    }

    const dsn = cfg.unipile_dsn || 'api21.unipile.com:15135';
    const res = await fetch(
      `https://${dsn}/api/v1/users/${encodeURIComponent(id)}?account_id=${user.unipile_account_id}`,
      {
        headers: {
          'X-API-KEY': cfg.unipile_api_key,
          'Accept': 'application/json',
        },
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Profile fetch failed: ${errText.slice(0, 200)}` }, { status: res.status });
    }

    const profile = await res.json();
    return NextResponse.json(profile);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
