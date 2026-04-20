import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/api-auth';
import { warmup } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { effectiveUserId } = getEffectiveUser(req);
    const status = warmup.getStatus(effectiveUserId!);
    return NextResponse.json(status || { enabled: false });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { effectiveUserId } = getEffectiveUser(req);
    const { enabled } = await req.json();
    if (enabled) warmup.enable(effectiveUserId!);
    else warmup.disable(effectiveUserId!);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
