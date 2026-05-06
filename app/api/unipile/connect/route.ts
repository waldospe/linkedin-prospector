import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { globalConfig, users } from '@/lib/db';

// Generate a Unipile hosted auth link for the current user to connect their LinkedIn
export async function POST(req: NextRequest) {
  try {
    const { userId } = getUserFromRequest(req);
    const user = users.getById(userId) as any;
    const cfg = globalConfig.get();

    if (!cfg?.unipile_api_key) {
      return NextResponse.json({ error: 'Unipile API not configured. Contact your admin.' }, { status: 400 });
    }

    const dsn = cfg.unipile_dsn || 'api21.unipile.com:15135';
    const apiUrl = `https://${dsn}`;
    const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://lp.moco.inc';
    const expiresOn = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // If user already has an account ID, generate a reconnect link instead of a new connection
    const isReconnect = user?.unipile_account_id && user.unipile_account_id !== 'pending';
    const body = isReconnect
      ? {
          type: 'reconnect',
          reconnect_account: user.unipile_account_id,
          api_url: apiUrl,
          expiresOn,
          name: String(userId),
          notify_url: `${appUrl}/api/unipile/callback`,
          success_redirect_url: `${appUrl}/settings?linked=success`,
        }
      : {
          type: 'create',
          providers: ['LINKEDIN'],
          api_url: apiUrl,
          expiresOn,
          name: String(userId),
          notify_url: `${appUrl}/api/unipile/callback`,
          success_redirect_url: `${appUrl}/settings?linked=success`,
        };

    const res = await fetch(`${apiUrl}/api/v1/hosted/accounts/link`, {
      method: 'POST',
      headers: {
        'X-API-KEY': cfg.unipile_api_key,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('UNIPILE HOSTED AUTH ERROR:', errText);
      return NextResponse.json({ error: 'Failed to generate connection link' }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({ url: data.url || data.link });
  } catch (error: any) {
    console.error('UNIPILE CONNECT ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
