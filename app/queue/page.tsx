'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Clock, CheckCircle2, AlertCircle, Pause, Play } from 'lucide-react';

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

export default function QueuePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    try {
      const res = await fetch('/api/queue');
      const data = await res.json();
      setQueue(data);
    } catch (error) {
      console.error('Failed to fetch queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const processQueue = async () => {
    setProcessing(true);
    try {
      await fetch('/api/queue/process', { method: 'POST' });
      fetchQueue();
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
      case 'paused': return <Pause className="w-4 h-4 text-orange-500" />;
      default: return <Clock className="w-4 h-4 text-zinc-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="text-yellow-500">Pending</Badge>;
      case 'completed': return <Badge variant="outline" className="text-green-500">Completed</Badge>;
      case 'failed': return <Badge variant="outline" className="text-red-500">Failed</Badge>;
      case 'paused': return <Badge variant="outline" className="text-orange-500">Paused</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Queue</h1>
          <p className="text-zinc-400 mt-1">Manage pending outreach actions</p>
        </div>
        <Button 
          onClick={processQueue} 
          disabled={processing}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${processing ? 'animate-spin' : ''}`} />
          {processing ? 'Processing...' : 'Process Queue'}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <p className="text-sm text-zinc-400">Pending</p>
            <p className="text-2xl font-bold text-yellow-500">
              {queue.filter(q => q.status === 'pending').length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <p className="text-sm text-zinc-400">Completed Today</p>
            <p className="text-2xl font-bold text-green-500">
              {queue.filter(q => q.status === 'completed').length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <p className="text-sm text-zinc-400">Failed</p>
            <p className="text-2xl font-bold text-red-500">
              {queue.filter(q => q.status === 'failed').length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <p className="text-sm text-zinc-400">Total</p>
            <p className="text-2xl font-bold text-white">{queue.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">Queue Items</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-zinc-500">Loading...</p>
          ) : queue.length === 0 ? (
            <p className="text-zinc-500">No items in queue</p>
          ) : (
            <div className="space-y-2">
              {queue.map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between p-4 bg-zinc-950 rounded-lg border border-zinc-800"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(item.status)}
                    <div>
                      <p className="text-white font-medium">{item.contact_name}</p>
                      <p className="text-sm text-zinc-400">
                        {item.sequence_name} • Step {item.step_number}
                      </p>
                      {item.error && (
                        <p className="text-xs text-red-400 mt-1">{item.error}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="capitalize">
                      {item.action_type}
                    </Badge>
                    {getStatusBadge(item.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
