import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/api-auth';
import { contacts, users } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { effectiveUserId, isAll, userId } = getEffectiveUser(req);
    let data: any[];

    if (isAll) {
      const user = users.getById(userId) as any;
      data = contacts.getAllTeam(user?.team_id);
    } else {
      data = contacts.getAll(effectiveUserId!);
    }

    // Build CSV
    const headers = ['First Name', 'Last Name', 'Full Name', 'Company', 'Title', 'LinkedIn URL', 'Status', 'Source', 'Created At'];
    const rows = data.map((c: any) => [
      c.first_name || '', c.last_name || '', c.name || '',
      c.company || '', c.title || '', c.linkedin_url || '',
      c.status || '', c.source || '', c.created_at || '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

    const csv = [headers.join(','), ...rows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="contacts-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
