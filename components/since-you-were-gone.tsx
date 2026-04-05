'use client';

import { useEffect, useState } from 'react';
import { X, Sparkles, Send, Reply, MessageCircle } from 'lucide-react';

interface Summary {
  connections_sent: number;
  replies: number;
  messages_sent: number;
  since: string;
}

export default function SinceYouWereGone() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const since = localStorage.getItem('lp-previous-login');
    if (!since) return;

    // Only show if it's been at least 6 hours since last login
    const hoursSince = (Date.now() - new Date(since).getTime()) / 3600000;
    if (hoursSince < 6) {
      localStorage.removeItem('lp-previous-login');
      return;
    }

    fetch(`/api/since-last-login?since=${encodeURIComponent(since)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) return;
        const total = (data.connections_sent || 0) + (data.replies || 0) + (data.messages_sent || 0);
        if (total > 0) setSummary(data);
      })
      .finally(() => localStorage.removeItem('lp-previous-login'));
  }, []);

  if (!summary || dismissed) return null;

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const hours = Math.floor((now.getTime() - d.getTime()) / 3600000);
    const days = Math.floor(hours / 24);
    if (days >= 2) return `${days} days ago`;
    if (days === 1) return 'yesterday';
    if (hours >= 2) return `${hours} hours ago`;
    return 'earlier today';
  };

  const items = [
    { label: 'connections sent', value: summary.connections_sent, icon: Send, color: 'text-blue-400' },
    { label: 'messages sent', value: summary.messages_sent, icon: MessageCircle, color: 'text-indigo-400' },
    { label: 'replies received', value: summary.replies, icon: Reply, color: 'text-emerald-400' },
  ].filter(i => i.value > 0);

  return (
    <div className="glass rounded-2xl p-5 relative animate-fade-in border border-blue-500/20">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
      >
        <X size={14} />
      </button>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/25 flex items-center justify-center shrink-0">
          <Sparkles size={18} className="text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Since your last visit {formatTime(summary.since)}</p>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            {items.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <Icon size={13} className={color} />
                <span className="text-sm font-semibold text-foreground tabular-nums">{value}</span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
