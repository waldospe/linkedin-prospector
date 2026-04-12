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
  TrendingUp,
} from 'lucide-react';
import SinceYouWereGone from '@/components/since-you-were-gone';

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
  const { currentUser, viewAs, viewingUser, isViewingAll, apiQuery } = useUser();
  const [stats, setStats] = useState<Stats>({ today: { connections_sent: 0, messages_sent: 0, replies_received: 0 } });
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [funnel, setFunnel] = useState<Array<{ status: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) fetchData();
  }, [currentUser, viewAs]);

  const fetchData = async () => {
    try {
      const q = apiQuery;
      const [statsRes, queueRes, funnelRes] = await Promise.all([
        fetch(`/api/stats${q}`),
        fetch(`/api/queue${q}`),
        fetch(`/api/contacts/funnel${q}`),
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

  // Queue is now auto-processed by cron — no manual button needed

  const pendingCount = queue.filter(q => q.status === 'pending').length;
  const failedCount = queue.filter(q => q.status === 'failed').length;
  const dailyLimit = currentUser?.daily_limit || 20;
  const dailyUsed = stats.today.connections_sent;
  const dailyProgress = Math.min((dailyUsed / dailyLimit) * 100, 100);

  const totalContacts = funnel.reduce((sum, f) => sum + f.count, 0);
  const funnelMap = Object.fromEntries(funnel.map(f => [f.status, f.count]));

  const statCards = [
    { label: 'Connections', value: stats.today.connections_sent, icon: Send, color: 'blue' },
    { label: 'Messages', value: stats.today.messages_sent, icon: MessageCircle, color: 'indigo' },
    { label: 'Replies', value: stats.today.replies_received, icon: Reply, color: 'emerald' },
    { label: 'Total Contacts', value: totalContacts, icon: Users, color: 'violet' },
  ];

  const iconColors: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  };

  return (
    <div className="space-y-8">
      <SinceYouWereGone />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="h-page">
            {isViewingAll ? 'Team Overview' : `Welcome back${viewingUser ? `, ${viewingUser.name}` : ''}`}
          </h1>
          <p className="t-meta mt-1">
            {isViewingAll ? 'Aggregated outreach activity across your team' : "Here's your outreach activity for today"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/15">
              <Clock className="w-3.5 h-3.5" />
              {pendingCount} queued
            </span>
          )}
          {failedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/15">
              {failedCount} failed
            </span>
          )}
          {pendingCount === 0 && failedCount === 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
              <CheckCircle2 className="w-3.5 h-3.5" />
              All clear
            </span>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map(({ label, value, icon: Icon, color }, idx) => (
          <div key={label} className="glass rounded-2xl p-5 animate-slide-up" style={{ animationDelay: `${idx * 60}ms` }}>
            <div className="flex items-center justify-between mb-4">
              <span className="t-eyebrow">{label}</span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${iconColors[color]}`}>
                <Icon size={16} />
              </div>
            </div>
            <p className="text-3xl font-semibold text-foreground tabular-nums leading-none animate-count-up">{value}</p>
          </div>
        ))}
      </div>

      {/* Daily progress */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <TrendingUp size={16} className="text-blue-400" />
            <span className="text-sm font-semibold text-foreground">Daily Connection Limit</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-foreground tabular-nums">{dailyUsed}</span>
            <span className="text-sm text-muted-foreground">/ {dailyLimit}</span>
          </div>
        </div>
        <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${dailyProgress}%`,
              background: dailyProgress >= 100
                ? 'linear-gradient(90deg, hsl(0 72% 51%), hsl(15 80% 50%))'
                : 'linear-gradient(90deg, hsl(220 90% 56%), hsl(260 80% 55%))',
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-3 font-medium">
          {dailyProgress >= 100 ? '🎯 Connection limit reached — messages still sending' : `${Math.round(100 - dailyProgress)}% remaining`}
        </p>
      </div>

      {/* Funnel + Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel */}
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Outreach Funnel</span>
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
                const barWidth = count > 0 ? Math.max(pct, 2) : 0;
                const colors = stageColors[stageKey];
                return (
                  <div key={stageKey}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium ${colors.text}`}>{stage.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs tabular-nums text-foreground font-medium">{count}</span>
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
            <span className="text-sm font-medium text-foreground">Pending Queue</span>
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
                    <span className="text-sm text-foreground">{item.contact_name}</span>
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
