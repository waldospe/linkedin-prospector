import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { users, contacts } from '@/lib/db';

const PIPEDRIVE_API = 'https://api.pipedrive.com/v1';

export async function POST(req: NextRequest) {
  try {
    const { userId } = getUserFromRequest(req);
    const user = users.getById(userId) as any;

    if (!user?.pipedrive_api_key) {
      return NextResponse.json({ error: 'Pipedrive not configured' }, { status: 400 });
    }

    const response = await fetch(`${PIPEDRIVE_API}/persons?api_token=${user.pipedrive_api_key}&limit=500`);

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch from Pipedrive' }, { status: 400 });
    }

    const data = await response.json();
    const persons = data.data || [];

    let imported = 0;
    const existingContacts = contacts.getAll(userId);

    for (const person of persons) {
      const existing = existingContacts.find((c: any) =>
        c.name === person.name || c.pipedrive_id === String(person.id)
      );

      if (!existing && person.name) {
        contacts.create(userId, {
          name: person.name,
          company: person.org_name || '',
          title: person.job_title || '',
          source: 'pipedrive',
          pipedrive_id: String(person.id),
        });
        imported++;
      }
    }

    return NextResponse.json({ imported, total: persons.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
