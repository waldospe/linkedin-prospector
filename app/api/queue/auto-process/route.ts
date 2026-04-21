import { NextRequest, NextResponse } from 'next/server';
import { queue, contacts, stats, users, globalConfig, messages, getDb, contactEvents, warmup } from '@/lib/db';
import { substituteVariables } from '@/lib/constants';
import { sendAlertEmail, sendReplyAlertEmail } from '@/lib/email';
import { getProfile, sendInvite, sendMessage, getChats, isConnected, extractLinkedInSlug } from '@/lib/unipile';
import { QUEUE_CONSTANTS } from '@/lib/types';

// Timeout wrapper for raw fetch calls not yet migrated to unipile client
function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, { ...options, signal: AbortSignal.timeout(QUEUE_CONSTANTS.FETCH_TIMEOUT_MS) });
}

const {
  MAX_CONNECTIONS_PER_CYCLE, MAX_MESSAGES_PER_CYCLE, CONNECTION_BUFFER_SIZE,
  MONITOR_INVITE_BATCH, MONITOR_REPLY_BATCH, INVITE_TIMEOUT_DAYS,
  MIN_GAP_FRACTION, MIN_GAP_MINUTES, INTER_ACTION_DELAY, MONITOR_API_DELAY,
  ERROR_ALERT_THRESHOLD, ALERT_COOLDOWN_MS,
} = QUEUE_CONSTANTS;

// Track error rate for alerting
let lastAlertSent = 0;

// Auto-process queue for ALL users who are within their send window and under daily limits.
// Called by a cron job every 2-3 minutes. No auth required — secured by a secret token.
export async function POST(req: NextRequest) {
  try {
    // Cron secret — must be set in environment
    const authHeader = req.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
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

      // Split into messages (unlimited, process all) and connections (daily-limited, spaced)
      const readyMessages = ready.filter(item => item.action_type === 'message');
      const readyConnections = ready.filter(item => item.action_type === 'connection');

      // Daily limit — use warmup limit if enabled, otherwise user's configured limit
      const effectiveLimit = warmup.getEffectiveLimit(user.id);
      const today = stats.getToday(user.id, user.timezone);
      const connectionsRemaining = effectiveLimit - today.connections_sent;

      // Connection spacing: spread evenly across the send window
      const db = getDb();
      let connectionAllowed = connectionsRemaining > 0;
      if (connectionAllowed && readyConnections.length > 0) {
        const schedule = user.send_schedule || {};
        const tz = user.timezone || 'America/Los_Angeles';
        const nowLocal = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
        const daysArr = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const daySchedule = schedule[daysArr[nowLocal.getDay()]] || { start: '08:00', end: '17:00' };
        const [sH, sM] = (daySchedule.start || '08:00').split(':').map(Number);
        const [eH, eM] = (daySchedule.end || '17:00').split(':').map(Number);
        const windowMinutes = (eH * 60 + eM) - (sH * 60 + sM);
        const baseGapMinutes = connectionsRemaining > 0 ? Math.floor(windowMinutes / connectionsRemaining) : 30;
        const minGapMinutes = Math.max(MIN_GAP_MINUTES, Math.floor(baseGapMinutes * MIN_GAP_FRACTION));

        const lastConnection = db.prepare(
          "SELECT executed_at FROM queue WHERE user_id = ? AND action_type = 'connection' AND status = 'completed' AND executed_at IS NOT NULL ORDER BY executed_at DESC LIMIT 1"
        ).get(user.id) as any;

        if (lastConnection?.executed_at) {
          const lastTime = new Date(lastConnection.executed_at + (lastConnection.executed_at.includes('Z') ? '' : 'Z'));
          const minutesSince = (Date.now() - lastTime.getTime()) / 60000;
          if (minutesSince < minGapMinutes) {
            connectionAllowed = false;
          }
        }
      }

      const batch = [
        ...readyMessages.slice(0, MAX_MESSAGES_PER_CYCLE),
        ...(connectionAllowed ? readyConnections.slice(0, CONNECTION_BUFFER_SIZE) : []),
      ];

      if (batch.length === 0) {
        if (monitored > 0) results.push({ user: user.name, processed: 0, errors: [], monitored });
        continue;
      }

      const processed: number[] = [];
      const skipped: number[] = [];
      const errors: string[] = [];
      let connectionsSentThisCycle = 0;

      for (const item of batch) {
        // Connections: max 1 per cycle, respect daily limit
        if (item.action_type === 'connection') {
          if (connectionsSentThisCycle >= MAX_CONNECTIONS_PER_CYCLE || (today.connections_sent + connectionsSentThisCycle) >= effectiveLimit) continue;
        }

        try {
          // Verify this queue item's contact belongs to this user
          const ownedContact = contacts.getById(item.contact_id, user.id);
          if (!ownedContact) {
            // Skip: ${item.contact_name} — contact not owned by ${user.name}`);
            queue.updateStatus(item.id, 'failed', user.id, 'Contact belongs to another user');
            continue;
          }

          // Pre-check: if this is a connection request, check contact status in our DB first
          // This avoids unnecessary API calls and doesn't count toward daily limit
          if (item.action_type === 'connection') {
            const contactStatus = (contacts.getById(item.contact_id, user.id) as any)?.status;
            if (contactStatus === 'invite_sent' || contactStatus === 'invite_pending') {
              // Already have a pending invite — skip, don't count
              // Skip: ${item.contact_name} — invite already pending (${contactStatus})`);
              queue.updateStatus(item.id, 'completed', user.id);
              skipped.push(item.id);
              continue;
            }
            if (contactStatus === 'connected' || contactStatus === 'msg_sent' || contactStatus === 'replied' || contactStatus === 'engaged') {
              // Already connected — skip entire connection sequence
              // Skip: ${item.contact_name} — already ${contactStatus}`);
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

          const profileRes = await fetchWithTimeout(
            `${baseUrl}/users/${slugMatch[1]}?account_id=${user.unipile_account_id}`,
            { headers: { 'X-API-KEY': cfg.unipile_api_key, 'Accept': 'application/json' } }
          );

          if (!profileRes.ok) {
            const errText = await profileRes.text();
            const isRetryable = profileRes.status >= 429 || profileRes.status >= 500;
            if (isRetryable) {
              queue.markRetryable(item.id, user.id, `Profile lookup ${profileRes.status}: ${errText.slice(0, 150)}`);
            } else {
              queue.updateStatus(item.id, 'failed', user.id, `Profile lookup failed: ${errText.slice(0, 150)}`);
            }
            errors.push(`${item.contact_name}: profile lookup failed`);
            continue;
          }

          const profile = await profileRes.json();
          const providerId = profile.provider_id || profile.id;
          const alreadyConnected = profile.is_relationship === true || profile.network_distance === 'FIRST_DEGREE';

          if (item.action_type === 'connection') {
            // Skip connection request if already connected — does NOT count toward daily limit
            if (alreadyConnected) {
              // Skip: already connected
              queue.updateStatus(item.id, 'completed', user.id);
              contacts.updateStatus(item.contact_id, 'connected', user.id);
              // Do NOT queue follow-up messages from connection sequences for already-connected contacts.
              // The sequence was designed for new connections. If they're already connected,
              // the outreach context doesn't apply.
              // (Message-only sequences assigned to connected contacts will work fine separately.)
              continue; // skip without counting toward daily limit
            }

            const res = await fetchWithTimeout(`${baseUrl}/users/invite`, {
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
            stats.increment('connections_sent', user.id, user.timezone);
            contactEvents.log(user.id, item.contact_id, 'invite_sent', undefined, messageText?.slice(0, 200) || undefined, item.sequence_name);
            connectionsSentThisCycle++;

          } else if (item.action_type === 'message') {
            if (!alreadyConnected) {
              queue.updateStatus(item.id, 'failed', user.id, 'Cannot message — not connected on LinkedIn');
              errors.push(`${item.contact_name}: not connected`);
              continue;
            }

            const msgRes = await fetchWithTimeout(`${baseUrl}/chats`, {
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
            stats.increment('messages_sent', user.id, user.timezone);
            contactEvents.log(user.id, item.contact_id, 'message_sent', undefined, messageText?.slice(0, 200) || undefined, item.sequence_name);

            if (messageText) {
              messages.create(user.id, { contact_id: item.contact_id, content: messageText });
            }
          }

          processed.push(item.id);

          // Schedule next sequence step — but ONLY if current step was a message.
          // If current step was a connection request, the follow-up message should NOT be
          // queued until the connection is accepted. The monitorContacts() function handles
          // that by detecting acceptance and queuing the next step at that time.
          if (item.sequence_id && item.sequence_steps && item.action_type === 'message') {
            const steps = typeof item.sequence_steps === 'string' ? JSON.parse(item.sequence_steps) : item.sequence_steps;
            const nextStepIdx = item.step_number;
            if (nextStepIdx < steps.length) {
              // Atomic dedup: INSERT only if no pending step exists for this contact+step
              const nextStep = steps[nextStepIdx];
              const delayMs = (nextStep.delay_hours || 0) * 60 * 60 * 1000;
              const scheduledAt = new Date(Date.now() + delayMs).toISOString();
              const nextMessage = nextStep.template
                ? substituteVariables(nextStep.template, contact)
                : '';

              getDb().prepare(`
                INSERT INTO queue (user_id, contact_id, sequence_id, step_number, action_type, message_text, scheduled_at)
                SELECT ?, ?, ?, ?, ?, ?, ?
                WHERE NOT EXISTS (
                  SELECT 1 FROM queue WHERE user_id = ? AND contact_id = ? AND step_number = ? AND status = 'pending'
                )
              `).run(
                user.id, item.contact_id, item.sequence_id, item.step_number + 1, nextStep.action, nextMessage, scheduledAt,
                user.id, item.contact_id, item.step_number + 1,
              );
            }
          }

          if (batch.indexOf(item) < batch.length - 1) {
            const delay = INTER_ACTION_DELAY[0] + Math.floor(Math.random() * (INTER_ACTION_DELAY[1] - INTER_ACTION_DELAY[0]));
            await new Promise(resolve => setTimeout(resolve, delay));
          }

        } catch (err: any) {
          const isTimeout = err.name === 'TimeoutError' || err.message?.includes('timeout');
          if (isTimeout) {
            queue.markRetryable(item.id, user.id, `Timeout: ${err.message?.slice(0, 150)}`);
          } else {
            queue.updateStatus(item.id, 'failed', user.id, err.message?.slice(0, 200));
          }
          errors.push(`${item.contact_name}: ${err.message?.slice(0, 100)}`);
        }
      }

      if (processed.length > 0 || skipped.length > 0 || errors.length > 0 || monitored > 0) {
        results.push({ user: user.name, processed: processed.length, skipped: skipped.length, errors, monitored });
      }
    }

    // Alert on high error rates (more than 5 errors in one cycle, max 1 alert per hour)
    const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);
    if (totalErrors > ERROR_ALERT_THRESHOLD && Date.now() - lastAlertSent > ALERT_COOLDOWN_MS) {
      lastAlertSent = Date.now();
      const errorSummary = results.flatMap(r => r.errors.map(e => `${r.user}: ${e}`)).join('\n');
      sendAlertEmail({ subject: `${totalErrors} queue errors this cycle`, body: errorSummary }).catch((e) => console.error('[auto-process] Alert email failed:', e.message));
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
  for (const contact of inviteSent.slice(0, MONITOR_INVITE_BATCH)) {
    if (!contact.linkedin_url) continue;
    const slugMatch = contact.linkedin_url.match(/linkedin\.com\/in\/([a-zA-Z0-9\-_.]+)/);
    if (!slugMatch) continue;

    try {
      const res = await fetchWithTimeout(`${baseUrl}/users/${slugMatch[1]}?account_id=${user.unipile_account_id}`, { headers: apiHeaders });
      if (!res.ok) continue;

      const profile = await res.json();
      if (profile.is_relationship === true || profile.network_distance === 'FIRST_DEGREE') {
        // They accepted! Update status and queue next sequence step
        contacts.updateStatus(contact.id, 'connected', user.id);
        contactEvents.log(user.id, contact.id, 'connection_accepted');
        updated++;

        // Find the last completed queue item for this contact to advance the sequence
        const lastItem = queue.getLastCompletedForContact(user.id, contact.id);
        if (lastItem?.sequence_id && lastItem.sequence_steps) {
          const steps = typeof lastItem.sequence_steps === 'string' ? JSON.parse(lastItem.sequence_steps) : lastItem.sequence_steps;
          const nextStepIdx = lastItem.step_number; // 0-indexed next
          if (nextStepIdx < steps.length) {
            // Atomic dedup: INSERT only if no pending step exists
            const nextStep = steps[nextStepIdx];
            const contactData = {
              first_name: contact.first_name, last_name: contact.last_name,
              name: contact.name, company: contact.company, title: contact.title,
            };
            const nextMessage = nextStep.template
              ? substituteVariables(nextStep.template, contactData)
              : '';
            const scheduledAt = new Date(Date.now() + (nextStep.delay_hours || 0) * 3600000).toISOString();
            getDb().prepare(`
              INSERT INTO queue (user_id, contact_id, sequence_id, step_number, action_type, message_text, scheduled_at)
              SELECT ?, ?, ?, ?, ?, ?, ?
              WHERE NOT EXISTS (
                SELECT 1 FROM queue WHERE user_id = ? AND contact_id = ? AND step_number = ? AND status = 'pending'
              )
            `).run(
              user.id, contact.id, lastItem.sequence_id, lastItem.step_number + 1, nextStep.action, nextMessage, scheduledAt,
              user.id, contact.id, lastItem.step_number + 1,
            );
          }
        }
      } else {
        // Check if invite has been pending too long (14 days)
        const createdAt = new Date(contact.created_at).getTime();
        const daysPending = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
        if (daysPending > INVITE_TIMEOUT_DAYS) {
          contacts.updateStatus(contact.id, 'no_response', user.id);
          updated++;
        }
      }
    } catch {
      // Skip on error, will retry next cycle
    }

    // Small delay between API calls
    await new Promise(r => setTimeout(r, MONITOR_API_DELAY));
  }

  // Check contacts with msg_sent — have they replied?
  const msgSent = contacts.getByStatus('msg_sent', user.id) as any[];
  for (const contact of msgSent.slice(0, MONITOR_REPLY_BATCH)) {
    if (!contact.linkedin_url) continue;
    const slugMatch = contact.linkedin_url.match(/linkedin\.com\/in\/([a-zA-Z0-9\-_.]+)/);
    if (!slugMatch) continue;

    try {
      // Check if there's a chat with this person that has new messages from them
      const res = await fetchWithTimeout(
        `${baseUrl}/users/${slugMatch[1]}?account_id=${user.unipile_account_id}`,
        { headers: apiHeaders }
      );
      if (!res.ok) continue;
      const profile = await res.json();
      const providerId = profile.provider_id || profile.id;

      // Check chats for messages from this person
      const chatsRes = await fetchWithTimeout(
        `${baseUrl}/chats?account_id=${user.unipile_account_id}&attendee_id=${providerId}&limit=1`,
        { headers: apiHeaders }
      );
      if (!chatsRes.ok) continue;
      const chatsData = await chatsRes.json();
      let chatItems = chatsData.items || chatsData || [];
      let foundChatId: string | null = Array.isArray(chatItems) && chatItems.length > 0 ? chatItems[0].id : null;

      // Fallback: scan recent chats if attendee_id filter returns empty
      if (!foundChatId) {
        try {
          const allChatsRes = await fetchWithTimeout(
            `${baseUrl}/chats?account_id=${user.unipile_account_id}&limit=30`,
            { headers: apiHeaders }
          );
          if (allChatsRes.ok) {
            const allChats = await allChatsRes.json();
            for (const chat of (allChats.items || [])) {
              const msgsCheck = await fetchWithTimeout(
                `${baseUrl}/chats/${chat.id}/messages?limit=3`,
                { headers: apiHeaders }
              );
              if (msgsCheck.ok) {
                const msgs = (await msgsCheck.json()).items || [];
                if (msgs.some((m: any) => (m.sender_id || m.sender?.id) === providerId)) {
                  foundChatId = chat.id;
                  break;
                }
              }
            }
          }
        } catch { /* fallback failed, try next cycle */ }
      }

      if (foundChatId) {
        const chat = { id: foundChatId, last_message: chatItems[0]?.last_message };

        // Fetch recent messages in the chat to check for ANY reply from them
        // (not just last_message, which misses replies if we sent a follow-up after)
        let hasReply = false;
        let replyText: string | null = null;

        if (chat.last_message && chat.last_message.sender_id === providerId) {
          // Simple case: last message is from them
          hasReply = true;
          replyText = chat.last_message.text || chat.last_message.body || null;
        } else {
          // Check message history — look for any message from them
          try {
            const msgsRes = await fetchWithTimeout(
              `${baseUrl}/chats/${foundChatId}/messages?limit=10`,
              { headers: apiHeaders }
            );
            if (msgsRes.ok) {
              const msgsData = await msgsRes.json();
              const msgs = msgsData.items || msgsData || [];
              const theirMessage = msgs.find((m: any) => (m.sender_id || m.sender?.id) === providerId);
              if (theirMessage) {
                hasReply = true;
                replyText = theirMessage.text || theirMessage.body || null;
              }
            }
          } catch { /* message fetch failed, try again next cycle */ }
        }

        if (hasReply) {
          contacts.updateStatus(contact.id, 'replied', user.id);
          stats.increment('replies_received', user.id, user.timezone);
          messages.markReplied(contact.id, user.id);
          contactEvents.log(user.id, contact.id, 'reply_received', replyText?.slice(0, 200) || undefined);
          updated++;

          // Fire instant reply alert email (if user opted in)
          if (user.email_reply_alerts !== 0 && user.email) {
            // Fire reply alert — log failures instead of swallowing
          sendReplyAlertEmail({
              to: user.email,
              userName: user.name,
              contactName: [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.name || 'Your contact',
              contactCompany: contact.company,
              contactTitle: contact.title,
              contactId: contact.id,
            }).catch((e: any) => console.error('[auto-process] Reply alert email failed:', e.message));
          }
        }
      }
    } catch {
      // Skip on error
    }

    await new Promise(r => setTimeout(r, MONITOR_API_DELAY));
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
