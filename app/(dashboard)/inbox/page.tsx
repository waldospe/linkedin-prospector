'use client';

import { useEffect, useState } from 'react';
import { Inbox, MessageCircle, ExternalLink, Search } from 'lucide-react';
import { useUser } from '@/components/user-context';
import { stageColors, STAGE_MAP } from '@/lib/constants';
import { EmptyState } from '@/components/empty-state';
import ContactDetail from '@/components/contact-detail';

interface Conversation {
  id: number;
  first_name: string;
  last_name: string;
  name: string;
  company: string;
  title: string;
  linkedin_url: string;
  avatar_url: string;
  status: string;
  last_reply_preview: string | null;
  last_reply_at: string | null;
  last_sent_preview: string | null;
  last_activity_at: string | null;
}

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { apiQuery } = useUser();

  useEffect(() => {
    fetch(`/api/inbox${apiQuery}`).then(r => r.json()).then(data => {
      if (Array.isArray(data)) setConversations(data);
    }).finally(() => setLoading(false));
  }, [apiQuery]);

  const filtered = search
    ? conversations.filter(c => {
        const name = [c.first_name, c.last_name, c.name].filter(Boolean).join(' ').toLowerCase();
        return name.includes(search.toLowerCase()) || c.company?.toLowerCase().includes(search.toLowerCase());
      })
    : conversations;

  const displayName = (c: Conversation) => [c.first_name, c.last_name].filter(Boolean).join(' ') || c.name || 'Unknown';

  const timeAgo = (date: string | null) => {
    if (!date) return '';
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="h-page">Inbox</h1>
          <p className="t-meta mt-1">Conversations with your LinkedIn connections</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          placeholder="Search conversations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-9 rounded-lg border border-border bg-card/50 text-foreground pl-10 pr-4 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500/50 transition-all"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-secondary rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={search ? 'No conversations match your search' : 'No conversations yet'}
          description={search ? undefined : 'Replies and active conversations will appear here once contacts respond.'}
        />
      ) : (
        <div className="space-y-1.5">
          {filtered.map(c => {
            const colors = stageColors[c.status] || stageColors.new;
            const stage = STAGE_MAP[c.status];
            const hasReply = c.status === 'replied' || c.status === 'engaged';
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full glass glass-hover rounded-xl p-4 text-left transition-all ${
                  hasReply ? 'border-emerald-500/20 bg-emerald-500/[0.03]' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  {c.avatar_url && c.avatar_url !== 'none' ? (
                    <img src={c.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-border shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/10 flex items-center justify-center text-sm font-semibold text-blue-300 shrink-0">
                      {(c.first_name || c.name || '?').charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{displayName(c)}</span>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                        <span className={`w-1 h-1 rounded-full ${colors.dot}`} />
                        {stage?.label || c.status}
                      </span>
                      {c.last_activity_at && (
                        <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{timeAgo(c.last_activity_at)}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {c.title}{c.title && c.company ? ' at ' : ''}{c.company}
                    </p>
                    {c.last_reply_preview ? (
                      <p className="text-xs text-emerald-400/80 truncate mt-1">
                        <MessageCircle size={10} className="inline mr-1" />
                        {c.last_reply_preview}
                      </p>
                    ) : c.last_sent_preview ? (
                      <p className="text-xs text-muted-foreground/60 truncate mt-1">
                        You: {c.last_sent_preview}
                      </p>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedId && <ContactDetail contactId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
