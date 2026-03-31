import { NextRequest, NextResponse } from 'next/server';
import { users } from '@/lib/db';
import crypto from 'crypto';

// Store reset tokens in memory (simple approach — tokens expire in 1 hour)
const resetTokens = new Map<string, { userId: number; expires: number }>();

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  resetTokens.forEach((data, token) => {
    if (data.expires < now) resetTokens.delete(token);
  });
}, 60000);

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    const user = users.getByEmail(email);
    // Always return success to prevent email enumeration
    if (!user) return NextResponse.json({ success: true });

    const token = crypto.randomUUID();
    resetTokens.set(token, { userId: user.id, expires: Date.now() + 3600000 }); // 1 hour

    const appUrl = process.env.NEXTAUTH_URL || 'https://lp.moco.inc';
    const resetUrl = `${appUrl}/reset-password/${token}`;

    // Try to send email
    try {
      const { sendResetEmail } = await import('@/lib/email');
      await sendResetEmail({ to: email, name: user.name, resetUrl });
    } catch (err: any) {
      console.error('RESET EMAIL ERROR:', err.message);
      // Still return the token in response for manual use
      return NextResponse.json({ success: true, resetUrl });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Validate token
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  const data = resetTokens.get(token);
  if (!data || data.expires < Date.now()) {
    return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 404 });
  }

  const user = users.getById(data.userId) as any;
  return NextResponse.json({ name: user?.name, email: user?.email });
}

// Reset password
export async function PUT(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) return NextResponse.json({ error: 'Token and password required' }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });

    const data = resetTokens.get(token);
    if (!data || data.expires < Date.now()) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 404 });
    }

    users.update(data.userId, { password });
    resetTokens.delete(token);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
