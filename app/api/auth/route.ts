import { NextRequest, NextResponse } from 'next/server';
import { createToken } from '@/lib/auth';
import { users } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Rate limit: 5 attempts per 15 minutes per email
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const limit = checkRateLimit(`login:${email}:${ip}`, 5, 900000);
    if (!limit.allowed) {
      return NextResponse.json({ error: `Too many attempts. Try again in ${limit.retryAfter} seconds.` }, { status: 429 });
    }

    const user = users.verifyPassword(email, password);
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = await createToken(user.id, user.role);

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return response;
  } catch (error: any) {
    console.error('Auth error:', error?.message || error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('auth_token');
  return response;
}
