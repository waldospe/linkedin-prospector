import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, createToken, verifyPassword } from '@/lib/auth';
import { users } from '@/lib/db-mem';

export async function POST(req: NextRequest) {
  try {
    const { password, setup } = await req.json();
    const allUsers = users.getAll();
    const adminUser = allUsers.find(u => u.role === 'admin') || allUsers[0];

    if (setup && (!adminUser || !adminUser.admin_password_hash)) {
      const hash = hashPassword(password);
      
      // Create or update admin user
      if (adminUser) {
        users.update(adminUser.id, { admin_password_hash: hash });
      } else {
        users.create({
          name: 'Admin',
          email: 'admin@local',
          role: 'admin',
          admin_password_hash: hash
        });
      }
      
      const token = createToken();
      
      const response = NextResponse.json({ success: true, message: 'Password set successfully' });
      response.cookies.set('auth_token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
      return response;
    }

    if (!adminUser?.admin_password_hash) {
      return NextResponse.json({ error: 'No password set. Please run setup first.' }, { status: 400 });
    }

    if (!verifyPassword(password, adminUser.admin_password_hash)) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    const token = createToken();
    const response = NextResponse.json({ success: true });
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return response;
  } catch (error: any) {
    console.error('Auth error:', error?.message || error);
    return NextResponse.json({ error: 'Login failed', details: error?.message }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('auth_token');
  return response;
}
