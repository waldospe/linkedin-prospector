'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Edit2, GitBranch, ArrowRight } from 'lucide-react';
import { useUser } from '@/components/user-context';
import { FUNNEL_STAGES, stageColors, STAGE_MAP } from '@/lib/constants';
import { EmptyState } from '@/components/empty-state';

interface Step {
  action: string;
  template: string;
  delay_hours: number;
  variants?: Array<{ label: string; template: string }>;
}

interface SequenceStats {
  totalContacts: number;
  byStage: Record<string, number>;
  queueCompleted: number;
  queueTotal: number;
}

interface Sequence {
  id: number;
  name: string;
  steps: Step[];
  active: number;
  user_id: number;
  owner_name?: string;
  visibility: string;
  shared_with_user_ids: string;
  stats?: SequenceStats;
}

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentUser, apiQuery, viewAs } = useUser();

  useEffect(() => {
    fetchSequences();
  }, [viewAs]);

  const fetchSequences = async () => {
    try {
      const res = await fetch(`/api/sequences${apiQuery}`);
      const data = await res.json();
      setSequences(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  const deleteSequence = async (id: number) => {
    if (!confirm('Delete this sequence? Contacts already in it will keep their queue items.')) return;
    await fetch(`/api/sequences/${id}`, { method: 'DELETE' });
    fetchSequences();
  };

  const toggleActive = async (seq: Sequence, active: boolean) => {
    await fetch(`/api/sequences/${seq.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: seq.name, steps: seq.steps, active }),
    });
    fetchSequences();
  };

  const getVisibilityBadge = (seq: Sequence) => {
    if (seq.visibility === 'team') return { label: 'Team', color: 'text-violet-400 bg-violet-500/10 border-violet-500/15' };
    if (seq.visibility === 'specific') return { label: 'Shared', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/15' };
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="h-page">Sequences</h1>
          <p className="t-meta mt-1">Automated multi-step outreach workflows</p>
        </div>
        <Link
          href="/sequences/new"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-all glow-sm"
        >
          <Plus size={15} /> New Sequence
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-secondary rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sequences.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="No sequences yet"
          description="Build a connection request followed by a few message steps and let the queue handle the rest."
          action={
            <Link
              href="/sequences/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-all"
            >
              <Plus size={14} /> Create your first sequence
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {sequences.map((seq) => (
            <div key={seq.id} className="glass glass-hover rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/15 flex items-center justify-center">
                    <GitBranch size={14} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="h-card">{seq.name}</h3>
                    <p className="t-caption">{seq.steps.length} step{seq.steps.length === 1 ? '' : 's'}</p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                      seq.active
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                        : 'bg-secondary text-muted-foreground border border-border/50'
                    }`}
                  >
                    {seq.active ? 'Active' : 'Inactive'}
                  </span>
                  {(() => {
                    const badge = getVisibilityBadge(seq);
                    return badge ? (
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${badge.color}`}>
                        {badge.label}
                      </span>
                    ) : null;
                  })()}
                  {seq.owner_name && seq.user_id !== currentUser?.id && (
                    <span className="text-[10px] text-muted-foreground">by {seq.owner_name}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={seq.active === 1} onCheckedChange={(v) => toggleActive(seq, v)} />
                  <Link
                    href={`/sequences/${seq.id}/edit`}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                  >
                    <Edit2 size={14} />
                  </Link>
                  <button
                    onClick={() => deleteSequence(seq.id)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {seq.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-md border ${
                        step.action === 'connection'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/15'
                          : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/15'
                      }`}
                    >
                      {step.action === 'connection' ? 'Connect' : 'Message'}
                    </span>
                    {i < seq.steps.length - 1 && <ArrowRight size={12} className="text-muted-foreground/30" />}
                  </div>
                ))}
              </div>

              {seq.stats && seq.stats.totalContacts > 0 && (() => {
                const stats = seq.stats;
                const pct = stats.queueTotal > 0 ? Math.round((stats.queueCompleted / stats.queueTotal) * 100) : 0;
                const stagesWithCounts = FUNNEL_STAGES.filter((s) => (stats.byStage[s.key] || 0) > 0);
                return (
                  <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-foreground">{stats.totalContacts.toLocaleString()}</span>
                        <span className="t-caption">contacts</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="t-caption">
                          {stats.queueCompleted.toLocaleString()} / {stats.queueTotal.toLocaleString()} sent
                        </span>
                        <span className={`text-sm font-medium ${pct === 100 ? 'text-emerald-400' : 'text-blue-400'}`}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {stats.totalContacts > 0 && (
                      <div className="flex h-2 w-full rounded-full overflow-hidden bg-secondary/50">
                        {stagesWithCounts.map((s) => {
                          const cnt = stats.byStage[s.key] || 0;
                          const w = (cnt / stats.totalContacts) * 100;
                          return (
                            <div
                              key={s.key}
                              className={stageColors[s.key]?.bar || 'bg-zinc-500'}
                              style={{ width: `${w}%` }}
                              title={`${s.label}: ${cnt}`}
                            />
                          );
                        })}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {stagesWithCounts.map((s) => {
                        const cnt = stats.byStage[s.key] || 0;
                        const stagePct = Math.round((cnt / stats.totalContacts) * 100);
                        const colors = stageColors[s.key];
                        return (
                          <div
                            key={s.key}
                            className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md border border-border/50 ${colors?.bg || ''}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${colors?.dot || 'bg-zinc-400'}`} />
                            <span className={colors?.text || 'text-muted-foreground'}>{STAGE_MAP[s.key]?.label || s.key}</span>
                            <span className="text-foreground">{cnt.toLocaleString()}</span>
                            <span className="text-muted-foreground">{stagePct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
