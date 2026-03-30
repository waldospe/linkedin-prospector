import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, requireAdmin } from '@/lib/api-auth';
import { users } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { userId, role } = getUserFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (role === 'admin') {
    return NextResponse.json(users.getAll());
  }

  const user = users.getById(userId);
  return NextResponse.json(user ? [user] : []);
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
  } catch {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 });
  }

  try {
    const data = await req.json();
    if (!data.name || !data.email || !data.password) {
      return NextResponse.json({ error: 'Name, email, and password required' }, { status: 400 });
    }

    const existing = users.getByEmail(data.email);
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    const result = users.create({
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role || 'user',
      team_id: data.team_id,
      unipile_account_id: data.unipile_account_id,
    });

    return NextResponse.json({ id: result.lastInsertRowid });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { userId, role } = getUserFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id, ...data } = await req.json();
    const targetId = id || userId;

    // Regular users can only update themselves, and only allowed fields
    if (role !== 'admin') {
      if (targetId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      // Non-admins cannot change role or unipile_account_id
      // But they CAN set team_id if they don't have one yet (onboarding)
      delete data.role;
      delete data.unipile_account_id;
      const currentUserData = users.getById(userId) as any;
      if (currentUserData?.team_id) {
        delete data.team_id; // already has a team, can't change it
      }
    }

    users.update(targetId, data);
    const updated = users.getById(targetId);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    requireAdmin(req);
  } catch {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 });
  }

  try {
    const { userId } = getUserFromRequest(req);
    const { id } = await req.json();

    if (id === userId) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
    }

    users.delete(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
