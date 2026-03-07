'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, Send, MessageCircle, Reply } from 'lucide-react';

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

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats?days=30');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = stats.daily.slice(0, 14).reverse().map(day => ({
    date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    connections: day.connections_sent,
    messages: day.messages_sent,
    replies: day.replies_received
  }));

  const totalConnections = stats.daily.reduce((sum, d) => sum + d.connections_sent, 0) + stats.today.connections_sent;
  const totalMessages = stats.daily.reduce((sum, d) => sum + d.messages_sent, 0) + stats.today.messages_sent;
  const totalReplies = stats.daily.reduce((sum, d) => sum + d.replies_received, 0) + stats.today.replies_received;
  
  const replyRate = totalMessages > 0 ? (totalReplies / totalMessages) * 100 : 0;
  const connectionRate = totalConnections > 0 ? (totalMessages / totalConnections) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Analytics</h1>
        <p className="text-zinc-400 mt-1">Performance metrics and insights</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
              <Send size={16} /> Total Connections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{totalConnections}</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
              <MessageCircle size={16} /> Total Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-400">{totalMessages}</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
              <Reply size={16} /> Total Replies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-400">{totalReplies}</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
              <TrendingUp size={16} /> Reply Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-purple-400">{replyRate.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Daily Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                    <YAxis stroke="#71717a" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
                      labelStyle={{ color: '#a1a1aa' }}
                    />
                    <Bar dataKey="connections" fill="#3b82f6" name="Connections" />
                    <Bar dataKey="messages" fill="#8b5cf6" name="Messages" />
                    <Bar dataKey="replies" fill="#10b981" name="Replies" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-zinc-500 text-center pt-20">No data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Response Rate Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                    <YAxis stroke="#71717a" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
                      labelStyle={{ color: '#a1a1aa' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="replies" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      name="Replies"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="messages" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      name="Messages"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-zinc-500 text-center pt-20">No data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-40 text-sm text-zinc-400">Connection Acceptance</span>
              <div className="flex-1 bg-zinc-950 rounded-full h-4 overflow-hidden">
                <div className="h-full bg-blue-600" style={{ width: `${Math.min(connectionRate, 100)}%` }} />
              </div>
              <span className="w-16 text-sm text-zinc-300 text-right">{connectionRate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-40 text-sm text-zinc-400">Message Reply Rate</span>
              <div className="flex-1 bg-zinc-950 rounded-full h-4 overflow-hidden">
                <div className="h-full bg-purple-600" style={{ width: `${Math.min(replyRate, 100)}%` }} />
              </div>
              <span className="w-16 text-sm text-zinc-300 text-right">{replyRate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-40 text-sm text-zinc-400">Overall Response</span>
              <div className="flex-1 bg-zinc-950 rounded-full h-4 overflow-hidden">
                <div className="h-full bg-green-600" style={{ width: `${Math.min((totalReplies / Math.max(totalConnections, 1)) * 100, 100)}%` }} />
              </div>
              <span className="w-16 text-sm text-zinc-300 text-right">
                {((totalReplies / Math.max(totalConnections, 1)) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
