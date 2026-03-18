import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, createToken } from '@/lib/auth';
import { config } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { password, setup } = await req.json();
    const currentConfig = config.get() as any;

    if (setup && !currentConfig?.admin_password_hash) {
      const hash = hashPassword(password);
      config.setPassword(hash);
      const token = createToken();
      
      const response = NextResponse.json({ success: true, message: 'Password set successfully' });
      response.cookies.set('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7,
      });
      return response;
    }

    if (!currentConfig?.admin_password_hash) {
      return NextResponse.json({ error: 'No password set. Please run setup first.' }, { status: 400 });
    }

    const { verifyPassword } = await import('@/lib/auth');
    if (!verifyPassword(password, currentConfig.admin_password_hash)) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    const token = createToken();
    const response = NextResponse.json({ success: true });
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('auth_token');
  return response;
}
