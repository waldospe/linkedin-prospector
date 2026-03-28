import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api-auth';
import { queue, contacts, stats, users, globalConfig, templates, messages } from '@/lib/db';
import { substituteVariables } from '@/lib/constants';

export async function POST(req: NextRequest) {
  try {
    const { userId } = getUserFromRequest(req);
    const user = users.getById(userId) as any;
    const cfg = globalConfig.get();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check daily limit
    const today = stats.getToday(userId);
    const dailyUsed = today.connections_sent + today.messages_sent;
    if (dailyUsed >= user.daily_limit) {
      return NextResponse.json({ error: 'Daily limit reached', processed: 0 });
    }

    const pending = queue.getPending(userId) as any[];
    const remaining = user.daily_limit - dailyUsed;
    const batch = pending.slice(0, Math.min(5, remaining));
    const processed: number[] = [];
    const errors: string[] = [];

    for (const item of batch) {
      try {
        // Build the contact data for variable substitution
        const contact = {
          first_name: item.first_name,
          last_name: item.last_name,
          name: item.contact_name,
          company: item.company,
          title: item.title,
        };

        // Resolve the message text
        let messageText = item.message_text || '';
        if (!messageText && item.sequence_steps) {
          const steps = typeof item.sequence_steps === 'string' ? JSON.parse(item.sequence_steps) : item.sequence_steps;
          const step = steps[item.step_number - 1];
          if (step?.template) {
            messageText = substituteVariables(step.template, contact);
          } else if (step?.template_id) {
            const tmpl = templates.getById(step.template_id) as any;
            if (tmpl) messageText = substituteVariables(tmpl.body, contact);
          }
        }

        // Execute the action via Unipile
        if (cfg?.unipile_api_key && user.unipile_account_id) {
          const dsn = cfg.unipile_dsn || 'api21.unipile.com:15135';
          const baseUrl = `https://${dsn}/api/v1`;

          if (item.action_type === 'connection') {
            // Send connection request
            if (!item.linkedin_url) {
              queue.updateStatus(item.id, 'failed', userId, 'No LinkedIn URL for contact');
              contacts.updateStatus(item.contact_id, 'no_response', userId);
              continue;
            }

            const res = await fetch(`${baseUrl}/users/invitation`, {
              method: 'POST',
              headers: {
                'X-API-KEY': cfg.unipile_api_key,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
              body: JSON.stringify({
                account_id: user.unipile_account_id,
                profile_url: item.linkedin_url,
                message: messageText || undefined,
              }),
            });

            if (!res.ok) {
              const errText = await res.text();
              queue.updateStatus(item.id, 'failed', userId, `Unipile error: ${errText.slice(0, 200)}`);
              errors.push(`Connection to ${item.contact_name}: ${errText.slice(0, 100)}`);
              continue;
            }

            queue.updateStatus(item.id, 'completed', userId);
            contacts.updateStatus(item.contact_id, 'invite_sent', userId);
            stats.increment('connections_sent', userId);

          } else if (item.action_type === 'message') {
            // Send message
            if (!item.linkedin_url) {
              queue.updateStatus(item.id, 'failed', userId, 'No LinkedIn URL for contact');
              continue;
            }

            // Look up the user's profile to get attendee_id
            const profileRes = await fetch(
              `${baseUrl}/users/?linkedin=${encodeURIComponent(item.linkedin_url)}&account_id=${user.unipile_account_id}`,
              {
                headers: {
                  'X-API-KEY': cfg.unipile_api_key,
                  'Accept': 'application/json',
                },
              }
            );

            if (!profileRes.ok) {
              queue.updateStatus(item.id, 'failed', userId, 'Failed to look up LinkedIn profile');
              errors.push(`Message to ${item.contact_name}: profile lookup failed`);
              continue;
            }

            const profile = await profileRes.json();

            const msgRes = await fetch(`${baseUrl}/chats`, {
              method: 'POST',
              headers: {
                'X-API-KEY': cfg.unipile_api_key,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
              body: JSON.stringify({
                account_id: user.unipile_account_id,
                attendee_id: profile.id,
                text: messageText,
              }),
            });

            if (!msgRes.ok) {
              const errText = await msgRes.text();
              queue.updateStatus(item.id, 'failed', userId, `Unipile error: ${errText.slice(0, 200)}`);
              errors.push(`Message to ${item.contact_name}: ${errText.slice(0, 100)}`);
              continue;
            }

            queue.updateStatus(item.id, 'completed', userId);
            contacts.updateStatus(item.contact_id, 'msg_sent', userId);
            stats.increment('messages_sent', userId);

            // Log the message
            if (messageText) {
              messages.create(userId, { contact_id: item.contact_id, content: messageText });
            }
          }
        } else {
          // No Unipile configured — mark as failed with helpful message
          const reason = !cfg?.unipile_api_key
            ? 'Unipile API key not configured (admin setting)'
            : 'No Unipile account linked to your profile';
          queue.updateStatus(item.id, 'failed', userId, reason);
          errors.push(reason);
          continue;
        }

        processed.push(item.id);

        // Schedule next step in sequence if applicable
        if (item.sequence_id && item.sequence_steps) {
          const steps = typeof item.sequence_steps === 'string' ? JSON.parse(item.sequence_steps) : item.sequence_steps;
          const nextStepIdx = item.step_number; // 0-indexed next = current step_number (which is 1-indexed)
          if (nextStepIdx < steps.length) {
            const nextStep = steps[nextStepIdx];
            const delayMs = (nextStep.delay_hours || 0) * 60 * 60 * 1000;
            const scheduledAt = new Date(Date.now() + delayMs).toISOString();

            // Resolve message for next step
            const nextMessage = nextStep.template
              ? substituteVariables(nextStep.template, contact)
              : '';

            queue.create(userId, {
              contact_id: item.contact_id,
              sequence_id: item.sequence_id,
              step_number: item.step_number + 1,
              action_type: nextStep.action,
              message_text: nextMessage,
              scheduled_at: scheduledAt,
            });
          }
        }

        // Randomized delay between actions (respect user's timing settings)
        if (batch.indexOf(item) < batch.length - 1) {
          const delayMin = (user.message_delay_min || 15) * 1000; // convert to ms (using seconds for processing, not minutes)
          const delayMax = (user.message_delay_max || 20) * 1000;
          const delay = Math.floor(Math.random() * (delayMax - delayMin)) + delayMin;
          await new Promise(resolve => setTimeout(resolve, Math.min(delay, 5000))); // cap at 5s for API response
        }

      } catch (err: any) {
        queue.updateStatus(item.id, 'failed', userId, err.message?.slice(0, 200));
        errors.push(`${item.contact_name}: ${err.message?.slice(0, 100)}`);
      }
    }

    return NextResponse.json({
      processed: processed.length,
      errors: errors.length > 0 ? errors : undefined,
      dailyRemaining: user.daily_limit - dailyUsed - processed.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
