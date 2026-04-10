import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/api-auth';
import { sequences, users, getDb } from '@/lib/db';
import { substituteVariables } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { effectiveUserId, userId: authUserId } = getEffectiveUser(req);
    const userId = effectiveUserId || authUserId;
    const { ids, sequence_id } = await req.json();

    if (!Array.isArray(ids) || ids.length === 0 || !sequence_id) {
      return NextResponse.json({ error: 'Contact IDs and sequence_id required' }, { status: 400 });
    }

    const seq = sequences.getById(sequence_id, userId) as any;
    if (!seq) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    const steps = typeof seq.steps === 'string' ? JSON.parse(seq.steps) : seq.steps;
    if (steps.length === 0) {
      return NextResponse.json({ error: 'Sequence has no steps' }, { status: 400 });
    }

    // Get user's settings for scheduling
    const user = users.getById(userId!) as any;
    const dailyLimit = user?.daily_limit || 20;
    const schedule = user?.send_schedule || {};
    const startHour = parseInt((schedule.mon?.start || '08:00').split(':')[0]);
    const endHour = parseInt((schedule.mon?.end || '17:00').split(':')[0]);
    const windowMinutes = (endHour - startHour) * 60;

    // Shuffle IDs for randomization
    const shuffledIds = [...ids].sort(() => Math.random() - 0.5);

    const db = getDb();
    const queueAfter = db.prepare(`
      INSERT INTO queue (user_id, contact_id, sequence_id, step_number, action_type, message_text, scheduled_at, template_variant)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateContactStatus = db.prepare(`UPDATE contacts SET status = ? WHERE id = ? AND user_id = ?`);
    const getContact = db.prepare(`SELECT * FROM contacts WHERE id = ? AND user_id = ?`);

    const queueAll = db.transaction((idList: number[]) => {
      let queued = 0;
      for (let i = 0; i < idList.length; i++) {
        const contactId = idList[i];
        const c = getContact.get(contactId, userId!) as any;
        if (!c) continue;

        // A/B testing: if step has variants, randomly pick one
        let messageText = '';
        let variantLabel: string | undefined;
        const step = steps[0];
        if (step.variants && Array.isArray(step.variants) && step.variants.length > 0) {
          const variant = step.variants[Math.floor(Math.random() * step.variants.length)];
          messageText = variant.template ? substituteVariables(variant.template, c) : '';
          variantLabel = variant.label || `V${step.variants.indexOf(variant) + 1}`;
        } else {
          messageText = step.template ? substituteVariables(step.template, c) : '';
        }

        // Spread across days with random jitter
        const dayOffset = Math.floor(i / dailyLimit);
        const positionInDay = i % dailyLimit;
        const minuteOffset = Math.floor((positionInDay / dailyLimit) * windowMinutes) + Math.floor(Math.random() * 15);
        const scheduledAt = new Date();
        scheduledAt.setDate(scheduledAt.getDate() + dayOffset);
        scheduledAt.setHours(startHour, minuteOffset, Math.floor(Math.random() * 60), 0);

        queueAfter.run(
          userId!,
          contactId,
          sequence_id,
          1,
          step.action,
          messageText || null,
          scheduledAt.toISOString(),
          variantLabel || null,
        );
        updateContactStatus.run('queued', contactId, userId!);
        queued++;
      }
      return queued;
    });

    const queued = queueAll(shuffledIds);
    return NextResponse.json({ queued, total: ids.length });
  } catch (error: any) {
    console.error('BULK SEQUENCE ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
