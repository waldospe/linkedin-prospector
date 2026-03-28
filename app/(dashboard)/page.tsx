'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/components/user-context';
import {
  Users,
  Send,
  MessageCircle,
  Reply,
  ListTodo,
  CheckCircle2,
  Clock,
  AlertCircle,
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

interface Contact {
  id: number;
  status: string;
}

export default function DashboardPage() {
  const { currentUser } = useUser();
  const [stats, setStats] = useState<Stats>({ today: { connections_sent: 0, messages_sent: 0, replies_received: 0 } });
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (currentUser) fetchData();
  }, [currentUser]);

  const fetchData = async () => {
    try {
      const [statsRes, queueRes, contactsRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/queue'),
        fetch('/api/contacts'),
      ]);
      const [statsData, queueData, contactsData] = await Promise.all([
        statsRes.json(), queueRes.json(), contactsRes.json(),
      ]);
      setStats(statsData);
      setQueue(Array.isArray(queueData) ? queueData : []);
      setContacts(Array.isArray(contactsData) ? contactsData : []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const processQueue = async () => {
    setProcessing(true);
    try {
      await fetch('/api/queue/process', { method: 'POST' });
      fetchData();
    } finally {
      setProcessing(false);
    }
  };

  const pendingCount = queue.filter(q => q.status === 'pending').length;
  const dailyLimit = currentUser?.daily_limit || 20;
  const dailyUsed = stats.today.connections_sent + stats.today.messages_sent;
  const dailyProgress = Math.min((dailyUsed / dailyLimit) * 100, 100);

  const statCards = [
    { label: 'Connections', value: stats.today.connections_sent, icon: Send, color: 'blue' },
    { label: 'Messages', value: stats.today.messages_sent, icon: MessageCircle, color: 'indigo' },
    { label: 'Replies', value: stats.today.replies_received, icon: Reply, color: 'emerald' },
    { label: 'Contacts', value: contacts.length, icon: Users, color: 'violet' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/15',
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/15',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/15',
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/15',
  };

  const statusColors: Record<string, string> = {
    pending: 'text-amber-400',
    connected: 'text-blue-400',
    messaged: 'text-indigo-400',
    replied: 'text-emerald-400',
  };

  const statusBarColors: Record<string, string> = {
    pending: 'bg-amber-500',
    connected: 'bg-blue-500',
    messaged: 'bg-indigo-500',
    replied: 'bg-emerald-500',
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
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${colorMap[color]}`}>
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
          <span className="text-sm tabular-nums text-muted-foreground">
            {dailyUsed} / {dailyLimit}
          </span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${dailyProgress}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {dailyProgress >= 100 ? 'Daily limit reached' : `${Math.round(100 - dailyProgress)}% remaining`}
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* Pending queue */}
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <ListTodo size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-white">Pending Queue</span>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-secondary rounded-lg animate-pulse" />
              ))}
            </div>
          ) : pendingCount === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">All caught up</p>
            </div>
          ) : (
            <div className="space-y-2">
              {queue.filter(q => q.status === 'pending').slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border/50">
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="text-sm text-white">{item.contact_name}</span>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-md bg-secondary text-muted-foreground capitalize">
                    {item.action_type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contact status */}
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-white">Contact Status</span>
          </div>
          <div className="space-y-4">
            {['pending', 'connected', 'messaged', 'replied'].map(status => {
              const count = contacts.filter(c => c.status === status).length;
              const percentage = contacts.length > 0 ? (count / contacts.length) * 100 : 0;
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-medium capitalize ${statusColors[status]}`}>{status}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${statusBarColors[status]}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
