import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/db';

const UNIPILE_API = 'https://api21.unipile.com:15135/api/v1';

export async function POST(req: NextRequest) {
  try {
    const { account_id, profile_url, message } = await req.json();
    const cfg = config.get() as any;
    
    if (!cfg?.unipile_api_key) {
      return NextResponse.json({ error: 'Unipile not configured' }, { status: 400 });
    }

    // First get the attendee_id from profile URL
    const profileResponse = await fetch(`${UNIPILE_API}/users/?linkedin=${encodeURIComponent(profile_url)}&account_id=${account_id}`, {
      headers: {
        'X-API-KEY': cfg.unipile_api_key,
        'Accept': 'application/json'
      }
    });

    if (!profileResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 400 });
    }

    const profile = await profileResponse.json();
    
    const response = await fetch(`${UNIPILE_API}/chats`, {
      method: 'POST',
      headers: {
        'X-API-KEY': cfg.unipile_api_key,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        account_id,
        attendee_id: profile.id,
        text: message
      })
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
