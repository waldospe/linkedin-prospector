import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/db';

export async function GET() {
  try {
    const cfg = config.get() as any;
    return NextResponse.json({
      unipile_api_key: cfg.unipile_api_key,
      unipile_dsn: cfg.unipile_dsn,
      pipedrive_api_key: cfg.pipedrive_api_key,
      daily_limit: cfg.daily_limit,
      message_delay_min: cfg.message_delay_min,
      message_delay_max: cfg.message_delay_max
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    config.update(data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
