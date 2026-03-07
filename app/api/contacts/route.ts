import { NextRequest, NextResponse } from 'next/server';
import { contacts, queue, sequences } from '@/lib/db';

export async function GET() {
  try {
    const allContacts = contacts.getAll();
    return NextResponse.json(allContacts);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const result = contacts.create(data);
    
    // If sequence_id provided, add to queue
    if (data.sequence_id) {
      const seq: any = sequences.getById(data.sequence_id);
      if (seq) {
        const steps = JSON.parse(seq.steps as string);
        if (steps.length > 0) {
          queue.create({
            contact_id: Number(result.lastInsertRowid),
            sequence_id: data.sequence_id,
            step_number: 1,
            action_type: steps[0].action
          });
        }
      }
    }
    
    return NextResponse.json({ id: result.lastInsertRowid });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}
