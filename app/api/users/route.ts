import { NextRequest, NextResponse } from 'next/server';
import { users } from '@/lib/db-mem';
import { verifyToken } from '@/lib/auth';

// Helper to get current user from token
function getCurrentUser(req: NextRequest) {
  const token = req.cookies.get('auth_token')?.value;
  if (!token) return null;
  
  // For now, return admin user (Jeff) as default
  // In production, decode token to get user_id
  return users.getById(1);
}

export async function GET(req: NextRequest) {
  const currentUser = getCurrentUser(req);
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Admin can see all users, users can only see themselves
  if (currentUser.role === 'admin') {
    return NextResponse.json(users.getAll());
  }
  
  return NextResponse.json([currentUser]);
}

export async function POST(req: NextRequest) {
  const currentUser = getCurrentUser(req);
  if (!currentUser || currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 });
  }

  try {
    const data = await req.json();
    const user = users.create(data);
    return NextResponse.json(user);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const currentUser = getCurrentUser(req);
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, ...data } = await req.json();
    
    // Users can only update themselves, admin can update anyone
    if (currentUser.role !== 'admin' && currentUser.id !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const user = users.update(id, data);
    return NextResponse.json(user);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const currentUser = getCurrentUser(req);
  if (!currentUser || currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 });
  }

  try {
    const { id } = await req.json();
    users.delete(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
