import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser, getUserFromRequest } from '@/lib/api-auth';
import { contacts, queue, sequences, users } from '@/lib/db';
import { substituteVariables } from '@/lib/constants';

export async function GET(req: NextRequest) {
  try {
    const { effectiveUserId, isAll, userId } = getEffectiveUser(req);
    if (isAll) {
      const user = users.getById(userId) as any;
      return NextResponse.json(contacts.getAllTeam(user?.team_id));
    }
    return NextResponse.json(contacts.getAll(effectiveUserId!));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { effectiveUserId } = getEffectiveUser(req);
    const targetUserId = effectiveUserId!;
    const data = await req.json();

    const result = contacts.create(targetUserId, data);
    const contactId = result.lastInsertRowid as number;

    if (data.sequence_id) {
      const seq = sequences.getById(data.sequence_id, targetUserId) as any;
      if (seq) {
        const steps = typeof seq.steps === 'string' ? JSON.parse(seq.steps) : seq.steps;
        if (steps.length > 0) {
          const contact = contacts.getById(contactId, targetUserId) as any;
          const messageText = steps[0].template
            ? substituteVariables(steps[0].template, contact || {})
            : '';
          queue.create(targetUserId, {
            contact_id: contactId,
            sequence_id: data.sequence_id,
            step_number: 1,
            action_type: steps[0].action,
            message_text: messageText,
          });
          contacts.updateStatus(contactId, 'queued', targetUserId);
        }
      }
    }

    return NextResponse.json({ id: contactId });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}
