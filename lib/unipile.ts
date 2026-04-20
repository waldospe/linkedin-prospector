import { QUEUE_CONSTANTS } from './types';

const { FETCH_TIMEOUT_MS } = QUEUE_CONSTANTS;

function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, { ...options, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

export interface UnipileConfig {
  apiKey: string;
  dsn: string;
  accountId: string;
}

function buildUrl(dsn: string, path: string): string {
  return `https://${dsn}/api/v1${path}`;
}

function headers(apiKey: string): Record<string, string> {
  return {
    'X-API-KEY': apiKey,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

export async function getProfile(cfg: UnipileConfig, linkedinSlug: string) {
  const res = await fetchWithTimeout(
    buildUrl(cfg.dsn, `/users/${linkedinSlug}?account_id=${cfg.accountId}`),
    { headers: { 'X-API-KEY': cfg.apiKey, 'Accept': 'application/json' } }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown error');
    throw new Error(`Profile lookup failed (${res.status}): ${errText.slice(0, 200)}`);
  }
  return res.json();
}

export async function sendInvite(cfg: UnipileConfig, providerId: string, message?: string) {
  const body: Record<string, any> = {
    account_id: cfg.accountId,
    provider_id: providerId,
  };
  if (message) body.message = message;

  const res = await fetchWithTimeout(
    buildUrl(cfg.dsn, '/users/invite'),
    { method: 'POST', headers: headers(cfg.apiKey), body: JSON.stringify(body) }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown error');
    throw new Error(`Invite failed (${res.status}): ${errText.slice(0, 200)}`);
  }
  return res.json();
}

export async function sendMessage(cfg: UnipileConfig, providerId: string, text: string) {
  const res = await fetchWithTimeout(
    buildUrl(cfg.dsn, '/chats'),
    {
      method: 'POST',
      headers: headers(cfg.apiKey),
      body: JSON.stringify({
        account_id: cfg.accountId,
        attendees_ids: [providerId],
        text,
      }),
    }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown error');
    throw new Error(`Message failed (${res.status}): ${errText.slice(0, 200)}`);
  }
  return res.json();
}

export async function getChats(cfg: UnipileConfig, attendeeProviderId: string, limit = 1) {
  const res = await fetchWithTimeout(
    buildUrl(cfg.dsn, `/chats?account_id=${cfg.accountId}&attendee_id=${attendeeProviderId}&limit=${limit}`),
    { headers: { 'X-API-KEY': cfg.apiKey, 'Accept': 'application/json' } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.items || data || [];
}

export async function getChatMessages(cfg: UnipileConfig, chatId: string, limit = 50) {
  const res = await fetchWithTimeout(
    buildUrl(cfg.dsn, `/chats/${chatId}/messages?limit=${limit}`),
    { headers: { 'X-API-KEY': cfg.apiKey, 'Accept': 'application/json' } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.items || data || [];
}

export function isConnected(profile: any): boolean {
  return profile.is_relationship === true || profile.network_distance === 'FIRST_DEGREE';
}

export function extractLinkedInSlug(url: string): string | null {
  const match = url.match(/linkedin\.com\/in\/([a-zA-Z0-9\-_.]+)/);
  return match ? match[1] : null;
}
