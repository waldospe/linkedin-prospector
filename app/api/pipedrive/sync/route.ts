import { NextRequest, NextResponse } from 'next/server';
import { config, contacts } from '@/lib/db';

const PIPEDRIVE_API = 'https://api.pipedrive.com/v1';

export async function POST() {
  try {
    const cfg = config.get() as any;
    if (!cfg?.pipedrive_api_key) {
      return NextResponse.json({ error: 'Pipedrive not configured' }, { status: 400 });
    }

    // Fetch persons from Pipedrive
    const response = await fetch(`${PIPEDRIVE_API}/persons?api_token=${cfg.pipedrive_api_key}&limit=500`);
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch from Pipedrive' }, { status: 400 });
    }

    const data = await response.json();
    const persons = data.data || [];

    let imported = 0;
    for (const person of persons) {
      // Check if already exists
      const existing = contacts.getAll().find((c: any) => 
        c.name === person.name || c.pipedrive_id === String(person.id)
      );
      
      if (!existing && person.name) {
        contacts.create({
          name: person.name,
          company: person.org_name || '',
          title: person.job_title || '',
          source: 'pipedrive',
          pipedrive_id: String(person.id)
        });
        imported++;
      }
    }

    return NextResponse.json({ imported, total: persons.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
