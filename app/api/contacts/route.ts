import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { contacts, queue, sequences } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { userId } = getUserFromRequest(req);
    return NextResponse.json(contacts.getAll(userId));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = getUserFromRequest(req);
    const data = await req.json();

    const result = contacts.create(userId, data);

    // If sequence_id provided, add first step to queue
    if (data.sequence_id) {
      const seq = sequences.getById(data.sequence_id, userId) as any;
      if (seq) {
        const steps = typeof seq.steps === 'string' ? JSON.parse(seq.steps) : seq.steps;
        if (steps.length > 0) {
          queue.create(userId, {
            contact_id: result.lastInsertRowid as number,
            sequence_id: data.sequence_id,
            step_number: 1,
            action_type: steps[0].action,
          });
        }
      }
    }

    return NextResponse.json({ id: result.lastInsertRowid });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}
