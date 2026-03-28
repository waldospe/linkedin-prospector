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
    const baseUrl = `https://${dsn}/api/v1`;

    // First look up the profile to get provider_id
    const slugMatch = profile_url?.match(/linkedin\.com\/in\/([a-zA-Z0-9\-_.]+)/);
    if (!slugMatch) {
      return NextResponse.json({ error: 'Invalid LinkedIn URL' }, { status: 400 });
    }

    const profileRes = await fetch(
      `${baseUrl}/users/${slugMatch[1]}?account_id=${user.unipile_account_id}`,
      {
        headers: { 'X-API-KEY': cfg.unipile_api_key, 'Accept': 'application/json' },
      }
    );

    if (!profileRes.ok) {
      return NextResponse.json({ error: 'Failed to look up profile' }, { status: 400 });
    }

    const profile = await profileRes.json();
    const providerId = profile.provider_id || profile.id;

    // Send invitation
    const response = await fetch(`${baseUrl}/users/invite`, {
      method: 'POST',
      headers: {
        'X-API-KEY': cfg.unipile_api_key,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        account_id: user.unipile_account_id,
        provider_id: providerId,
        message,
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
