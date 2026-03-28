import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { contacts, queue, sequences } from '@/lib/db';
import { substituteVariables } from '@/lib/constants';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = getUserFromRequest(req);
    const data = await req.json();
    const contactId = Number(params.id);

    // Handle sequence assignment
    if (data.sequence_id) {
      const seq = sequences.getById(data.sequence_id, userId) as any;
      if (seq) {
        const steps = typeof seq.steps === 'string' ? JSON.parse(seq.steps) : seq.steps;
        if (steps.length > 0) {
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

          contacts.updateStatus(contactId, 'queued', userId);
        }
      }
      return NextResponse.json({ success: true });
    }

    // Handle status update
    if (data.status) {
      contacts.updateStatus(contactId, data.status, userId);
      return NextResponse.json({ success: true });
    }

    // Handle general field updates
    contacts.update(contactId, userId, data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = getUserFromRequest(req);
    contacts.delete(Number(params.id), userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
