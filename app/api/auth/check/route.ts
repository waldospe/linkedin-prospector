import { NextRequest, NextResponse } from 'next/server';
import { users } from '@/lib/db-mem';

export async function POST(req: NextRequest) {
  try {
    // Check if any user exists with a password
    const allUsers = users.getAll();
    const needsSetup = allUsers.length === 0 || !allUsers[0]?.admin_password_hash;
    
    return NextResponse.json({ needsSetup });
  } catch (error) {
    return NextResponse.json({ needsSetup: true });
  }
}
