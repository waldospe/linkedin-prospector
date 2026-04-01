'use client';

import { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, Send, MapPin, Users, Linkedin, Clock, CheckCircle2, AlertCircle, MessageCircle, GitBranch, Loader2 } from 'lucide-react';
import { STAGE_MAP, stageColors } from '@/lib/constants';
import { useUser } from '@/components/user-context';

interface ContactDetailProps {
  contactId: number;
  onClose: () => void;
}

export default function ContactDetail({ contactId, onClose }: ContactDetailProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string>('');
  const messageEndRef = useRef<HTMLDivElement>(null);
  const { apiQuery } = useUser();

  useEffect(() => {
    fetchDetail();
  }, [contactId]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.linkedinConversation]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/detail${apiQuery}`);
      if (res.ok) setData(await res.json());
    } finally { setLoading(false); }
  };

  const sendMessage = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    setSendResult('');
    try {
      const res = await fetch(`/api/contacts/${contactId}/send-message${apiQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      });
      const result = await res.json();
      if (res.ok) {
        setSendResult(result.sequenceCancelled > 0 ? 'Sent! Sequence paused.' : 'Sent!');
        setMessage('');
        fetchDetail(); // refresh conversation
      } else {
        setSendResult(result.error || 'Failed to send');
      }
    } catch {
      setSendResult('Failed to send');
    } finally {
      setSending(false);
      setTimeout(() => setSendResult(''), 4000);
    }
  };

  const contact = data?.contact;
  const profile = data?.linkedinProfile;
  const conversation = data?.linkedinConversation || [];
  const queueHistory = data?.queueHistory || [];

  const statusCfg = contact ? (STAGE_MAP[contact.status] || STAGE_MAP.new) : null;
  const colors = contact ? (stageColors[contact.status] || stageColors.new) : null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-[800px] bg-[hsl(230,15%,6.5%)] border-l border-[hsl(230,10%,14%)] flex animate-slide-in-right overflow-hidden">

        {/* Left: Profile Card */}
        <div className="w-[320px] border-r border-[hsl(230,10%,12%)] p-6 overflow-y-auto shrink-0">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Contact</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-all">
              <X size={16} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
          ) : contact ? (
            <div className="space-y-6">
              {/* Avatar + Name */}
              <div className="text-center">
                {contact.avatar_url && contact.avatar_url !== 'none' ? (
                  <img src={contact.avatar_url} alt="" className="w-20 h-20 rounded-2xl object-cover mx-auto border-2 border-[hsl(230,10%,16%)] shadow-lg" />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border-2 border-blue-500/15 flex items-center justify-center text-2xl font-bold text-blue-300 mx-auto">
                    {(contact.first_name || contact.name || '?').charAt(0)}
                  </div>
                )}
                <h3 className="text-lg font-semibold text-white mt-4">
                  {[contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">{contact.title}</p>
                <p className="text-sm text-muted-foreground">{contact.company}</p>

                {/* Status badge */}
                {statusCfg && colors && (
                  <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-lg mt-3 ${colors.bg} ${colors.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                    {statusCfg.label}
                  </div>
                )}
              </div>

              {/* LinkedIn link */}
              {contact.linkedin_url && (
                <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/15 text-blue-400 text-sm hover:bg-blue-500/15 transition-all">
                  <Linkedin size={14} />
                  <span className="truncate text-xs">{contact.linkedin_url.replace('https://www.', '').replace('https://', '')}</span>
                  <ExternalLink size={12} className="ml-auto shrink-0" />
                </a>
              )}

              {/* LinkedIn profile details */}
              {profile && (
                <div className="space-y-3">
                  {profile.headline && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Headline</p>
                      <p className="text-xs text-white/80 leading-relaxed">{profile.headline}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {profile.location && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin size={11} />
                        <span className="truncate">{profile.location}</span>
                      </div>
                    )}
                    {profile.connections_count && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users size={11} />
                        <span>{profile.connections_count.toLocaleString()} connections</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {profile.is_relationship && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">Connected</span>
                    )}
                    {profile.is_premium && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/15">Premium</span>
                    )}
                  </div>
                </div>
              )}

              {/* Sequence history */}
              {queueHistory.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Sequence History</p>
                  <div className="space-y-1.5">
                    {queueHistory.slice(-5).map((q: any) => (
                      <div key={q.id} className="flex items-center gap-2 text-xs">
                        {q.status === 'completed' ? (
                          <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                        ) : q.status === 'failed' ? (
                          <AlertCircle size={11} className="text-red-400 shrink-0" />
                        ) : (
                          <Clock size={11} className="text-amber-400 shrink-0" />
                        )}
                        <span className="text-muted-foreground capitalize">{q.action_type}</span>
                        <span className={`text-[10px] ${q.status === 'completed' ? 'text-emerald-400' : q.status === 'failed' ? 'text-red-400' : 'text-amber-400'}`}>
                          {q.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-10">Contact not found</p>
          )}
        </div>

        {/* Right: Conversation */}
        <div className="flex-1 flex flex-col">
          <div className="px-6 py-4 border-b border-[hsl(230,10%,12%)]">
            <div className="flex items-center gap-2">
              <MessageCircle size={16} className="text-blue-400" />
              <h2 className="text-sm font-semibold text-white">Conversation</h2>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
              </div>
            ) : conversation.length === 0 && data?.storedMessages?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <MessageCircle className="w-10 h-10 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">No conversation yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {profile?.is_relationship || ['connected', 'msg_sent', 'replied'].includes(contact?.status)
                    ? 'Send a message below to start a conversation' : 'Connect first to start messaging'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Show LinkedIn conversation if available */}
                {conversation.length > 0 ? (
                  conversation.map((msg: any, idx: number) => (
                    <div key={msg.id || idx} className={`flex ${msg.is_me ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        msg.is_me
                          ? 'bg-blue-600/20 text-blue-100 rounded-br-md'
                          : 'bg-[hsl(230,12%,12%)] text-white/90 rounded-bl-md'
                      }`}>
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                        {msg.timestamp && (
                          <p className={`text-[10px] mt-1.5 ${msg.is_me ? 'text-blue-400/50' : 'text-muted-foreground/50'}`}>
                            {new Date(msg.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  /* Fall back to stored messages (manual + sequence-sent) */
                  (data?.storedMessages || []).map((msg: any, idx: number) => (
                    <div key={msg.id || idx} className="flex justify-end">
                      <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md bg-blue-600/20 text-blue-100 text-sm leading-relaxed">
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-[10px] text-blue-400/50 mt-1.5">
                          {new Date(msg.sent_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          {msg.source === 'sequence' && <span className="ml-2 text-violet-400/70">● Sequence</span>}
                          {msg.replied_at && <span className="ml-2 text-emerald-400/70">● Replied</span>}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messageEndRef} />
              </div>
            )}
          </div>

          {/* Message input */}
          <div className="px-6 py-4 border-t border-[hsl(230,10%,12%)]">
            {sendResult && (
              <div className={`text-xs mb-2 px-3 py-1.5 rounded-lg ${
                sendResult.includes('Sent') ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
              }`}>
                {sendResult}
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={profile?.is_relationship || ['connected', 'msg_sent', 'replied', 'positive', 'meeting_booked'].includes(contact?.status) ? 'Type a message... (Enter to send, Shift+Enter for newline)' : 'Connect with this person first to send messages'}
                disabled={!profile?.is_relationship && !['connected', 'msg_sent', 'replied', 'positive', 'meeting_booked'].includes(contact?.status)}
                rows={2}
                className="flex-1 bg-[hsl(230,12%,10%)] border border-[hsl(230,10%,15%)] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-muted-foreground/40 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 resize-none disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              />
              <button
                onClick={sendMessage}
                disabled={sending || !message.trim() || (!profile?.is_relationship && !['connected', 'msg_sent', 'replied', 'positive', 'meeting_booked'].includes(contact?.status))}
                className="px-4 rounded-xl btn-primary text-white disabled:opacity-30 disabled:cursor-not-allowed shrink-0 flex items-center gap-2"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
            {(profile?.is_relationship || ['connected', 'msg_sent', 'replied', 'positive', 'meeting_booked'].includes(contact?.status)) && (
              <p className="text-[10px] text-muted-foreground/50 mt-2">
                Sending a manual message will cancel any active sequence for this contact
              </p>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </div>
  );
}
