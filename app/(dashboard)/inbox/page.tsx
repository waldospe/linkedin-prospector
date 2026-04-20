'use client';

import { useEffect, useState } from 'react';
import { Inbox, MessageCircle, Search, CheckCheck, Circle } from 'lucide-react';
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
  inbox_status: 'unread' | 'handled';
  last_reply_preview: string | null;
  last_reply_at: string | null;
  last_sent_preview: string | null;
  last_activity_at: string | null;
}

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'handled'>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { apiQuery } = useUser();

  const fetchInbox = () => {
    const sep = apiQuery.includes('?') ? '&' : '?';
    fetch(`/api/inbox${apiQuery}${sep}filter=${filter}`).then(r => r.json()).then(data => {
      if (data.conversations) {
        setConversations(data.conversations);
        setUnreadCount(data.unreadCount || 0);
      }
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchInbox(); }, [apiQuery, filter]);

  const markHandled = async (contactId: number) => {
    await fetch(`/api/inbox${apiQuery}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contactId, inbox_status: 'handled' }),
    });
    setConversations(prev => prev.map(c => c.id === contactId ? { ...c, inbox_status: 'handled' } : c));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markUnread = async (contactId: number) => {
    await fetch(`/api/inbox${apiQuery}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contactId, inbox_status: 'unread' }),
    });
    setConversations(prev => prev.map(c => c.id === contactId ? { ...c, inbox_status: 'unread' } : c));
    setUnreadCount(prev => prev + 1);
  };

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
        <div className="flex items-center gap-3">
          <h1 className="h-page">Inbox</h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
              {unreadCount}
            </span>
          )}
        </div>
      </div>

      {/* Filter tabs + search */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1 bg-secondary/50 rounded-lg p-0.5">
          {([
            { key: 'all', label: 'All' },
            { key: 'unread', label: 'Unread' },
            { key: 'handled', label: 'Handled' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filter === tab.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 rounded-lg border border-border bg-card/50 text-foreground pl-10 pr-4 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-secondary rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={search ? 'No conversations match your search' : filter === 'unread' ? 'No unread conversations' : filter === 'handled' ? 'No handled conversations' : 'No conversations yet'}
          description={filter === 'all' && !search ? 'Replies and active conversations will appear here once contacts respond.' : undefined}
        />
      ) : (
        <div className="space-y-1.5">
          {filtered.map(c => {
            const colors = stageColors[c.status] || stageColors.new;
            const stage = STAGE_MAP[c.status];
            const hasReply = c.status === 'replied' || c.status === 'engaged';
            const isUnread = c.inbox_status !== 'handled';
            return (
              <div
                key={c.id}
                className={`glass glass-hover rounded-xl p-4 transition-all relative ${
                  hasReply && isUnread ? 'border-emerald-500/20 bg-emerald-500/[0.03]' : ''
                }`}
              >
                {/* Unread dot */}
                {isUnread && hasReply && (
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500" />
                )}
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedId(c.id)} className="shrink-0">
                    {c.avatar_url && c.avatar_url !== 'none' ? (
                      <img src={c.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-border" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/10 flex items-center justify-center text-sm font-semibold text-blue-300">
                        {(c.first_name || c.name || '?').charAt(0)}
                      </div>
                    )}
                  </button>
                  <button onClick={() => setSelectedId(c.id)} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${isUnread && hasReply ? 'font-semibold' : 'font-medium'} text-foreground`}>{displayName(c)}</span>
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
                      <p className={`text-xs truncate mt-1 ${isUnread ? 'text-emerald-400/90 font-medium' : 'text-emerald-400/60'}`}>
                        <MessageCircle size={10} className="inline mr-1" />
                        {c.last_reply_preview}
                      </p>
                    ) : c.last_sent_preview ? (
                      <p className="text-xs text-muted-foreground/60 truncate mt-1">
                        You: {c.last_sent_preview}
                      </p>
                    ) : null}
                  </button>
                  <button
                    onClick={() => isUnread ? markHandled(c.id) : markUnread(c.id)}
                    className={`p-2 rounded-lg transition-all shrink-0 ${
                      isUnread
                        ? 'text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10'
                        : 'text-emerald-400/50 hover:text-muted-foreground hover:bg-secondary'
                    }`}
                    title={isUnread ? 'Mark as handled' : 'Mark as unread'}
                  >
                    {isUnread ? <Circle size={16} /> : <CheckCheck size={16} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedId && (
        <ContactDetail
          contactId={selectedId}
          onClose={() => { setSelectedId(null); fetchInbox(); }}
        />
      )}
    </div>
  );
}
