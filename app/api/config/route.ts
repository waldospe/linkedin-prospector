import { NextRequest, NextResponse } from 'next/server';
import { users } from '@/lib/db-mem';

function getUserId(req: NextRequest): number {
  const userId = req.headers.get('x-user-id');
  return userId ? parseInt(userId) : 1;
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const user = users.getById(userId);
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      unipile_api_key: user.unipile_api_key,
      unipile_dsn: user.unipile_dsn,
      pipedrive_api_key: user.pipedrive_api_key,
      daily_limit: user.daily_limit,
      message_delay_min: user.message_delay_min,
      message_delay_max: user.message_delay_max,
      send_schedule: user.send_schedule
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const data = await req.json();
    users.update(userId, data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
