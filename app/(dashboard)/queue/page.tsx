'use client';

import { useEffect, useState } from 'react';
import { Clock, CheckCircle2, AlertCircle, Pause, ListTodo, Trash2, RefreshCw, X } from 'lucide-react';
import { useUser } from '@/components/user-context';

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

export default function QueuePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { apiQuery, viewAs } = useUser();

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
    { label: 'Total', value: counts.total, color: 'text-white' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Queue</h1>
          <p className="text-sm text-muted-foreground mt-1">Queue processes automatically during your send window</p>
        </div>
        {counts.failed > 0 && (
          <button
            onClick={clearAllFailed}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-red-500/20 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all"
          >
            <Trash2 size={14} />
            Clear {counts.failed} Failed
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
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
          <span className="text-sm font-medium text-white">Queue Items</span>
        </div>
        <div className="p-3">
          {loading ? (
            <div className="space-y-2 p-2">
              {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-secondary rounded-lg animate-pulse" />)}
            </div>
          ) : queue.length === 0 ? (
            <div className="py-12 text-center">
              <ListTodo className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-muted-foreground">Queue is empty</p>
            </div>
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
                        <p className="text-sm font-medium text-white">{item.contact_name}</p>
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
