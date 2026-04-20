'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { TrendingUp, Send, MessageCircle, Reply, BarChart3, Users, Clock } from 'lucide-react';
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
  const [smartSchedule, setSmartSchedule] = useState<any>(null);
  const [seqOverview, setSeqOverview] = useState<any[]>([]);
  const [seqDetail, setSeqDetail] = useState<any>(null);
  const [selectedSeqId, setSelectedSeqId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { apiQuery, viewAs, isViewingAll } = useUser();

  useEffect(() => {
    const sep = apiQuery.includes('?') ? '&' : '?';
    Promise.all([
      fetch(`/api/stats${apiQuery}${sep}days=30`).then(r => r.json()),
      fetch(`/api/contacts/funnel${apiQuery}`).then(r => r.json()),
      fetch('/api/smart-schedule').then(r => r.json()).catch(() => null),
      fetch(`/api/sequence-analytics${apiQuery}`).then(r => r.json()).catch(() => []),
    ]).then(([statsData, funnelData, scheduleData, seqData]) => {
      setStats(statsData);
      setFunnel(Array.isArray(funnelData) ? funnelData : []);
      setSmartSchedule(scheduleData);
      if (Array.isArray(seqData)) setSeqOverview(seqData);
    }).finally(() => setLoading(false));
  }, [viewAs]);

  useEffect(() => {
    if (!selectedSeqId) { setSeqDetail(null); return; }
    fetch(`/api/sequence-analytics/${selectedSeqId}${apiQuery}`).then(r => r.json()).then(setSeqDetail).catch(() => setSeqDetail(null));
  }, [selectedSeqId]);

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
  // no longer need maxPositive — use percent-of-total with min-width

  const tooltipStyle = {
    contentStyle: { backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px', color: 'hsl(var(--foreground))' },
    labelStyle: { color: 'hsl(var(--muted-foreground))', marginBottom: '4px' },
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
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Performance metrics and campaign insights</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${bg} ${color}`}>
                <Icon size={15} />
              </div>
            </div>
            <p className="text-3xl font-semibold text-foreground tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Outreach Funnel — full width */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Outreach Funnel</span>
          </div>
          <span className="text-xs text-muted-foreground">{totalContacts} total contacts</span>
        </div>

        {totalContacts === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Import contacts to see your funnel</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Positive funnel */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Pipeline</p>
              <div className="space-y-3">
                {POSITIVE_STAGES.map((stageKey, i) => {
                  const stage = STAGE_MAP[stageKey];
                  const count = funnelMap[stageKey] || 0;
                  const pct = totalContacts > 0 ? (count / totalContacts) * 100 : 0;
                  const barWidth = count > 0 ? Math.max(pct, 2) : 0;
                  const colors = stageColors[stageKey];
                  return (
                    <div key={stageKey} className="animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                          <span className={`text-xs font-medium ${colors.text}`}>{stage.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-foreground tabular-nums">{count}</span>
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
                        <span className="text-sm font-semibold text-foreground tabular-nums">{count}</span>
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
                        <span className="text-sm font-semibold text-foreground tabular-nums">{rate.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Charts — stack vertically below xl */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Daily Activity</span>
          </div>
          <div className="h-72">
            {loading ? (
              <div className="h-full bg-secondary/40 rounded-xl animate-pulse" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
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
            <span className="text-sm font-medium text-foreground">Response Trend</span>
          </div>
          <div className="h-72">
            {loading ? (
              <div className="h-full bg-secondary/40 rounded-xl animate-pulse" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
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
      {/* Smart Scheduling Insights */}
      {smartSchedule && (
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <Clock size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Smart Scheduling Insights</span>
          </div>
          {smartSchedule.recommendation && (
            <p className="text-sm text-blue-400 mb-4 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/15">
              {smartSchedule.recommendation}
            </p>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Response Rate by Hour</p>
              <div className="space-y-1.5">
                {(smartSchedule.hourlyRates || []).filter((h: any) => h.sent > 0).slice(0, 12).map((h: any) => (
                  <div key={h.hour} className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground w-12 tabular-nums">{h.hour}:00</span>
                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(h.rate, 100)}%` }} />
                    </div>
                    <span className="text-[11px] text-foreground tabular-nums w-12 text-right">{h.rate.toFixed(0)}%</span>
                    <span className="text-[10px] text-muted-foreground w-8">({h.sent})</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Response Rate by Day</p>
              <div className="space-y-1.5">
                {(smartSchedule.dowRates || []).map((d: any) => (
                  <div key={d.day} className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground w-8">{d.day}</span>
                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(d.rate, 100)}%` }} />
                    </div>
                    <span className="text-[11px] text-foreground tabular-nums w-12 text-right">{d.rate.toFixed(0)}%</span>
                    <span className="text-[10px] text-muted-foreground w-8">({d.sent})</span>
                  </div>
                ))}
              </div>
              {smartSchedule.avgResponseHours && (
                <p className="text-xs text-muted-foreground mt-4">
                  Avg response time: <span className="text-foreground font-medium">{smartSchedule.avgResponseHours}h</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sequence Performance */}
      {seqOverview.length > 0 && (
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Sequence Performance</span>
          </div>
          <div className="space-y-2">
            {seqOverview.map((seq: any) => {
              const connectRate = seq.invites_sent > 0 ? Math.round((seq.connected / seq.invites_sent) * 100) : 0;
              const replyRate = seq.connected > 0 ? Math.round((seq.replied / seq.connected) * 100) : 0;
              const isSelected = selectedSeqId === seq.id;
              return (
                <div key={seq.id}>
                  <button
                    onClick={() => setSelectedSeqId(isSelected ? null : seq.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${isSelected ? 'bg-blue-500/[0.06] border-blue-500/25' : 'bg-secondary/30 border-border/50 hover:border-border'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">{seq.name}</span>
                      <span className="text-xs text-muted-foreground">{seq.total_contacts} contacts</span>
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-center">
                      <div><p className="text-sm font-semibold text-foreground tabular-nums">{seq.invites_sent}</p><p className="text-[10px] text-muted-foreground">Invites</p></div>
                      <div><p className="text-sm font-semibold text-foreground tabular-nums">{seq.connected}</p><p className="text-[10px] text-muted-foreground">Connected</p></div>
                      <div><p className="text-sm font-semibold text-foreground tabular-nums">{seq.messages_sent}</p><p className="text-[10px] text-muted-foreground">Messages</p></div>
                      <div><p className="text-sm font-semibold text-foreground tabular-nums">{seq.replied}</p><p className="text-[10px] text-muted-foreground">Replied</p></div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 t-caption">
                      <span>Accept rate: <span className={`font-medium ${connectRate >= 30 ? 'text-emerald-400' : connectRate >= 15 ? 'text-amber-400' : 'text-red-400'}`}>{connectRate}%</span></span>
                      <span>Reply rate: <span className={`font-medium ${replyRate >= 10 ? 'text-emerald-400' : replyRate >= 5 ? 'text-amber-400' : 'text-muted-foreground'}`}>{replyRate}%</span></span>
                    </div>
                  </button>

                  {/* Step-by-step drill-down */}
                  {isSelected && seqDetail && (
                    <div className="mt-2 ml-4 p-4 rounded-xl bg-secondary/20 border border-border/50 space-y-4 animate-fade-in">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Step Funnel</p>
                      <div className="space-y-2">
                        {(seqDetail.funnel || []).map((step: any, i: number) => {
                          const prevContacts = i === 0 ? step.contacts : seqDetail.funnel[i - 1]?.contacts || step.contacts;
                          const dropOff = prevContacts > 0 ? Math.round(((prevContacts - step.contacts) / prevContacts) * 100) : 0;
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/15 shrink-0">
                                Step {step.step_number}
                              </span>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded border ${
                                step.action_type === 'connection' ? 'bg-blue-500/10 text-blue-400 border-blue-500/15' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/15'
                              }`}>
                                {step.action_type === 'connection' ? 'Connect' : 'Message'}
                              </span>
                              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${seqDetail.funnel[0]?.contacts > 0 ? (step.contacts / seqDetail.funnel[0].contacts) * 100 : 0}%` }} />
                              </div>
                              <span className="text-xs text-foreground font-medium tabular-nums w-8 text-right">{step.contacts}</span>
                              {i > 0 && dropOff > 0 && (
                                <span className="text-[10px] text-red-400/70 w-12 text-right">-{dropOff}%</span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Variant performance */}
                      {seqDetail.variants && seqDetail.variants.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">A/B Variant Performance</p>
                          <div className="grid grid-cols-2 gap-2">
                            {seqDetail.variants.map((v: any, i: number) => (
                              <div key={i} className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">{v.variant}</span>
                                  <span className="text-[10px] text-muted-foreground">Step {v.step_number}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-muted-foreground">Sent: <span className="text-foreground font-medium">{v.sent}</span></span>
                                  <span className="text-xs text-muted-foreground">Replies: <span className="text-emerald-400 font-medium">{v.replies}</span></span>
                                  <span className="text-xs text-muted-foreground">Rate: <span className={`font-medium ${v.sent > 0 && (v.replies / v.sent) >= 0.1 ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                                    {v.sent > 0 ? Math.round((v.replies / v.sent) * 100) : 0}%
                                  </span></span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
