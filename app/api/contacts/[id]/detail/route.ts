import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/api-auth';
import { contacts, users, globalConfig, messages, queue } from '@/lib/db';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
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

    // Get our stored messages
    const db = getDb();
    const ownerId = contact.user_id || viewUserId;
    const storedMessages = db.prepare(`
      SELECT id, content, sent_at, replied_at FROM messages
      WHERE contact_id = ? AND user_id = ?
      ORDER BY sent_at ASC
    `).all(contactId, ownerId);

    // Get queue history
    const queueHistory = db.prepare(`
      SELECT id, action_type, status, message_text, template_variant, executed_at, error
      FROM queue WHERE contact_id = ? AND user_id = ?
      ORDER BY id ASC
    `).all(contactId, ownerId);

    // Try to fetch LinkedIn profile and conversation from Unipile
    let linkedinProfile: any = null;
    let linkedinConversation: any[] = [];

    if (cfg?.unipile_api_key && user?.unipile_account_id && contact.linkedin_url) {
      const slugMatch = contact.linkedin_url.match(/linkedin\.com\/in\/([a-zA-Z0-9\-_.]+)/);
      if (slugMatch) {
        const dsn = cfg.unipile_dsn || 'api21.unipile.com:15135';
        const baseUrl = `https://${dsn}/api/v1`;
        const headers = { 'X-API-KEY': cfg.unipile_api_key, 'Accept': 'application/json' };

        // Fetch profile
        try {
          const profileRes = await fetch(
            `${baseUrl}/users/${slugMatch[1]}?account_id=${user.unipile_account_id}&linkedin_sections=*`,
            { headers }
          );
          if (profileRes.ok) {
            const p = await profileRes.json();
            linkedinProfile = {
              first_name: p.first_name,
              last_name: p.last_name,
              headline: p.headline,
              location: p.location,
              profile_picture_url: p.profile_picture_url || p.profile_picture_url_large,
              is_relationship: p.is_relationship,
              network_distance: p.network_distance,
              connections_count: p.connections_count,
              follower_count: p.follower_count,
              is_premium: p.is_premium,
              provider_id: p.provider_id,
            };

            // Fetch conversation if connected
            if (p.is_relationship || p.network_distance === 'FIRST_DEGREE') {
              try {
                const providerId = p.provider_id || p.id;
                const chatsRes = await fetch(
                  `${baseUrl}/chats?account_id=${user.unipile_account_id}&attendee_id=${providerId}&limit=1`,
                  { headers }
                );
                if (chatsRes.ok) {
                  const chatsData = await chatsRes.json();
                  const chatItems = chatsData.items || chatsData || [];
                  if (Array.isArray(chatItems) && chatItems.length > 0) {
                    const chatId = chatItems[0].id;
                    // Fetch messages in this chat
                    const msgsRes = await fetch(
                      `${baseUrl}/chats/${chatId}/messages?limit=50`,
                      { headers }
                    );
                    if (msgsRes.ok) {
                      const msgsData = await msgsRes.json();
                      linkedinConversation = (msgsData.items || msgsData || []).map((m: any) => ({
                        id: m.id,
                        text: m.text || m.body || '',
                        sender_id: m.sender_id || m.sender?.id,
                        is_me: m.sender_id !== providerId,
                        timestamp: m.timestamp || m.created_at || m.date,
                      })).reverse(); // oldest first
                    }
                  }
                }
              } catch { /* conversation fetch failed, that's ok */ }
            }
          }
        } catch { /* profile fetch failed */ }
      }
    }

    return NextResponse.json({
      contact,
      linkedinProfile,
      linkedinConversation,
      storedMessages,
      queueHistory,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
