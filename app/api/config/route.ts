import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { globalConfig, users } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { userId, role } = getUserFromRequest(req);
    const user = users.getById(userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const result: any = {
      pipedrive_api_key: user.pipedrive_api_key,
      daily_limit: user.daily_limit,
      message_delay_min: user.message_delay_min,
      message_delay_max: user.message_delay_max,
      send_schedule: user.send_schedule,
    };

    // Admin also gets global Unipile config
    if (role === 'admin') {
      const cfg = globalConfig.get();
      result.unipile_api_key = cfg?.unipile_api_key || '';
      result.unipile_dsn = cfg?.unipile_dsn || '';
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { userId, role } = getUserFromRequest(req);
    const data = await req.json();

    // Update user-level settings
    const userFields: Record<string, any> = {};
    if (data.pipedrive_api_key !== undefined) userFields.pipedrive_api_key = data.pipedrive_api_key;
    if (data.daily_limit !== undefined) userFields.daily_limit = data.daily_limit;
    if (data.message_delay_min !== undefined) userFields.message_delay_min = data.message_delay_min;
    if (data.message_delay_max !== undefined) userFields.message_delay_max = data.message_delay_max;
    if (data.send_schedule !== undefined) userFields.send_schedule = data.send_schedule;

    if (Object.keys(userFields).length > 0) {
      users.update(userId, userFields);
    }

    // Admin can update global Unipile config
    if (role === 'admin') {
      const globalFields: Record<string, any> = {};
      if (data.unipile_api_key !== undefined) globalFields.unipile_api_key = data.unipile_api_key;
      if (data.unipile_dsn !== undefined) globalFields.unipile_dsn = data.unipile_dsn;
      if (Object.keys(globalFields).length > 0) {
        globalConfig.update(globalFields);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
