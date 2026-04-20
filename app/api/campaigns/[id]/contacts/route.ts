import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/api-auth';
import { campaigns, getDb } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    getEffectiveUser(req);
    const contactList = campaigns.getContacts(Number(params.id));
    return NextResponse.json(contactList);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { effectiveUserId } = getEffectiveUser(req);
    const { contact_ids, assign_sequence } = await req.json();
    if (!Array.isArray(contact_ids)) return NextResponse.json({ error: 'contact_ids required' }, { status: 400 });

    campaigns.addContacts(Number(params.id), contact_ids);

    // If assign_sequence is true, also assign the campaign's sequence to contacts
    let sequenced = 0;
    if (assign_sequence) {
      const campaign = campaigns.getById(Number(params.id), effectiveUserId!) as any;
      if (campaign?.sequence_id) {
        // Call the bulk-sequence endpoint logic inline
        const res = await fetch(new URL('/api/contacts/bulk-sequence', req.url).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...Object.fromEntries(req.headers) },
          body: JSON.stringify({ ids: contact_ids, sequence_id: campaign.sequence_id }),
        });
        if (res.ok) {
          const data = await res.json();
          sequenced = data.queued || 0;
        }
      }
    }

    return NextResponse.json({ success: true, added: contact_ids.length, sequenced });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
