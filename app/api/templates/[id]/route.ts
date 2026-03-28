import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { templates } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId, role } = getUserFromRequest(req);
    const data = await req.json();
    const result = templates.update(Number(params.id), userId, role === 'admin', data);
    if (!result) {
      return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId, role } = getUserFromRequest(req);
    const deleted = templates.delete(Number(params.id), userId, role === 'admin');
    if (!deleted) {
      return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
