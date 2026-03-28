import { NextResponse } from 'next/server';
import { users } from '@/lib/db';

export async function POST() {
  try {
    const allUsers = users.getAll();
    // If no users exist at all, something went wrong with seeding
    return NextResponse.json({ needsSetup: allUsers.length === 0 });
  } catch {
    return NextResponse.json({ needsSetup: false });
  }
}
