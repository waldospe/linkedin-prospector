import { NextRequest, NextResponse } from 'next/server';
import { sequences } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name, steps, active } = await req.json();
    sequences.update(Number(params.id), name, steps, active);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update sequence' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    sequences.delete(Number(params.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete sequence' }, { status: 500 });
  }
}
