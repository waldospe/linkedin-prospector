import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/api-auth';
import { contacts, users, globalConfig, messages, queue, contactLabels, contactEvents, contactNotes } from '@/lib/db';
import { getDb } from '@/lib/db';

// ─── In-memory Unipile cache (5-minute TTL) ─────────────────────
interface CacheEntry {
  profile: any;
  conversation: any[];
  timestamp: number;
}
const unipileCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key: string): CacheEntry | null {
  const entry = unipileCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    unipileCache.delete(key);
    return null;
  }
  return entry;
}

function setCache(key: string, profile: any, conversation: any[]) {
  // Evict old entries if cache gets too large
  if (unipileCache.size > 500) {
    const now = Date.now();
    unipileCache.forEach((v, k) => {
      if (now - v.timestamp > CACHE_TTL) unipileCache.delete(k);
    });
  }
  unipileCache.set(key, { profile, conversation, timestamp: Date.now() });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { effectiveUserId, userId: authUserId } = getEffectiveUser(req);
    const viewUserId = effectiveUserId || authUserId;
    const contactId = Number(params.id);
    const contact = contacts.getById(contactId, viewUserId) as any;
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    // Check if this is a "skip_unipile" refresh (after sending a message)
    const skipUnipile = req.nextUrl.searchParams.get('skip_unipile') === '1';

    // Use the contact owner's Unipile account for API calls
    const contactOwner = users.getById(contact.user_id || viewUserId) as any;
    const user = contactOwner;
    const cfg = globalConfig.get();

    // Get our stored messages (manual + sequence-sent)
    const db = getDb();
    const ownerId = contact.user_id || viewUserId;
    const manualMessages = db.prepare(`
      SELECT id, content, sent_at, replied_at, 'manual' as source FROM messages
      WHERE contact_id = ? AND user_id = ?
      ORDER BY sent_at ASC
    `).all(contactId, ownerId) as any[];
    const sequenceMessages = db.prepare(`
      SELECT id, message_text as content, executed_at as sent_at, 'sequence' as source FROM queue
      WHERE contact_id = ? AND user_id = ? AND action_type = 'message' AND status = 'completed' AND message_text IS NOT NULL AND message_text != ''
      ORDER BY executed_at ASC
    `).all(contactId, ownerId) as any[];
    // Merge and deduplicate by content+timestamp proximity
    const allSent = [...manualMessages, ...sequenceMessages].sort((a, b) =>
      new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
    );
    const storedMessages = allSent.filter((msg, i) => {
      if (msg.source === 'sequence') {
        return !allSent.some(m => m.source === 'manual' && m.content === msg.content &&
          Math.abs(new Date(m.sent_at).getTime() - new Date(msg.sent_at).getTime()) < 60000);
      }
      return true;
    });

    // Get queue history
    const queueHistory = db.prepare(`
      SELECT id, action_type, status, message_text, template_variant, executed_at, error
      FROM queue WHERE contact_id = ? AND user_id = ?
      ORDER BY id ASC
    `).all(contactId, ownerId);

    // Get labels, events, notes from DB (fast — no external API)
    const labels = contactLabels.getByContact(contactId);
    const events = contactEvents.getForContact(contactId);
    const notes = contactNotes.getForContact(contactId);

    // Try to fetch LinkedIn profile and conversation from Unipile
    let linkedinProfile: any = null;
    let linkedinConversation: any[] = [];

    const cacheKey = contact.linkedin_url ? `${user?.unipile_account_id}:${contact.linkedin_url}` : '';

    // If skip_unipile, use cached data
    if (skipUnipile && cacheKey) {
      const cached = getCached(cacheKey);
      if (cached) {
        linkedinProfile = cached.profile;
        linkedinConversation = cached.conversation;
      }
    } else if (cfg?.unipile_api_key && user?.unipile_account_id && contact.linkedin_url) {
      // Check cache first
      const cached = getCached(cacheKey);
      if (cached) {
        linkedinProfile = cached.profile;
        linkedinConversation = cached.conversation;
      } else {
        const slugMatch = contact.linkedin_url.match(/linkedin\.com\/in\/([a-zA-Z0-9\-_.]+)/);
        if (slugMatch) {
          const dsn = cfg.unipile_dsn || 'api21.unipile.com:15135';
          const baseUrl = `https://${dsn}/api/v1`;
          const headers = { 'X-API-KEY': cfg.unipile_api_key, 'Accept': 'application/json' };

          try {
            const profileRes = await fetch(
              `${baseUrl}/users/${slugMatch[1]}?account_id=${user.unipile_account_id}&linkedin_sections=*`,
              { headers, signal: AbortSignal.timeout(10000) }
            );
            if (profileRes.ok) {
              const p = await profileRes.json();
              const localConnected = ['connected', 'msg_sent', 'replied', 'positive', 'meeting_booked'].includes(contact.status);
              linkedinProfile = {
                first_name: p.first_name,
                last_name: p.last_name,
                headline: p.headline,
                location: p.location,
                profile_picture_url: p.profile_picture_url || p.profile_picture_url_large,
                is_relationship: p.is_relationship || localConnected,
                network_distance: p.network_distance,
                connections_count: p.connections_count,
                follower_count: p.follower_count,
                is_premium: p.is_premium,
                provider_id: p.provider_id,
              };

              const isConnected = p.is_relationship || p.network_distance === 'FIRST_DEGREE'
                || ['connected', 'msg_sent', 'replied', 'positive', 'meeting_booked'].includes(contact.status);
              if (isConnected) {
                try {
                  const providerId = p.provider_id || p.id;
                  const chatsRes = await fetch(
                    `${baseUrl}/chats?account_id=${user.unipile_account_id}&attendee_id=${providerId}&limit=1`,
                    { headers, signal: AbortSignal.timeout(10000) }
                  );
                  if (chatsRes.ok) {
                    const chatsData = await chatsRes.json();
                    let chatItems = chatsData.items || chatsData || [];
                    let chatId = Array.isArray(chatItems) && chatItems.length > 0 ? chatItems[0].id : null;

                    // Fallback: scan only 10 recent chats (down from 50) to find the right one
                    if (!chatId) {
                      try {
                        const allChatsRes = await fetch(
                          `${baseUrl}/chats?account_id=${user.unipile_account_id}&limit=10`,
                          { headers, signal: AbortSignal.timeout(10000) }
                        );
                        if (allChatsRes.ok) {
                          const allChats = await allChatsRes.json();
                          const allChatItems = allChats.items || allChats || [];
                          for (const chat of allChatItems) {
                            const msgsCheck = await fetch(
                              `${baseUrl}/chats/${chat.id}/messages?limit=3`,
                              { headers, signal: AbortSignal.timeout(8000) }
                            );
                            if (msgsCheck.ok) {
                              const msgsCheckData = await msgsCheck.json();
                              const msgs = msgsCheckData.items || msgsCheckData || [];
                              if (msgs.some((m: any) => (m.sender_id || m.sender?.id) === providerId)) {
                                chatId = chat.id;
                                break;
                              }
                            }
                          }
                        }
                      } catch { /* fallback scan failed */ }
                    }

                    if (chatId) {
                      const msgsRes = await fetch(
                        `${baseUrl}/chats/${chatId}/messages?limit=50`,
                        { headers, signal: AbortSignal.timeout(10000) }
                      );
                      if (msgsRes.ok) {
                        const msgsData = await msgsRes.json();
                        linkedinConversation = (msgsData.items || msgsData || []).map((m: any) => ({
                          id: m.id,
                          text: m.text || m.body || '',
                          sender_id: m.sender_id || m.sender?.id,
                          is_me: m.sender_id !== providerId,
                          timestamp: m.timestamp || m.created_at || m.date,
                        })).reverse();
                      }
                    }
                  }
                } catch { /* conversation fetch failed */ }
              }

              // Cache the result
              setCache(cacheKey, linkedinProfile, linkedinConversation);
            }
          } catch { /* profile fetch failed */ }
        }
      }
    }

    return NextResponse.json({
      contact,
      linkedinProfile,
      linkedinConversation,
      storedMessages,
      queueHistory,
      labels,
      events,
      notes,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
