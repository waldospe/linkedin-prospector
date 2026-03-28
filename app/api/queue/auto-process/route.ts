import { NextRequest, NextResponse } from 'next/server';
import { queue, contacts, stats, users, globalConfig, templates, messages, sequences } from '@/lib/db';
import { substituteVariables } from '@/lib/constants';

// Auto-process queue for ALL users who are within their send window and under daily limits.
// Called by a cron job every 2-3 minutes. No auth required — secured by a secret token.
export async function POST(req: NextRequest) {
  try {
    // Simple secret to prevent unauthorized triggering
    const authHeader = req.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET || 'moco-cron-secret';
    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cfg = globalConfig.get();
    if (!cfg?.unipile_api_key) {
      return NextResponse.json({ error: 'Unipile not configured', processed: 0 });
    }

    const allUsers = users.getAll() as any[];
    const results: Array<{ user: string; processed: number; errors: string[] }> = [];

    for (const user of allUsers) {
      // Skip users without Unipile account
      if (!user.unipile_account_id) continue;

      // Check send schedule in user's timezone
      if (!isInSendWindow(user.send_schedule, user.timezone)) continue;

      // Check daily limit
      const today = stats.getToday(user.id);
      const dailyUsed = today.connections_sent + today.messages_sent;
      if (dailyUsed >= user.daily_limit) continue;

      // Get pending items (only those scheduled for now or earlier)
      const pending = queue.getPending(user.id) as any[];
      const ready = pending.filter(item => {
        if (!item.scheduled_at) return true;
        return new Date(item.scheduled_at) <= new Date();
      });

      if (ready.length === 0) continue;

      const remaining = user.daily_limit - dailyUsed;
      const batch = ready.slice(0, Math.min(3, remaining)); // process up to 3 per cycle
      const processed: number[] = [];
      const errors: string[] = [];

      for (const item of batch) {
        try {
          const contact = {
            first_name: item.first_name,
            last_name: item.last_name,
            name: item.contact_name,
            company: item.company,
            title: item.title,
          };

          // Resolve message text
          let messageText = item.message_text || '';
          if (!messageText && item.sequence_steps) {
            const steps = typeof item.sequence_steps === 'string' ? JSON.parse(item.sequence_steps) : item.sequence_steps;
            const step = steps[item.step_number - 1];
            if (step?.template) {
              messageText = substituteVariables(step.template, contact);
            }
          }

          const dsn = cfg.unipile_dsn || 'api21.unipile.com:15135';
          const baseUrl = `https://${dsn}/api/v1`;
          const apiHeaders = {
            'X-API-KEY': cfg.unipile_api_key,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          };

          if (item.action_type === 'connection') {
            if (!item.linkedin_url) {
              queue.updateStatus(item.id, 'failed', user.id, 'No LinkedIn URL');
              continue;
            }

            const res = await fetch(`${baseUrl}/users/invitation`, {
              method: 'POST',
              headers: apiHeaders,
              body: JSON.stringify({
                account_id: user.unipile_account_id,
                profile_url: item.linkedin_url,
                message: messageText || undefined,
              }),
            });

            if (!res.ok) {
              const errText = await res.text();
              queue.updateStatus(item.id, 'failed', user.id, errText.slice(0, 200));
              errors.push(`${item.contact_name}: ${errText.slice(0, 100)}`);
              continue;
            }

            queue.updateStatus(item.id, 'completed', user.id);
            contacts.updateStatus(item.contact_id, 'invite_sent', user.id);
            stats.increment('connections_sent', user.id);

          } else if (item.action_type === 'message') {
            if (!item.linkedin_url) {
              queue.updateStatus(item.id, 'failed', user.id, 'No LinkedIn URL');
              continue;
            }

            // Extract slug from LinkedIn URL for profile lookup
            const slugMatch = item.linkedin_url.match(/linkedin\.com\/in\/([a-zA-Z0-9\-_.]+)/);
            if (!slugMatch) {
              queue.updateStatus(item.id, 'failed', user.id, 'Invalid LinkedIn URL format');
              continue;
            }

            const profileRes = await fetch(
              `${baseUrl}/users/${slugMatch[1]}?account_id=${user.unipile_account_id}`,
              { headers: { 'X-API-KEY': cfg.unipile_api_key, 'Accept': 'application/json' } }
            );

            if (!profileRes.ok) {
              queue.updateStatus(item.id, 'failed', user.id, 'Profile lookup failed');
              errors.push(`${item.contact_name}: profile lookup failed`);
              continue;
            }

            const profile = await profileRes.json();

            const msgRes = await fetch(`${baseUrl}/chats`, {
              method: 'POST',
              headers: apiHeaders,
              body: JSON.stringify({
                account_id: user.unipile_account_id,
                attendee_id: profile.id,
                text: messageText,
              }),
            });

            if (!msgRes.ok) {
              const errText = await msgRes.text();
              queue.updateStatus(item.id, 'failed', user.id, errText.slice(0, 200));
              errors.push(`${item.contact_name}: ${errText.slice(0, 100)}`);
              continue;
            }

            queue.updateStatus(item.id, 'completed', user.id);
            contacts.updateStatus(item.contact_id, 'msg_sent', user.id);
            stats.increment('messages_sent', user.id);

            if (messageText) {
              messages.create(user.id, { contact_id: item.contact_id, content: messageText });
            }
          }

          processed.push(item.id);

          // Schedule next sequence step
          if (item.sequence_id && item.sequence_steps) {
            const steps = typeof item.sequence_steps === 'string' ? JSON.parse(item.sequence_steps) : item.sequence_steps;
            const nextStepIdx = item.step_number;
            if (nextStepIdx < steps.length) {
              const nextStep = steps[nextStepIdx];
              const delayMs = (nextStep.delay_hours || 0) * 60 * 60 * 1000;
              const scheduledAt = new Date(Date.now() + delayMs).toISOString();
              const nextMessage = nextStep.template
                ? substituteVariables(nextStep.template, contact)
                : '';

              queue.create(user.id, {
                contact_id: item.contact_id,
                sequence_id: item.sequence_id,
                step_number: item.step_number + 1,
                action_type: nextStep.action,
                message_text: nextMessage,
                scheduled_at: scheduledAt,
              });
            }
          }

          // Random delay between actions (2-5 seconds during processing)
          if (batch.indexOf(item) < batch.length - 1) {
            const delay = 2000 + Math.floor(Math.random() * 3000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }

        } catch (err: any) {
          queue.updateStatus(item.id, 'failed', user.id, err.message?.slice(0, 200));
          errors.push(`${item.contact_name}: ${err.message?.slice(0, 100)}`);
        }
      }

      if (processed.length > 0 || errors.length > 0) {
        results.push({ user: user.name, processed: processed.length, errors });
      }
    }

    return NextResponse.json({ results, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error('Auto-process error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function isInSendWindow(schedule: any, timezone?: string): boolean {
  if (!schedule) return true;

  // Get current time in user's timezone
  const tz = timezone || 'America/Los_Angeles';
  const now = new Date();
  const userTime = new Date(now.toLocaleString('en-US', { timeZone: tz }));

  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayKey = days[userTime.getDay()];
  const daySchedule = schedule[dayKey];

  if (!daySchedule || !daySchedule.enabled) return false;

  const currentMinutes = userTime.getHours() * 60 + userTime.getMinutes();
  const [startH, startM] = (daySchedule.start || '08:00').split(':').map(Number);
  const [endH, endM] = (daySchedule.end || '17:00').split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}
