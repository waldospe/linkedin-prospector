'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { TrendingUp, Send, MessageCircle, Reply, BarChart3 } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats?days=30');
      setStats(await res.json());
    } finally { setLoading(false); }
  };

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
  const connectionRate = totalConnections > 0 ? (totalMessages / totalConnections) * 100 : 0;

  const statCards = [
    { label: 'Connections', value: totalConnections, icon: Send, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/15' },
    { label: 'Messages', value: totalMessages, icon: MessageCircle, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/15' },
    { label: 'Replies', value: totalReplies, icon: Reply, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/15' },
    { label: 'Reply Rate', value: `${replyRate.toFixed(1)}%`, icon: TrendingUp, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/15' },
  ];

  const tooltipStyle = {
    contentStyle: { backgroundColor: 'hsl(225 15% 9%)', border: '1px solid hsl(225 12% 16%)', borderRadius: '8px', fontSize: '12px' },
    labelStyle: { color: 'hsl(220 10% 54%)', marginBottom: '4px' },
    itemStyle: { padding: '1px 0' },
  };

  const rates = [
    { label: 'Connection Acceptance', value: connectionRate, color: 'bg-blue-500' },
    { label: 'Message Reply Rate', value: replyRate, color: 'bg-indigo-500' },
    { label: 'Overall Response', value: totalConnections > 0 ? (totalReplies / totalConnections) * 100 : 0, color: 'bg-emerald-500' },
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
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(225 12% 14%)" />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(225 12% 14%)" />
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

      {/* Performance summary */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium text-white">Performance Summary</span>
        </div>
        <div className="space-y-4">
          {rates.map(({ label, value, color }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                <span className="text-xs font-medium text-white tabular-nums">{value.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
