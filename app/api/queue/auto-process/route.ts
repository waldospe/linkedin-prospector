import { NextRequest, NextResponse } from 'next/server';
import { queue, contacts, stats, users, globalConfig, templates, messages, sequences } from '@/lib/db';
import { substituteVariables } from '@/lib/constants';
import { sendAlertEmail } from '@/lib/email';

// Track error rate for alerting
let consecutiveEmptyCycles = 0;
let lastAlertSent = 0;

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
    const results: Array<{ user: string; processed: number; skipped?: number; errors: string[]; monitored?: number }> = [];
    const dsn = cfg.unipile_dsn || 'api21.unipile.com:15135';
    const baseUrl = `https://${dsn}/api/v1`;

    for (const user of allUsers) {
      // Skip users without Unipile account
      if (!user.unipile_account_id) continue;

      // === PHASE 1: Monitor invite acceptances and replies (runs regardless of send window) ===
      let monitored = 0;
      try {
        monitored = await monitorContacts(user, cfg, baseUrl);
      } catch (e: any) {
        console.error(`Monitor error for ${user.name}:`, e.message);
      }

      // Check send schedule in user's timezone
      if (!isInSendWindow(user.send_schedule, user.timezone)) {
        if (monitored > 0) results.push({ user: user.name, processed: 0, errors: [], monitored });
        continue;
      }

      // Check daily limit
      const today = stats.getToday(user.id);
      const dailyUsed = today.connections_sent + today.messages_sent;
      if (dailyUsed >= user.daily_limit) {
        if (monitored > 0) results.push({ user: user.name, processed: 0, errors: [], monitored });
        continue;
      }

      // Get pending items (only those scheduled for now or earlier)
      const pending = queue.getPending(user.id) as any[];
      const ready = pending.filter(item => {
        if (!item.scheduled_at) return true;
        return new Date(item.scheduled_at) <= new Date();
      });

      if (ready.length === 0) {
        if (monitored > 0) results.push({ user: user.name, processed: 0, errors: [], monitored });
        continue;
      }

      const remaining = user.daily_limit - dailyUsed;
      // Only process 1-2 ACTUAL sends per cycle (every 2 min = ~30-60 sends per 9hr window)
      // Allow extra buffer for skips since those don't hit the API
      const maxSendsPerCycle = 2;
      const batch = ready.slice(0, Math.min(maxSendsPerCycle + 5, remaining + 5)); // buffer for skips
      const processed: number[] = []; // actual sends (count toward daily limit)
      const skipped: number[] = []; // already connected — don't count
      const errors: string[] = [];

      for (const item of batch) {
        // Stop if we've hit the per-cycle or daily limit with actual sends
        if (processed.length >= maxSendsPerCycle || processed.length >= remaining) break;

        try {
          // Verify this queue item's contact belongs to this user
          const ownedContact = contacts.getById(item.contact_id, user.id);
          if (!ownedContact) {
            console.log(`SKIP ${item.contact_name} — contact not owned by ${user.name}`);
            queue.updateStatus(item.id, 'failed', user.id, 'Contact belongs to another user');
            continue;
          }

          // Pre-check: if this is a connection request, check contact status in our DB first
          // This avoids unnecessary API calls and doesn't count toward daily limit
          if (item.action_type === 'connection') {
            const contactStatus = (contacts.getById(item.contact_id, user.id) as any)?.status;
            if (contactStatus === 'invite_sent' || contactStatus === 'invite_pending') {
              // Already have a pending invite — skip, don't count
              console.log(`SKIP ${item.contact_name} — invite already pending (${contactStatus})`);
              queue.updateStatus(item.id, 'completed', user.id);
              skipped.push(item.id);
              continue;
            }
            if (contactStatus === 'connected' || contactStatus === 'msg_sent' || contactStatus === 'replied' || contactStatus === 'engaged') {
              // Already connected — skip entire connection sequence
              console.log(`SKIP ${item.contact_name} — already ${contactStatus}`);
              queue.updateStatus(item.id, 'completed', user.id);
              skipped.push(item.id);
              continue;
            }
          }

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

          // Look up LinkedIn profile to get provider_id
          if (!item.linkedin_url) {
            queue.updateStatus(item.id, 'failed', user.id, 'No LinkedIn URL');
            continue;
          }
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
            const errText = await profileRes.text();
            queue.updateStatus(item.id, 'failed', user.id, `Profile lookup failed: ${errText.slice(0, 150)}`);
            errors.push(`${item.contact_name}: profile lookup failed`);
            continue;
          }

          const profile = await profileRes.json();
          const providerId = profile.provider_id || profile.id;
          const alreadyConnected = profile.is_relationship === true || profile.network_distance === 'FIRST_DEGREE';

          if (item.action_type === 'connection') {
            // Skip connection request if already connected — does NOT count toward daily limit
            if (alreadyConnected) {
              console.log(`SKIP invite for ${item.contact_name} — already connected`);
              queue.updateStatus(item.id, 'completed', user.id);
              contacts.updateStatus(item.contact_id, 'connected', user.id);
              // Do NOT queue follow-up messages from connection sequences for already-connected contacts.
              // The sequence was designed for new connections. If they're already connected,
              // the outreach context doesn't apply.
              // (Message-only sequences assigned to connected contacts will work fine separately.)
              continue; // skip without counting toward daily limit
            }

            const res = await fetch(`${baseUrl}/users/invite`, {
              method: 'POST',
              headers: apiHeaders,
              body: JSON.stringify({
                account_id: user.unipile_account_id,
                provider_id: providerId,
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
            if (!alreadyConnected) {
              queue.updateStatus(item.id, 'failed', user.id, 'Cannot message — not connected on LinkedIn');
              errors.push(`${item.contact_name}: not connected`);
              continue;
            }

            const msgRes = await fetch(`${baseUrl}/chats`, {
              method: 'POST',
              headers: apiHeaders,
              body: JSON.stringify({
                account_id: user.unipile_account_id,
                attendees_ids: [providerId],
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

      if (processed.length > 0 || skipped.length > 0 || errors.length > 0 || monitored > 0) {
        results.push({ user: user.name, processed: processed.length, skipped: skipped.length, errors, monitored });
      }
    }

    // Alert on high error rates (more than 5 errors in one cycle, max 1 alert per hour)
    const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);
    if (totalErrors > 5 && Date.now() - lastAlertSent > 3600000) {
      lastAlertSent = Date.now();
      const errorSummary = results.flatMap(r => r.errors.map(e => `${r.user}: ${e}`)).join('\n');
      sendAlertEmail({ subject: `${totalErrors} queue errors this cycle`, body: errorSummary }).catch(() => {});
    }

    return NextResponse.json({ results, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error('Auto-process error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Monitor contacts for invite acceptances and replies
async function monitorContacts(user: any, cfg: any, baseUrl: string): Promise<number> {
  let updated = 0;
  const apiHeaders = { 'X-API-KEY': cfg.unipile_api_key, 'Accept': 'application/json' };

  // Check contacts with invite_sent — have they accepted?
  const inviteSent = contacts.getByStatus('invite_sent', user.id) as any[];
  for (const contact of inviteSent.slice(0, 15)) { // check up to 15 per cycle
    if (!contact.linkedin_url) continue;
    const slugMatch = contact.linkedin_url.match(/linkedin\.com\/in\/([a-zA-Z0-9\-_.]+)/);
    if (!slugMatch) continue;

    try {
      const res = await fetch(`${baseUrl}/users/${slugMatch[1]}?account_id=${user.unipile_account_id}`, { headers: apiHeaders });
      if (!res.ok) continue;

      const profile = await res.json();
      if (profile.is_relationship === true || profile.network_distance === 'FIRST_DEGREE') {
        // They accepted! Update status and queue next sequence step
        contacts.updateStatus(contact.id, 'connected', user.id);
        updated++;

        // Find the last completed queue item for this contact to advance the sequence
        const lastItem = queue.getLastCompletedForContact(user.id, contact.id);
        if (lastItem?.sequence_id && lastItem.sequence_steps) {
          const steps = typeof lastItem.sequence_steps === 'string' ? JSON.parse(lastItem.sequence_steps) : lastItem.sequence_steps;
          const nextStepIdx = lastItem.step_number; // 0-indexed next
          if (nextStepIdx < steps.length) {
            const nextStep = steps[nextStepIdx];
            const contactData = {
              first_name: contact.first_name, last_name: contact.last_name,
              name: contact.name, company: contact.company, title: contact.title,
            };
            const nextMessage = nextStep.template
              ? substituteVariables(nextStep.template, contactData)
              : '';
            queue.create(user.id, {
              contact_id: contact.id,
              sequence_id: lastItem.sequence_id,
              step_number: lastItem.step_number + 1,
              action_type: nextStep.action,
              message_text: nextMessage,
              scheduled_at: new Date(Date.now() + (nextStep.delay_hours || 0) * 3600000).toISOString(),
            });
          }
        }
      } else {
        // Check if invite has been pending too long (14 days)
        const createdAt = new Date(contact.created_at).getTime();
        const daysPending = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
        if (daysPending > 14) {
          contacts.updateStatus(contact.id, 'no_response', user.id);
          updated++;
        }
      }
    } catch {
      // Skip on error, will retry next cycle
    }

    // Small delay between API calls
    await new Promise(r => setTimeout(r, 500));
  }

  // Check contacts with msg_sent — have they replied?
  const msgSent = contacts.getByStatus('msg_sent', user.id) as any[];
  for (const contact of msgSent.slice(0, 15)) {
    if (!contact.linkedin_url) continue;
    const slugMatch = contact.linkedin_url.match(/linkedin\.com\/in\/([a-zA-Z0-9\-_.]+)/);
    if (!slugMatch) continue;

    try {
      // Check if there's a chat with this person that has new messages from them
      const res = await fetch(
        `${baseUrl}/users/${slugMatch[1]}?account_id=${user.unipile_account_id}`,
        { headers: apiHeaders }
      );
      if (!res.ok) continue;
      const profile = await res.json();
      const providerId = profile.provider_id || profile.id;

      // Check chats for messages from this person
      const chatsRes = await fetch(
        `${baseUrl}/chats?account_id=${user.unipile_account_id}&attendee_id=${providerId}&limit=1`,
        { headers: apiHeaders }
      );
      if (!chatsRes.ok) continue;
      const chatsData = await chatsRes.json();
      const chatItems = chatsData.items || chatsData || [];

      if (Array.isArray(chatItems) && chatItems.length > 0) {
        const chat = chatItems[0];
        // If the last message is from the other person (not us), they replied
        if (chat.last_message && chat.last_message.sender_id === providerId) {
          contacts.updateStatus(contact.id, 'replied', user.id);
          stats.increment('replies_received', user.id);
          messages.markReplied(contact.id, user.id);
          updated++;
        }
      }
    } catch {
      // Skip on error
    }

    await new Promise(r => setTimeout(r, 500));
  }

  return updated;
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
