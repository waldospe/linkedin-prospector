import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/api-auth';
import { campaigns } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    getEffectiveUser(req);
    const contacts = campaigns.getContacts(Number(params.id));
    return NextResponse.json(contacts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    getEffectiveUser(req);
    const { contact_ids } = await req.json();
    if (!Array.isArray(contact_ids)) return NextResponse.json({ error: 'contact_ids required' }, { status: 400 });
    campaigns.addContacts(Number(params.id), contact_ids);
    return NextResponse.json({ success: true, added: contact_ids.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
