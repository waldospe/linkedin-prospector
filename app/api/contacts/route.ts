import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { contacts, queue, sequences } from '@/lib/db';
import { substituteVariables } from '@/lib/constants';

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
    const contactId = result.lastInsertRowid as number;

    // If sequence_id provided, add first step to queue and mark contact as queued
    if (data.sequence_id) {
      const seq = sequences.getById(data.sequence_id, userId) as any;
      if (seq) {
        const steps = typeof seq.steps === 'string' ? JSON.parse(seq.steps) : seq.steps;
        if (steps.length > 0) {
          // Get contact for variable substitution
          const contact = contacts.getById(contactId, userId) as any;
          const messageText = steps[0].template
            ? substituteVariables(steps[0].template, contact || {})
            : '';

          queue.create(userId, {
            contact_id: contactId,
            sequence_id: data.sequence_id,
            step_number: 1,
            action_type: steps[0].action,
            message_text: messageText,
          });

          // Update contact status to queued
          contacts.updateStatus(contactId, 'queued', userId);
        }
      }
    }

    return NextResponse.json({ id: contactId });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}
