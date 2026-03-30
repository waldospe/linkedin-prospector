import { NextRequest, NextResponse } from 'next/server';
import { users } from '@/lib/db';

// GET: Validate invite token and return user info
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const user = users.getByInviteToken(params.token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 404 });
    }
    return NextResponse.json({ name: user.name, email: user.email });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Set password and activate account
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const user = users.getByInviteToken(params.token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 404 });
    }

    const { password } = await req.json();
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    users.activateInvite(params.token, password);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
