import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { contacts, queue, sequences, activityLog } from '@/lib/db';
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

          // Add small random delay so it doesn't all fire at window start
          const jitter = Math.floor(Math.random() * 30) * 60 * 1000; // 0-30 min random delay
          const scheduledAt = new Date(Date.now() + jitter).toISOString();

          queue.create(userId, {
            contact_id: contactId,
            sequence_id: data.sequence_id,
            step_number: 1,
            action_type: steps[0].action,
            message_text: messageText,
            scheduled_at: scheduledAt,
          });

          contacts.updateStatus(contactId, 'queued', userId);
        }
      }
      return NextResponse.json({ success: true });
    }

    // Handle pause: update all pending queue items to 'paused'
    if (data.pause) {
      const db = (await import('@/lib/db')).getDb();
      db.prepare("UPDATE queue SET status = 'paused' WHERE contact_id = ? AND user_id = ? AND status = 'pending'").run(contactId, userId);
      activityLog.log(userId, 'contact_paused', 'contact', contactId);
      return NextResponse.json({ success: true });
    }

    // Handle resume: update all paused queue items back to 'pending'
    if (data.resume) {
      const db = (await import('@/lib/db')).getDb();
      db.prepare("UPDATE queue SET status = 'pending' WHERE contact_id = ? AND user_id = ? AND status = 'paused'").run(contactId, userId);
      activityLog.log(userId, 'contact_resumed', 'contact', contactId);
      return NextResponse.json({ success: true });
    }

    // Handle status update
    if (data.status) {
      contacts.updateStatus(contactId, data.status, userId);
      if (data.status === 'opted_out') {
        queue.deleteByContact(contactId, userId);
        activityLog.log(userId, 'contact_opted_out', 'contact', contactId);
      }
      return NextResponse.json({ success: true });
    }

    // Handle general field updates (edit contact)
    const editableFields: Record<string, any> = {};
    if (data.first_name !== undefined) editableFields.first_name = data.first_name;
    if (data.last_name !== undefined) editableFields.last_name = data.last_name;
    if (data.company !== undefined) editableFields.company = data.company;
    if (data.title !== undefined) editableFields.title = data.title;
    if (data.linkedin_url !== undefined) editableFields.linkedin_url = data.linkedin_url;
    if (Object.keys(editableFields).length > 0) {
      contacts.update(contactId, userId, editableFields);
      activityLog.log(userId, 'contact_updated', 'contact', contactId, `Updated: ${Object.keys(editableFields).join(', ')}`);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = getUserFromRequest(req);
    const contactId = Number(params.id);
    queue.deleteByContact(contactId, userId);
    contacts.delete(contactId, userId);
    activityLog.log(userId, 'contact_deleted', 'contact', contactId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
