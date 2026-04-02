import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { contactLabels } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const contactId = Number(params.id);
    return NextResponse.json(contactLabels.getByContact(contactId));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const contactId = Number(params.id);
    const { label_ids } = await req.json();
    contactLabels.setForContact(contactId, label_ids || []);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const contactId = Number(params.id);
    const { label_id } = await req.json();
    contactLabels.add(contactId, label_id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const contactId = Number(params.id);
    const { label_id } = await req.json();
    contactLabels.remove(contactId, label_id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
