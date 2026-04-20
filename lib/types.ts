// ─── Core domain types ───────────────────────────────────────────
// Single source of truth for data shapes across the app.

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  team_id: number | null;
  unipile_account_id: string | null;
  pipedrive_api_key: string | null;
  daily_limit: number;
  message_delay_min: number;
  message_delay_max: number;
  send_schedule: Record<string, SendDay> | string;
  timezone: string;
  last_login: string | null;
  email_daily_digest: number;
  email_reply_alerts: number;
  digest_send_hour: number;
  last_digest_sent: string | null;
  onboarding_schedule_confirmed: number;
  onboarding_dismissed: number;
  warmup_enabled: number;
  warmup_start_date: string | null;
  warmup_current_limit: number | null;
  created_at: string;
  password_hash?: string;
}

export interface SendDay {
  enabled: boolean;
  start: string;
  end: string;
}

export interface Contact {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  name: string;
  linkedin_url: string | null;
  company: string | null;
  title: string | null;
  source: string;
  status: string;
  avatar_url: string | null;
  inbox_status: string;
  created_at: string;
}

export interface QueueItem {
  id: number;
  user_id: number;
  contact_id: number;
  sequence_id: number | null;
  step_number: number;
  action_type: 'connection' | 'message';
  status: 'pending' | 'completed' | 'failed' | 'paused' | 'failed_retryable';
  message_text: string | null;
  template_variant: string | null;
  scheduled_at: string | null;
  executed_at: string | null;
  error: string | null;
  retry_count?: number;
  // Joined fields from getPending
  contact_name?: string;
  linkedin_url?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
  sequence_name?: string;
  sequence_steps?: string;
}

export interface Sequence {
  id: number;
  user_id: number;
  name: string;
  steps: string | SequenceStep[];
  active: number;
  visibility: string;
  shared_with_user_ids: string;
  owner_name?: string;
}

export interface SequenceStep {
  action: 'connection' | 'message';
  template: string;
  delay_hours: number;
  variants?: Array<{ label: string; template: string }>;
}

export interface GlobalConfig {
  id: number;
  unipile_api_key: string | null;
  unipile_dsn: string;
}

export interface DailyStats {
  date: string;
  user_id: number;
  connections_sent: number;
  messages_sent: number;
  replies_received: number;
}

export interface Campaign {
  id: number;
  user_id: number;
  team_id: number;
  name: string;
  description: string | null;
  sequence_id: number | null;
  status: string;
  sequence_name?: string;
  contact_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ContactEvent {
  id: number;
  user_id: number;
  contact_id: number;
  event_type: string;
  details: string | null;
  message_preview: string | null;
  sequence_name: string | null;
  created_at: string;
  user_name?: string;
}

export interface ContactNote {
  id: number;
  user_id: number;
  contact_id: number;
  content: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
}

export interface Subscription {
  id: number;
  team_id: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: number;
  created_at: string;
  updated_at: string;
}

export interface AccountHealthScore {
  score: number;
  level: 'excellent' | 'good' | 'caution' | 'danger';
  acceptRate: number;
  errorRate: number;
  negativeRate: number;
  warnings: string[];
  invitesSent: number;
  connected: number;
  messagesSent: number;
  declined: number;
  optedOut: number;
  invitesFailed: number;
  messagesFailed: number;
}

export interface WarmupStatus {
  enabled: boolean;
  startDate?: string;
  daysSinceStart?: number;
  currentLimit?: number;
  maxLimit?: number;
  complete?: boolean;
}

// ─── Auto-process constants ──────────────────────────────────────

export const QUEUE_CONSTANTS = {
  /** Max connection requests to send per auto-process cycle */
  MAX_CONNECTIONS_PER_CYCLE: 1,
  /** Max messages to send per auto-process cycle */
  MAX_MESSAGES_PER_CYCLE: 2,
  /** Buffer of connection items to pull (accounts for skips) */
  CONNECTION_BUFFER_SIZE: 6,
  /** Max contacts to monitor for invite acceptance per cycle */
  MONITOR_INVITE_BATCH: 15,
  /** Max contacts to monitor for reply detection per cycle */
  MONITOR_REPLY_BATCH: 15,
  /** Days before an unanswered invite is marked no_response */
  INVITE_TIMEOUT_DAYS: 14,
  /** Minimum gap between connection requests (fraction of calculated gap) */
  MIN_GAP_FRACTION: 0.7,
  /** Absolute minimum gap in minutes between connections */
  MIN_GAP_MINUTES: 5,
  /** Inter-action delay range in milliseconds [min, max] */
  INTER_ACTION_DELAY: [2000, 5000] as const,
  /** Delay between monitoring API calls in ms */
  MONITOR_API_DELAY: 500,
  /** Fetch timeout for Unipile API calls in ms */
  FETCH_TIMEOUT_MS: 15000,
  /** Max errors before sending an alert email */
  ERROR_ALERT_THRESHOLD: 5,
  /** Minimum interval between alert emails in ms (1 hour) */
  ALERT_COOLDOWN_MS: 3600000,
} as const;
