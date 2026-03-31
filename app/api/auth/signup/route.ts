import { NextRequest, NextResponse } from 'next/server';
import { createToken } from '@/lib/auth';
import { users, teams } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, team_id, new_team_name } = await req.json();

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

    // Create new team if requested
    let resolvedTeamId = team_id;
    if (new_team_name && !team_id) {
      try {
        const result = teams.create(new_team_name.trim());
        resolvedTeamId = result.lastInsertRowid as number;
      } catch {
        return NextResponse.json({ error: 'Team name already taken' }, { status: 409 });
      }
    }

    // Validate team exists if provided
    if (resolvedTeamId) {
      const team = teams.getById(resolvedTeamId);
      if (!team) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }
    }

    users.create({
      name,
      email,
      password,
      role: 'user',
      team_id: resolvedTeamId || undefined,
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
