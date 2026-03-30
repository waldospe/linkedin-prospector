// Contact funnel stages (ordered)
export const FUNNEL_STAGES = [
  { key: 'new', label: 'New', description: 'Just imported, no action taken', color: 'zinc' },
  { key: 'queued', label: 'Queued', description: 'Added to sequence, awaiting processing', color: 'slate' },
  { key: 'invite_sent', label: 'Invite Sent', description: 'Connection request sent', color: 'blue' },
  { key: 'invite_pending', label: 'Invite Pending', description: 'Waiting for acceptance', color: 'amber' },
  { key: 'connected', label: 'Connected', description: 'Connection accepted', color: 'cyan' },
  { key: 'msg_sent', label: 'Message Sent', description: 'First message delivered', color: 'indigo' },
  { key: 'replied', label: 'Replied', description: 'They responded', color: 'emerald' },
  { key: 'engaged', label: 'Engaged', description: 'Active conversation / opportunity', color: 'green' },
  // Negative outcomes
  { key: 'invite_declined', label: 'Declined', description: 'Connection request rejected', color: 'red' },
  { key: 'no_response', label: 'No Response', description: 'No reply after follow-ups', color: 'orange' },
  { key: 'opted_out', label: 'Opted Out', description: 'Asked not to be contacted', color: 'rose' },
] as const;

export type FunnelStage = typeof FUNNEL_STAGES[number]['key'];

// Positive funnel stages in order (for funnel visualization)
export const POSITIVE_STAGES: FunnelStage[] = ['new', 'queued', 'invite_sent', 'invite_pending', 'connected', 'msg_sent', 'replied', 'engaged'];
export const NEGATIVE_STAGES: FunnelStage[] = ['invite_declined', 'no_response', 'opted_out'];

export const STAGE_MAP = Object.fromEntries(FUNNEL_STAGES.map(s => [s.key, s]));

// Color utilities for stages
export const stageColors: Record<string, { dot: string; bg: string; text: string; bar: string }> = {
  new: { dot: 'bg-zinc-400', bg: 'bg-zinc-500/10', text: 'text-zinc-400', bar: 'bg-zinc-500' },
  queued: { dot: 'bg-slate-400', bg: 'bg-slate-500/10', text: 'text-slate-400', bar: 'bg-slate-500' },
  invite_sent: { dot: 'bg-blue-400', bg: 'bg-blue-500/10', text: 'text-blue-400', bar: 'bg-blue-500' },
  invite_pending: { dot: 'bg-amber-400', bg: 'bg-amber-500/10', text: 'text-amber-400', bar: 'bg-amber-500' },
  connected: { dot: 'bg-cyan-400', bg: 'bg-cyan-500/10', text: 'text-cyan-400', bar: 'bg-cyan-500' },
  msg_sent: { dot: 'bg-indigo-400', bg: 'bg-indigo-500/10', text: 'text-indigo-400', bar: 'bg-indigo-500' },
  replied: { dot: 'bg-emerald-400', bg: 'bg-emerald-500/10', text: 'text-emerald-400', bar: 'bg-emerald-500' },
  engaged: { dot: 'bg-green-400', bg: 'bg-green-500/10', text: 'text-green-400', bar: 'bg-green-500' },
  invite_declined: { dot: 'bg-red-400', bg: 'bg-red-500/10', text: 'text-red-400', bar: 'bg-red-500' },
  no_response: { dot: 'bg-orange-400', bg: 'bg-orange-500/10', text: 'text-orange-400', bar: 'bg-orange-500' },
  opted_out: { dot: 'bg-rose-400', bg: 'bg-rose-500/10', text: 'text-rose-400', bar: 'bg-rose-500' },
};

// LinkedIn URL validation
export function isValidLinkedInUrl(url: string): boolean {
  if (!url) return true; // empty is ok
  const cleaned = url.trim().toLowerCase();
  return /^https?:\/\/(www\.)?linkedin\.com\/(in|pub|profile)\/[a-zA-Z0-9\-_.%/]+\/?$/.test(cleaned);
}

export function normalizeLinkedInUrl(url: string): string {
  if (!url) return '';
  let cleaned = url.trim();
  // Add https:// if missing protocol
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    // Handle linkedin.com/in/... or www.linkedin.com/in/...
    if (cleaned.includes('linkedin.com/')) {
      cleaned = 'https://' + cleaned;
    }
  }
  // Remove trailing slash
  cleaned = cleaned.replace(/\/+$/, '');
  // Remove query params
  cleaned = cleaned.split('?')[0];
  return cleaned;
}

// Template variable substitution
export function substituteVariables(template: string, contact: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    switch (varName) {
      case 'firstName': return contact.first_name || contact.name?.split(/\s+/)[0] || '';
      case 'lastName': return contact.last_name || '';
      case 'fullName': return contact.name || [contact.first_name, contact.last_name].filter(Boolean).join(' ') || '';
      case 'company': return contact.company || '';
      case 'title': return contact.title || '';
      default: return match; // leave unknown variables as-is
    }
  });
}
