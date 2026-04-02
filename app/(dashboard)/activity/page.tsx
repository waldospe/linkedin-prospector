'use client';

import { useEffect, useState } from 'react';
import { ScrollText, User, Clock, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUser } from '@/components/user-context';

interface ActivityEntry {
  id: number;
  user_id: number;
  user_name: string;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  details: string | null;
  created_at: string;
}

const ACTION_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  manual_message: { label: 'Manual Message', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/15' },
  connection_sent: { label: 'Connection Sent', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/15' },
  message_sent: { label: 'Message Sent', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/15' },
  contact_created: { label: 'Contact Created', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/15' },
  contact_updated: { label: 'Contact Updated', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/15' },
  contact_deleted: { label: 'Contact Deleted', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/15' },
  contact_opted_out: { label: 'Opted Out', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/15' },
  sequence_created: { label: 'Sequence Created', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/15' },
  import_csv: { label: 'CSV Import', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/15' },
  login: { label: 'Login', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/15' },
  bulk_delete: { label: 'Bulk Delete', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/15' },
  contact_paused: { label: 'Paused', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/15' },
  contact_resumed: { label: 'Resumed', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/15' },
  sequence_updated: { label: 'Sequence Updated', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/15' },
  sequence_deleted: { label: 'Sequence Deleted', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/15' },
  template_created: { label: 'Template Created', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/15' },
  template_updated: { label: 'Template Updated', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/15' },
  template_deleted: { label: 'Template Deleted', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/15' },
  settings_updated: { label: 'Settings Changed', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/15' },
  password_changed: { label: 'Password Changed', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/15' },
};

const PAGE_SIZE = 50;

export default function ActivityPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>('');
  const [page, setPage] = useState(0);
  const { apiQuery, isAdmin } = useUser();

  useEffect(() => {
    setLoading(true);
    const sep = apiQuery.includes('?') ? '&' : '?';
    fetch(`/api/activity${apiQuery}${sep}limit=500`)
      .then(r => r.json())
      .then(data => setEntries(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [apiQuery]);

  const filtered = filterAction
    ? entries.filter(e => e.action === filterAction)
    : entries;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const uniqueActions = Array.from(new Set(entries.map(e => e.action))).sort();

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  const getStyle = (action: string) =>
    ACTION_STYLES[action] || { label: action.replace(/_/g, ' '), color: 'text-muted-foreground', bg: 'bg-secondary/50 border-border' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Activity Log</h1>
          <p className="text-sm text-muted-foreground mt-1">Track actions across your team</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted-foreground" />
            <select
              value={filterAction}
              onChange={e => { setFilterAction(e.target.value); setPage(0); }}
              className="h-8 bg-secondary text-foreground text-xs font-medium rounded-lg px-2.5 border border-border focus:outline-none focus:border-blue-500/40 cursor-pointer"
            >
              <option value="">All actions</option>
              {uniqueActions.map(a => (
                <option key={a} value={a}>{getStyle(a).label}</option>
              ))}
            </select>
          </div>
          <span className="text-xs text-muted-foreground">{filtered.length} events</span>
        </div>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm animate-pulse">Loading activity...</div>
        ) : paginated.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No activity recorded yet</div>
        ) : (
          <div className="divide-y divide-border">
            {paginated.map((entry) => {
              const style = getStyle(entry.action);
              return (
                <div key={entry.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                  {/* User avatar */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/25 to-violet-500/25 border border-blue-500/20 flex items-center justify-center text-[11px] font-bold text-blue-300 shrink-0">
                    {entry.user_name?.charAt(0) || '?'}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{entry.user_name}</span>
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${style.bg} ${style.color}`}>
                        {style.label}
                      </span>
                    </div>
                    {entry.details && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xl">{entry.details}</p>
                    )}
                    {entry.entity_type && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {entry.entity_type}{entry.entity_id ? ` #${entry.entity_id}` : ''}
                      </p>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                    <Clock size={12} />
                    <span className="tabular-nums">{formatTime(entry.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
