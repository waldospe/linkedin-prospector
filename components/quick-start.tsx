'use client';

import { useState, useEffect } from 'react';
import { Rocket, Users, GitBranch, Play, CheckCircle2, ArrowRight, X } from 'lucide-react';
import { useUser } from '@/components/user-context';

export function QuickStart() {
  const [dismissed, setDismissed] = useState(false);
  const [hasContacts, setHasContacts] = useState(true);
  const [hasSequences, setHasSequences] = useState(true);
  const [hasQueued, setHasQueued] = useState(true);
  const { apiQuery } = useUser();

  useEffect(() => {
    // Check if user already has things running
    Promise.all([
      fetch(`/api/contacts${apiQuery}&page=1&limit=1`).then(r => r.json()),
      fetch('/api/sequences').then(r => r.json()),
      fetch(`/api/queue${apiQuery}`).then(r => r.json()),
    ]).then(([contacts, sequences, queue]) => {
      const contactCount = contacts.total || (Array.isArray(contacts) ? contacts.length : 0);
      const seqCount = Array.isArray(sequences) ? sequences.length : 0;
      const queuedCount = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'pending').length : 0;
      setHasContacts(contactCount > 0);
      setHasSequences(seqCount > 0);
      setHasQueued(queuedCount > 0);
    }).catch(() => {});

    // Check localStorage for dismiss
    if (typeof window !== 'undefined') {
      setDismissed(localStorage.getItem('lp-quickstart-dismissed') === '1');
    }
  }, [apiQuery]);

  // Don't show if already running or dismissed
  if (dismissed || hasQueued) return null;

  const steps = [
    { done: hasSequences, label: 'Create a sequence', desc: 'A connection request + follow-up message template', href: '/sequences/new', icon: GitBranch },
    { done: hasContacts, label: 'Import 5 contacts', desc: 'CSV, Google Sheets, or search LinkedIn', href: '/contacts', icon: Users },
    { done: false, label: 'Launch your first campaign', desc: 'Select contacts → assign a sequence → go', href: '/contacts', icon: Play },
  ];

  const completedSteps = steps.filter(s => s.done).length;

  return (
    <div className="glass rounded-2xl p-6 border border-blue-500/20 bg-gradient-to-r from-blue-500/[0.04] to-violet-500/[0.04] relative">
      <button
        onClick={() => { setDismissed(true); localStorage.setItem('lp-quickstart-dismissed', '1'); }}
        className="absolute top-4 right-4 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
      >
        <X size={14} />
      </button>

      <div className="flex items-start gap-4 mb-5">
        <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
          <Rocket size={20} className="text-blue-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">Get your first outreach running</h3>
          <p className="t-caption mt-0.5">Three steps to your first reply. Takes about 5 minutes.</p>
        </div>
      </div>

      <div className="space-y-2">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <a
              key={i}
              href={step.href}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                step.done
                  ? 'bg-emerald-500/[0.05] border-emerald-500/20'
                  : i === completedSteps
                    ? 'bg-blue-500/[0.05] border-blue-500/25 hover:border-blue-500/40'
                    : 'bg-secondary/20 border-border/50'
              }`}
            >
              {step.done ? (
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              ) : (
                <div className={`w-[18px] h-[18px] rounded-full border-2 shrink-0 ${
                  i === completedSteps ? 'border-blue-500' : 'border-border'
                }`} />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${step.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {step.label}
                </p>
                <p className="text-[11px] text-muted-foreground">{step.desc}</p>
              </div>
              {!step.done && i === completedSteps && (
                <ArrowRight size={14} className="text-blue-400 shrink-0" />
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}
