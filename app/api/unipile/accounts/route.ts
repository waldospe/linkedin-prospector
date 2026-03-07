import { NextRequest, NextResponse } from 'next/server';
import { config, accounts } from '@/lib/db';

const UNIPILE_API = 'https://api21.unipile.com:15135/api/v1';

export async function GET() {
  try {
    const cfg = config.get() as any;
    if (!cfg?.unipile_api_key) {
      return NextResponse.json({ error: 'Unipile not configured' }, { status: 400 });
    }

    // Test connection by fetching accounts
    const response = await fetch(`${UNIPILE_API}/accounts`, {
      headers: {
        'X-API-KEY': cfg.unipile_api_key,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to connect to Unipile' }, { status: 400 });
    }

    const data = await response.json();
    return NextResponse.json(data.items || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
