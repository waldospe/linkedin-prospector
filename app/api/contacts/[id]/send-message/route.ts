import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/api-auth';
import { contacts, users, globalConfig, messages, queue, activityLog } from '@/lib/db';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { effectiveUserId, userId: authUserId } = getEffectiveUser(req);
    const viewUserId = effectiveUserId || authUserId;
    const contactId = Number(params.id);
    const contact = contacts.getById(contactId, viewUserId) as any;
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    // Use the contact owner's Unipile account for API calls
    const contactOwner = users.getById(contact.user_id || viewUserId) as any;
    const user = contactOwner;
    const cfg = globalConfig.get();
    const { message } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }
    if (!cfg?.unipile_api_key || !user?.unipile_account_id) {
      return NextResponse.json({ error: 'Unipile not configured' }, { status: 400 });
    }
    if (!contact.linkedin_url) {
      return NextResponse.json({ error: 'Contact has no LinkedIn URL' }, { status: 400 });
    }

    const slugMatch = contact.linkedin_url.match(/linkedin\.com\/in\/([a-zA-Z0-9\-_.]+)/);
    if (!slugMatch) return NextResponse.json({ error: 'Invalid LinkedIn URL' }, { status: 400 });

    const dsn = cfg.unipile_dsn || 'api21.unipile.com:15135';
    const baseUrl = `https://${dsn}/api/v1`;
    const headers = { 'X-API-KEY': cfg.unipile_api_key, 'Content-Type': 'application/json', 'Accept': 'application/json' };

    // Look up profile to get provider_id
    const profileRes = await fetch(
      `${baseUrl}/users/${slugMatch[1]}?account_id=${user.unipile_account_id}`,
      { headers: { 'X-API-KEY': cfg.unipile_api_key, 'Accept': 'application/json' } }
    );
    if (!profileRes.ok) return NextResponse.json({ error: 'Failed to look up profile' }, { status: 400 });
    const profile = await profileRes.json();
    const providerId = profile.provider_id || profile.id;

    // Send message
    const msgRes = await fetch(`${baseUrl}/chats`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        account_id: user.unipile_account_id,
        attendees_ids: [providerId],
        text: message.trim(),
      }),
    });

    if (!msgRes.ok) {
      const errText = await msgRes.text();
      return NextResponse.json({ error: `Failed to send: ${errText.slice(0, 200)}` }, { status: 400 });
    }

    // Log the message under the contact owner's account
    const ownerId = contact.user_id || viewUserId;
    messages.create(ownerId, { contact_id: contactId, content: message.trim() });

    // Cancel any pending sequence items for this contact (manual message overrides sequence)
    const db = getDb();
    const cancelled = db.prepare(
      "UPDATE queue SET status = 'completed', error = 'Cancelled: manual message sent' WHERE contact_id = ? AND user_id = ? AND status = 'pending'"
    ).run(contactId, ownerId);

    // Update contact status to msg_sent if not already further along
    if (['new', 'queued', 'invite_sent', 'invite_pending', 'connected'].includes(contact.status)) {
      contacts.updateStatus(contactId, 'msg_sent', ownerId);
    }

    // Log activity
    activityLog.log(ownerId, 'manual_message', 'contact', contactId, `Sent manual message to ${contact.name}`);

    return NextResponse.json({
      success: true,
      sequenceCancelled: cancelled.changes,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
