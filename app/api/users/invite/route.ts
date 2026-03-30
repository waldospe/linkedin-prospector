import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getUserFromRequest } from '@/lib/api-auth';
import { users, teams } from '@/lib/db';
import { sendInviteEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
  } catch {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 });
  }

  try {
    const { userId } = getUserFromRequest(req);
    const admin = users.getById(userId) as any;
    const data = await req.json();

    if (!data.name || !data.email) {
      return NextResponse.json({ error: 'Name and email required' }, { status: 400 });
    }

    // Check if email already exists
    const existing = users.getByEmail(data.email);
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    // Create user with invite token
    const { result, token } = users.createWithInvite({
      name: data.name,
      email: data.email,
      role: data.role || 'user',
      team_id: data.team_id || admin?.team_id,
    });

    // Get team name for email
    const team = data.team_id ? teams.getById(data.team_id) as any : (admin?.team_id ? teams.getById(admin.team_id) as any : null);

    // Try to send invite email
    let emailSent = false;
    let emailError = '';
    try {
      await sendInviteEmail({
        to: data.email,
        name: data.name,
        inviterName: admin?.name || 'Admin',
        token,
        teamName: team?.name,
      });
      emailSent = true;
    } catch (err: any) {
      emailError = err.message || 'Failed to send email';
      console.error('INVITE EMAIL ERROR:', emailError);
    }

    return NextResponse.json({
      id: result.lastInsertRowid,
      token,
      emailSent,
      emailError,
      inviteUrl: `${process.env.NEXTAUTH_URL || 'https://lp.moco.inc'}/invite/${token}`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
