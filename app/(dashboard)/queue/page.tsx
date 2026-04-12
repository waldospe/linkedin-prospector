'use client';

import { useEffect, useState } from 'react';
import { Clock, CheckCircle2, AlertCircle, Pause, ListTodo, Trash2, RefreshCw, X, Zap, Moon } from 'lucide-react';
import { useUser } from '@/components/user-context';
import { EmptyState } from '@/components/empty-state';

interface QueueItem {
  id: number;
  contact_name: string;
  linkedin_url: string;
  sequence_name: string;
  step_number: number;
  action_type: string;
  status: string;
  scheduled_at: string;
  executed_at: string;
  error: string;
}

const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  pending: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/15', label: 'Pending' },
  completed: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15', label: 'Completed' },
  failed: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10 text-red-400 border-red-500/15', label: 'Failed' },
  paused: { icon: Pause, color: 'text-orange-400', bg: 'bg-orange-500/10 text-orange-400 border-orange-500/15', label: 'Paused' },
};

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface SendDay { enabled: boolean; start: string; end: string; }

function computeSendStatus(schedule: Record<string, SendDay> | undefined, timezone: string | undefined): {
  active: boolean;
  label: string;
  detail: string;
} {
  if (!schedule || !timezone) return { active: false, label: 'Schedule not set', detail: 'Configure your send window in Settings.' };
  try {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit' });
    const parts = fmt.formatToParts(now);
    const weekday = parts.find(p => p.type === 'weekday')?.value.toLowerCase().slice(0,3) || 'mon';
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    const dayKey = weekday as string;
    const today = schedule[dayKey];
    const nowMin = hour * 60 + minute;

    if (today?.enabled) {
      const [sh, sm] = today.start.split(':').map(Number);
      const [eh, em] = today.end.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      if (nowMin >= startMin && nowMin < endMin) {
        const remaining = endMin - nowMin;
        const hrs = Math.floor(remaining / 60);
        const mins = remaining % 60;
        return { active: true, label: 'Sending now', detail: `Window closes in ${hrs > 0 ? `${hrs}h ` : ''}${mins}m (${today.end} ${timezone.split('/').pop()})` };
      }
      if (nowMin < startMin) {
        return { active: false, label: 'Paused until window opens', detail: `Resumes today at ${today.start} (${timezone.split('/').pop()})` };
      }
    }
    // Find next enabled day
    const todayIdx = DAY_KEYS.indexOf(dayKey);
    for (let i = 1; i <= 7; i++) {
      const nextKey = DAY_KEYS[(todayIdx + i) % 7];
      const next = schedule[nextKey];
      if (next?.enabled) {
        const dayLabels: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
        return { active: false, label: 'Outside send window', detail: `Next batch ${i === 1 ? 'tomorrow' : dayLabels[nextKey]} at ${next.start} (${timezone.split('/').pop()})` };
      }
    }
    return { active: false, label: 'No sending days enabled', detail: 'Enable at least one day in Settings → Sending.' };
  } catch {
    return { active: false, label: 'Schedule unavailable', detail: '' };
  }
}

export default function QueuePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { apiQuery, viewAs, currentUser } = useUser();

  const sendStatus = computeSendStatus(currentUser?.send_schedule, (currentUser as any)?.timezone);

  useEffect(() => { fetchQueue(); }, [viewAs]);

  const fetchQueue = async () => {
    try {
      const res = await fetch(`/api/queue${apiQuery}`);
      setQueue(await res.json());
    } finally { setLoading(false); }
  };

  const removeItem = async (id: number) => {
    await fetch(`/api/queue/${id}`, { method: 'DELETE' });
    fetchQueue();
  };

  const retryItem = async (id: number) => {
    await fetch(`/api/queue/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retry: true }),
    });
    fetchQueue();
  };

  const clearAllFailed = async () => {
    await fetch('/api/queue/clear-failed', { method: 'POST' });
    fetchQueue();
  };

  const counts = {
    pending: queue.filter(q => q.status === 'pending').length,
    completed: queue.filter(q => q.status === 'completed').length,
    failed: queue.filter(q => q.status === 'failed').length,
    total: queue.length,
  };

  const summaryCards = [
    { label: 'Pending', value: counts.pending, color: 'text-amber-400' },
    { label: 'Completed', value: counts.completed, color: 'text-emerald-400' },
    { label: 'Failed', value: counts.failed, color: 'text-red-400' },
    { label: 'Total', value: counts.total, color: 'text-foreground' },
  ];

  const lastCompleted = queue
    .filter(q => q.status === 'completed' && q.executed_at)
    .sort((a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime())[0];
  const lastSentRel = lastCompleted ? timeAgo(new Date(lastCompleted.executed_at)) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="h-page">Queue</h1>
          <p className="t-meta mt-1">Scheduled connection requests and follow-up messages</p>
        </div>
        {counts.failed > 0 && (
          <button
            onClick={clearAllFailed}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-red-500/20 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all"
          >
            <Trash2 size={14} />
            Clear {counts.failed} failed
          </button>
        )}
      </div>

      {/* Live status panel */}
      <div className={`glass rounded-xl p-5 border ${sendStatus.active ? 'border-emerald-500/25' : 'border-border'}`}>
        <div className="flex items-center gap-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${sendStatus.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-secondary/60 text-muted-foreground'}`}>
            {sendStatus.active ? <Zap size={18} /> : <Moon size={18} />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="h-card">{sendStatus.label}</p>
              {sendStatus.active && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
                </span>
              )}
            </div>
            <p className="t-caption mt-0.5">{sendStatus.detail}</p>
          </div>
          <div className="flex items-center gap-6 t-caption">
            <div className="text-right">
              <p className="text-muted-foreground/70">Pending</p>
              <p className="text-foreground font-semibold tabular-nums text-base">{counts.pending}</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground/70">Last send</p>
              <p className="text-foreground font-medium">{lastSentRel || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(({ label, value, color }) => (
          <div key={label} className="glass rounded-xl p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-semibold mt-1 tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Queue list */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border/50">
          <span className="text-sm font-medium text-foreground">Queue Items</span>
        </div>
        <div className="p-3">
          {loading ? (
            <div className="space-y-2 p-2">
              {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-secondary rounded-lg animate-pulse" />)}
            </div>
          ) : queue.length === 0 ? (
            <EmptyState
              icon={ListTodo}
              title="Queue is empty"
              description={sendStatus.active
                ? "Add contacts to a sequence to start scheduling outreach."
                : "Outside the send window — when contacts get added to a sequence they'll appear here."}
            />
          ) : (
            <div className="space-y-1.5">
              {queue.map((item) => {
                const cfg = statusConfig[item.status] || statusConfig.pending;
                const Icon = cfg.icon;
                return (
                  <div key={item.id} className="flex items-center justify-between p-3.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-all border border-transparent hover:border-border/30">
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.contact_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.sequence_name ? `${item.sequence_name} \u00B7 Step ${item.step_number}` : 'Manual action'}
                        </p>
                        {item.error && (
                          <p className="text-xs text-red-400 mt-0.5">{item.error}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-md border capitalize ${
                        item.action_type === 'connection'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/15'
                          : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/15'
                      }`}>
                        {item.action_type}
                      </span>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-md border ${cfg.bg}`}>
                        {cfg.label}
                      </span>
                      {item.status === 'failed' && (
                        <>
                          <button
                            onClick={() => retryItem(item.id)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                            title="Retry"
                          >
                            <RefreshCw size={13} />
                          </button>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Remove"
                          >
                            <X size={13} />
                          </button>
                        </>
                      )}
                      {item.status === 'pending' && (
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Remove"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
