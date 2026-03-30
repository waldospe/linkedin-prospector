'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { TrendingUp, Send, MessageCircle, Reply, BarChart3, Users } from 'lucide-react';
import { POSITIVE_STAGES, NEGATIVE_STAGES, STAGE_MAP, stageColors } from '@/lib/constants';
import { useUser } from '@/components/user-context';

interface Stats {
  daily: Array<{
    date: string;
    connections_sent: number;
    messages_sent: number;
    replies_received: number;
  }>;
  today: {
    connections_sent: number;
    messages_sent: number;
    replies_received: number;
  };
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats>({ daily: [], today: { connections_sent: 0, messages_sent: 0, replies_received: 0 } });
  const [funnel, setFunnel] = useState<Array<{ status: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const { apiQuery, viewAs, isViewingAll } = useUser();

  useEffect(() => {
    const sep = apiQuery.includes('?') ? '&' : '?';
    Promise.all([
      fetch(`/api/stats${apiQuery}${sep}days=30`).then(r => r.json()),
      fetch(`/api/contacts/funnel${apiQuery}`).then(r => r.json()),
    ]).then(([statsData, funnelData]) => {
      setStats(statsData);
      setFunnel(Array.isArray(funnelData) ? funnelData : []);
    }).finally(() => setLoading(false));
  }, [viewAs]);

  const chartData = stats.daily.slice(0, 14).reverse().map(day => ({
    date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    connections: day.connections_sent,
    messages: day.messages_sent,
    replies: day.replies_received,
  }));

  const totalConnections = stats.daily.reduce((sum, d) => sum + d.connections_sent, 0) + stats.today.connections_sent;
  const totalMessages = stats.daily.reduce((sum, d) => sum + d.messages_sent, 0) + stats.today.messages_sent;
  const totalReplies = stats.daily.reduce((sum, d) => sum + d.replies_received, 0) + stats.today.replies_received;
  const replyRate = totalMessages > 0 ? (totalReplies / totalMessages) * 100 : 0;

  const funnelMap = Object.fromEntries(funnel.map(f => [f.status, f.count]));
  const totalContacts = funnel.reduce((sum, f) => sum + f.count, 0);
  const maxPositive = Math.max(...POSITIVE_STAGES.map(s => funnelMap[s] || 0), 1);

  const tooltipStyle = {
    contentStyle: { backgroundColor: 'hsl(228 14% 10%)', border: '1px solid hsl(228 11% 18%)', borderRadius: '8px', fontSize: '12px' },
    labelStyle: { color: 'hsl(220 10% 50%)', marginBottom: '4px' },
  };

  const statCards = [
    { label: 'Connections', value: totalConnections, icon: Send, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/15' },
    { label: 'Messages', value: totalMessages, icon: MessageCircle, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/15' },
    { label: 'Replies', value: totalReplies, icon: Reply, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/15' },
    { label: 'Reply Rate', value: `${replyRate.toFixed(1)}%`, icon: TrendingUp, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/15' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Performance metrics and campaign insights</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${bg} ${color}`}>
                <Icon size={15} />
              </div>
            </div>
            <p className="text-3xl font-semibold text-white tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Outreach Funnel — full width */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-white">Outreach Funnel</span>
          </div>
          <span className="text-xs text-muted-foreground">{totalContacts} total contacts</span>
        </div>

        {totalContacts === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Import contacts to see your funnel</div>
        ) : (
          <div className="grid grid-cols-2 gap-8">
            {/* Positive funnel */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Pipeline</p>
              <div className="space-y-3">
                {POSITIVE_STAGES.map((stageKey, i) => {
                  const stage = STAGE_MAP[stageKey];
                  const count = funnelMap[stageKey] || 0;
                  const pct = totalContacts > 0 ? (count / totalContacts) * 100 : 0;
                  const barWidth = (count / maxPositive) * 100;
                  const colors = stageColors[stageKey];
                  return (
                    <div key={stageKey} className="animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                          <span className={`text-xs font-medium ${colors.text}`}>{stage.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-white tabular-nums">{count}</span>
                          <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-right">{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="h-3 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${colors.bar}`} style={{ width: `${barWidth}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Negative outcomes */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Outcomes</p>
              <div className="space-y-3">
                {NEGATIVE_STAGES.map((stageKey) => {
                  const stage = STAGE_MAP[stageKey];
                  const count = funnelMap[stageKey] || 0;
                  const pct = totalContacts > 0 ? (count / totalContacts) * 100 : 0;
                  const colors = stageColors[stageKey];
                  return (
                    <div key={stageKey} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                        <span className={`text-xs font-medium ${colors.text}`}>{stage.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-white tabular-nums">{count}</span>
                        <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Conversion rates */}
              <div className="mt-6">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Conversion Rates</p>
                <div className="space-y-2">
                  {[
                    { label: 'Invite → Connected', from: 'invite_sent', to: 'connected' },
                    { label: 'Connected → Replied', from: 'connected', to: 'replied' },
                    { label: 'Overall Response', from: 'new', to: 'replied' },
                  ].map(({ label, from, to }) => {
                    const fromCount = (funnelMap[from] || 0) + (funnelMap[to] || 0);
                    const toCount = funnelMap[to] || 0;
                    const rate = fromCount > 0 ? (toCount / fromCount) * 100 : 0;
                    return (
                      <div key={label} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <span className="text-sm font-semibold text-white tabular-nums">{rate.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-white">Daily Activity</span>
          </div>
          <div className="h-56">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 11% 18%)" />
                  <XAxis dataKey="date" stroke="hsl(220 10% 40%)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(220 10% 40%)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="connections" fill="hsl(217 91% 60%)" radius={[3, 3, 0, 0]} name="Connections" />
                  <Bar dataKey="messages" fill="hsl(239 84% 67%)" radius={[3, 3, 0, 0]} name="Messages" />
                  <Bar dataKey="replies" fill="hsl(160 84% 39%)" radius={[3, 3, 0, 0]} name="Replies" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No data available</div>
            )}
          </div>
        </div>

        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-white">Response Trend</span>
          </div>
          <div className="h-56">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 11% 18%)" />
                  <XAxis dataKey="date" stroke="hsl(220 10% 40%)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(220 10% 40%)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip {...tooltipStyle} />
                  <Line type="monotone" dataKey="messages" stroke="hsl(239 84% 67%)" strokeWidth={2} dot={false} name="Messages" />
                  <Line type="monotone" dataKey="replies" stroke="hsl(160 84% 39%)" strokeWidth={2} dot={false} name="Replies" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No data available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
