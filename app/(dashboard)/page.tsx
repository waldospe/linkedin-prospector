'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/components/user-context';
import { FUNNEL_STAGES, POSITIVE_STAGES, STAGE_MAP, stageColors } from '@/lib/constants';
import {
  Users,
  Send,
  MessageCircle,
  Reply,
  ListTodo,
  CheckCircle2,
  Clock,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';

interface Stats {
  today: {
    connections_sent: number;
    messages_sent: number;
    replies_received: number;
  };
}

interface QueueItem {
  id: number;
  contact_name: string;
  action_type: string;
  status: string;
}

export default function DashboardPage() {
  const { currentUser } = useUser();
  const [stats, setStats] = useState<Stats>({ today: { connections_sent: 0, messages_sent: 0, replies_received: 0 } });
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [funnel, setFunnel] = useState<Array<{ status: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (currentUser) fetchData();
  }, [currentUser]);

  const fetchData = async () => {
    try {
      const [statsRes, queueRes, funnelRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/queue'),
        fetch('/api/contacts/funnel'),
      ]);
      const [statsData, queueData, funnelData] = await Promise.all([
        statsRes.json(), queueRes.json(), funnelRes.json(),
      ]);
      setStats(statsData);
      setQueue(Array.isArray(queueData) ? queueData : []);
      setFunnel(Array.isArray(funnelData) ? funnelData : []);
    } finally {
      setLoading(false);
    }
  };

  const processQueue = async () => {
    setProcessing(true);
    try {
      const res = await fetch('/api/queue/process', { method: 'POST' });
      const data = await res.json();
      if (data.errors?.length) {
        console.warn('Queue processing errors:', data.errors);
      }
      fetchData();
    } finally {
      setProcessing(false);
    }
  };

  const pendingCount = queue.filter(q => q.status === 'pending').length;
  const dailyLimit = currentUser?.daily_limit || 20;
  const dailyUsed = stats.today.connections_sent + stats.today.messages_sent;
  const dailyProgress = Math.min((dailyUsed / dailyLimit) * 100, 100);

  const totalContacts = funnel.reduce((sum, f) => sum + f.count, 0);
  const funnelMap = Object.fromEntries(funnel.map(f => [f.status, f.count]));

  // Find max for funnel bar widths
  const maxFunnelCount = Math.max(...POSITIVE_STAGES.map(s => funnelMap[s] || 0), 1);

  const statCards = [
    { label: 'Connections', value: stats.today.connections_sent, icon: Send, color: 'blue' },
    { label: 'Messages', value: stats.today.messages_sent, icon: MessageCircle, color: 'indigo' },
    { label: 'Replies', value: stats.today.replies_received, icon: Reply, color: 'emerald' },
    { label: 'Total Contacts', value: totalContacts, icon: Users, color: 'violet' },
  ];

  const iconColors: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/15',
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/15',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/15',
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/15',
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Welcome back{currentUser ? `, ${currentUser.name}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Here&apos;s your outreach activity for today</p>
        </div>
        <button
          onClick={processQueue}
          disabled={processing || pendingCount === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all glow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${processing ? 'animate-spin' : ''}`} />
          {processing ? 'Processing...' : `Process Queue (${pendingCount})`}
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass rounded-xl p-5 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${iconColors[color]}`}>
                <Icon size={15} />
              </div>
            </div>
            <p className="text-3xl font-semibold text-white tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Daily progress */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-white">Daily Activity</span>
          </div>
          <span className="text-sm tabular-nums text-muted-foreground">{dailyUsed} / {dailyLimit}</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${dailyProgress}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">{dailyProgress >= 100 ? 'Daily limit reached' : `${Math.round(100 - dailyProgress)}% remaining`}</p>
      </div>

      {/* Funnel + Queue */}
      <div className="grid grid-cols-2 gap-6">
        {/* Funnel */}
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-white">Outreach Funnel</span>
          </div>
          {totalContacts === 0 ? (
            <div className="py-6 text-center">
              <Users className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Import contacts to see your funnel</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {POSITIVE_STAGES.map((stageKey) => {
                const stage = STAGE_MAP[stageKey];
                const count = funnelMap[stageKey] || 0;
                const pct = totalContacts > 0 ? (count / totalContacts) * 100 : 0;
                const barWidth = maxFunnelCount > 0 ? (count / maxFunnelCount) * 100 : 0;
                const colors = stageColors[stageKey];
                return (
                  <div key={stageKey}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium ${colors.text}`}>{stage.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs tabular-nums text-white font-medium">{count}</span>
                        <span className="text-[10px] tabular-nums text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${colors.bar}`} style={{ width: `${barWidth}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pending queue */}
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <ListTodo size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-white">Pending Queue</span>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-secondary rounded-lg animate-pulse" />)}
            </div>
          ) : pendingCount === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">All caught up</p>
            </div>
          ) : (
            <div className="space-y-2">
              {queue.filter(q => q.status === 'pending').slice(0, 6).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border/50">
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="text-sm text-white">{item.contact_name}</span>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-md border capitalize ${
                    item.action_type === 'connection'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/15'
                      : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/15'
                  }`}>
                    {item.action_type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
