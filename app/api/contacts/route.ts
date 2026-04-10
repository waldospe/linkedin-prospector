import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser, getUserFromRequest } from '@/lib/api-auth';
import { contacts, queue, sequences, users, activityLog } from '@/lib/db';
import { substituteVariables } from '@/lib/constants';

export async function GET(req: NextRequest) {
  try {
    const { effectiveUserId, isAll, userId } = getEffectiveUser(req);
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const labelIdsParam = searchParams.get('label_ids');
    const labelIds = labelIdsParam ? labelIdsParam.split(',').map(Number).filter(n => !isNaN(n)) : undefined;
    const idsOnly = searchParams.get('ids_only') === '1';

    if (idsOnly) {
      if (!effectiveUserId) {
        return NextResponse.json({ ids: [] });
      }
      const ids = contacts.getMatchingIds(effectiveUserId, { status, search, labelIds });
      return NextResponse.json({ ids });
    }

    if (isAll) {
      const user = users.getById(userId) as any;
      return NextResponse.json(contacts.getAllTeam(user?.team_id));
    }

    // Use pagination if page param is present
    if (searchParams.has('page')) {
      const result = contacts.getPaginated(effectiveUserId!, { limit, offset: (page - 1) * limit, status, search, labelIds });
      return NextResponse.json({ rows: result.rows, total: result.total, page, limit });
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

    activityLog.log(targetUserId, 'contact_created', 'contact', contactId, `Created ${data.first_name || ''} ${data.last_name || data.name || ''}`.trim());
    return NextResponse.json({ id: contactId });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}
