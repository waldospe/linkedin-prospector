'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
  RefreshCw
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
  scheduled_at: string;
}

interface Contact {
  id: number;
  status: string;
}

export default function DashboardPage() {
  const { fetchWithUser, currentUser } = useUser();
  const [stats, setStats] = useState<Stats>({ today: { connections_sent: 0, messages_sent: 0, replies_received: 0 } });
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  const fetchData = async () => {
    try {
      const [statsRes, queueRes, contactsRes] = await Promise.all([
        fetchWithUser('/api/stats'),
        fetchWithUser('/api/queue'),
        fetchWithUser('/api/contacts')
      ]);
      const statsData = await statsRes.json();
      const queueData = await queueRes.json();
      const contactsData = await contactsRes.json();
      setStats(statsData);
      setQueue(queueData);
      setContacts(contactsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const processQueue = async () => {
    setProcessing(true);
    try {
      await fetchWithUser('/api/queue/process', { method: 'POST' });
      fetchData();
    } catch (error) {
      console.error('Failed to process queue:', error);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-zinc-500" />;
    }
  };

  const pendingCount = queue.filter(q => q.status === 'pending').length;
  const dailyLimit = 20;
  const dailyProgress = ((stats.today.connections_sent + stats.today.messages_sent) / dailyLimit) * 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-zinc-400 mt-1">
            {currentUser ? `Viewing as ${currentUser.name}` : 'LinkedIn automation overview'}
          </p>
        </div>
        <Button 
          onClick={processQueue} 
          disabled={processing || pendingCount === 0}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${processing ? 'animate-spin' : ''}`} />
          {processing ? 'Processing...' : `Process Queue (${pendingCount})`}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
              <Send size={16} /> Connections Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{stats.today.connections_sent}</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
              <MessageCircle size={16} /> Messages Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-400">{stats.today.messages_sent}</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
              <Reply size={16} /> Replies Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-400">{stats.today.replies_received}</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
              <Users size={16} /> Total Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{contacts.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <span>Daily Activity Limit</span>
            <span className="text-sm text-zinc-400">
              {stats.today.connections_sent + stats.today.messages_sent} / {dailyLimit}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={dailyProgress} className="h-2" />
          <p className="text-xs text-zinc-500 mt-2">
            {dailyProgress >= 100 ? 'Daily limit reached' : `${Math.round(100 - dailyProgress)}% remaining`}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ListTodo size={16} /> Pending Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-zinc-500">Loading...</p>
            ) : queue.filter(q => q.status === 'pending').length === 0 ? (
              <p className="text-zinc-500">No pending items in queue</p>
            ) : (
              <div className="space-y-2">
                {queue.filter(q => q.status === 'pending').slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-zinc-950 rounded border border-zinc-800">
                    <div>
                      <p className="text-white text-sm">{item.contact_name}</p>
                      <Badge variant="outline" className="text-xs mt-1">
                        {item.action_type}
                      </Badge>
                    </div>
                    {getStatusIcon(item.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Contact Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {['pending', 'connected', 'messaged', 'replied'].map(status => {
                const count = contacts.filter(c => c.status === status).length;
                const percentage = contacts.length > 0 ? (count / contacts.length) * 100 : 0;
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className="w-20 text-sm text-zinc-400 capitalize">{status}</span>
                    <div className="flex-1 bg-zinc-950 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-12 text-sm text-zinc-300 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
