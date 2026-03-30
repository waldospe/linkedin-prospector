import { NextRequest, NextResponse } from 'next/server';
import { users } from '@/lib/db';

// Callback from Unipile after successful LinkedIn auth
// Unipile sends: { account_id, name (our internal user_id) }
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    console.log('UNIPILE CALLBACK:', JSON.stringify(data));

    const accountId = data.account_id || data.accountId;
    const internalUserId = data.name; // we passed our userId as 'name'

    if (!accountId || !internalUserId) {
      console.error('UNIPILE CALLBACK: missing account_id or name', data);
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    const userId = parseInt(internalUserId);
    const user = users.getById(userId);
    if (!user) {
      console.error('UNIPILE CALLBACK: user not found', userId);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update user's unipile_account_id
    users.update(userId, { unipile_account_id: accountId });
    console.log(`UNIPILE CALLBACK: linked account ${accountId} to user ${userId} (${(user as any).name})`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('UNIPILE CALLBACK ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Some webhook providers send GET to verify the endpoint
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
