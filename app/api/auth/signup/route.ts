import { NextRequest, NextResponse } from 'next/server';
import { createToken } from '@/lib/auth';
import { users, teams } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, team_id } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password required' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const existing = users.getByEmail(email);
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    // Validate team exists if provided
    if (team_id) {
      const team = teams.getById(team_id);
      if (!team) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }
    }

    users.create({
      name,
      email,
      password,
      role: 'user',
      team_id: team_id || undefined,
    });

    const user = users.verifyPassword(email, password);
    if (!user) {
      return NextResponse.json({ error: 'Account created but login failed' }, { status: 500 });
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
