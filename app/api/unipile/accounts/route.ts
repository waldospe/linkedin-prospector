import { NextRequest, NextResponse } from 'next/server';
import { globalConfig } from '@/lib/db';

export async function GET() {
  try {
    const cfg = globalConfig.get();
    if (!cfg?.unipile_api_key) {
      return NextResponse.json({ error: 'Unipile not configured' }, { status: 400 });
    }

    const dsn = cfg.unipile_dsn || 'api21.unipile.com:15135';
    const response = await fetch(`https://${dsn}/api/v1/accounts`, {
      headers: {
        'X-API-KEY': cfg.unipile_api_key,
        'Accept': 'application/json',
      },
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
