import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { globalConfig, users } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { userId } = getUserFromRequest(req);
    const user = users.getById(userId) as any;

    if (!user?.unipile_account_id) {
      return NextResponse.json({ error: 'No Unipile account linked to your profile' }, { status: 400 });
    }

    const cfg = globalConfig.get();
    if (!cfg?.unipile_api_key) {
      return NextResponse.json({ error: 'Unipile not configured' }, { status: 400 });
    }

    const { profile_url, message } = await req.json();
    const dsn = cfg.unipile_dsn || 'api21.unipile.com:15135';

    // First get the attendee_id from profile URL
    const profileResponse = await fetch(
      `https://${dsn}/api/v1/users/?linkedin=${encodeURIComponent(profile_url)}&account_id=${user.unipile_account_id}`,
      {
        headers: {
          'X-API-KEY': cfg.unipile_api_key,
          'Accept': 'application/json',
        },
      }
    );

    if (!profileResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 400 });
    }

    const profile = await profileResponse.json();

    const response = await fetch(`https://${dsn}/api/v1/chats`, {
      method: 'POST',
      headers: {
        'X-API-KEY': cfg.unipile_api_key,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        account_id: user.unipile_account_id,
        attendees_ids: [profile.provider_id || profile.id],
        text: message,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error }, { status: 400 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
