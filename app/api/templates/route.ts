import { NextRequest, NextResponse } from 'next/server';
import { templates } from '@/lib/db';

export async function GET() {
  try {
    const allTemplates = templates.getAll();
    return NextResponse.json(allTemplates);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const result = templates.create(data);
    return NextResponse.json({ id: result.lastInsertRowid });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
