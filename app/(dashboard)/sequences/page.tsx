'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Edit2, GitBranch, ArrowRight, Tag, Lock, Users as UsersIcon, Globe } from 'lucide-react';
import { useUser } from '@/components/user-context';

interface Variant {
  label: string;
  template: string;
}

interface Step {
  action: string;
  template: string;
  delay_hours: number;
  variants?: Variant[];
}

const AVAILABLE_VARS = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'fullName', label: 'Full Name' },
  { key: 'company', label: 'Company' },
  { key: 'title', label: 'Title' },
];

interface Sequence {
  id: number;
  name: string;
  steps: Step[];
  active: number;
  user_id: number;
  owner_name?: string;
  visibility: string;
  shared_with_user_ids: string;
}

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSequence, setEditingSequence] = useState<Sequence | null>(null);
  const [newSequence, setNewSequence] = useState({ name: '', steps: [{ action: 'connection', template: '', delay_hours: 0 }], visibility: 'private', shared_with_user_ids: '' });
  const [teamUsers, setTeamUsers] = useState<Array<{ id: number; name: string }>>([]);
  const { currentUser, isAdmin, apiQuery, viewAs } = useUser();

  useEffect(() => {
    fetchSequences();
    if (isAdmin) {
      fetch('/api/users').then(r => r.json()).then(data => {
        if (Array.isArray(data)) setTeamUsers(data);
      });
    }
  }, [viewAs]);

  const fetchSequences = async () => {
    try {
      const res = await fetch(`/api/sequences${apiQuery}`);
      setSequences(await res.json());
    } finally { setLoading(false); }
  };

  const saveSequence = async () => {
    if (editingSequence) {
      await fetch(`/api/sequences/${editingSequence.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingSequence.name, steps: editingSequence.steps, active: editingSequence.active,
          visibility: editingSequence.visibility, shared_with_user_ids: editingSequence.shared_with_user_ids,
        }),
      });
    } else {
      await fetch(`/api/sequences${apiQuery}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSequence),
      });
      setNewSequence({ name: '', steps: [{ action: 'connection', template: '', delay_hours: 0 }], visibility: 'private', shared_with_user_ids: '' });
    }
    setEditingSequence(null);
    fetchSequences();
  };

  const deleteSequence = async (id: number) => {
    if (!confirm('Delete this sequence?')) return;
    await fetch(`/api/sequences/${id}`, { method: 'DELETE' });
    fetchSequences();
  };

  const addStep = (seq: Sequence | null) => {
    const newStep = { action: 'message', template: '', delay_hours: 72 };
    if (seq) setEditingSequence({ ...seq, steps: [...seq.steps, newStep] });
    else setNewSequence({ ...newSequence, steps: [...newSequence.steps, newStep] });
  };

  const updateStep = (seq: Sequence | null, i: number, field: string, value: any) => {
    if (seq) {
      const steps = [...seq.steps]; steps[i] = { ...steps[i], [field]: value };
      setEditingSequence({ ...seq, steps });
    } else {
      const steps = [...newSequence.steps]; steps[i] = { ...steps[i], [field]: value };
      setNewSequence({ ...newSequence, steps });
    }
  };

  const renderSteps = (steps: Step[], seq: Sequence | null) => (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={i} className="p-4 bg-background/50 rounded-xl border border-border/50 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/15">
              Step {i + 1}
            </span>
            <select
              value={step.action}
              onChange={(e) => updateStep(seq, i, 'action', e.target.value)}
              className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
            >
              <option value="connection">Connection Request</option>
              <option value="message">Message</option>
            </select>
            <div className="ml-auto flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Wait</span>
              <Input
                type="number" value={step.delay_hours}
                onChange={(e) => updateStep(seq, i, 'delay_hours', parseInt(e.target.value))}
                className="w-20 bg-secondary/50 border-border h-8 text-sm text-center"
              />
              <span className="text-muted-foreground">hours</span>
            </div>
          </div>

          {/* Variable chips */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Insert Variable</label>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_VARS.map(v => (
                <button
                  key={v.key}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const tag = `{{${v.key}}}`;
                    const current = step.template || '';
                    updateStep(seq, i, 'template', current + tag);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/15 hover:bg-violet-500/20 transition-colors cursor-pointer"
                >
                  <Tag size={9} />
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message — single or A/B variants */}
          {step.variants && step.variants.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-muted-foreground">A/B Test Variants</label>
                <button
                  type="button"
                  onClick={() => {
                    const variants = [...(step.variants || []), { label: String.fromCharCode(65 + (step.variants?.length || 0)), template: '' }];
                    updateStep(seq, i, 'variants', variants);
                  }}
                  className="text-[10px] text-blue-400 hover:text-blue-300"
                >
                  + Add Variant
                </button>
              </div>
              {step.variants.map((v, vi) => (
                <div key={vi} className="relative">
                  <span className="absolute top-2 left-2 text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">{v.label}</span>
                  <textarea
                    value={v.template}
                    onChange={(e) => {
                      const variants = [...(step.variants || [])];
                      variants[vi] = { ...variants[vi], template: e.target.value };
                      updateStep(seq, i, 'variants', variants);
                    }}
                    rows={3}
                    className="w-full bg-secondary/50 border border-border rounded-lg pl-10 pr-3 py-2 text-sm text-white placeholder:text-muted-foreground/40 focus:outline-none focus:border-blue-500/50 resize-y min-h-[60px]"
                    placeholder={`Variant ${v.label} message...`}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => { updateStep(seq, i, 'variants', undefined); }}
                className="text-[10px] text-muted-foreground hover:text-white"
              >
                Switch to single message
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-medium text-muted-foreground">Message</label>
                <button
                  type="button"
                  onClick={() => {
                    updateStep(seq, i, 'variants', [
                      { label: 'A', template: step.template || '' },
                      { label: 'B', template: '' },
                    ]);
                  }}
                  className="text-[10px] text-blue-400 hover:text-blue-300"
                >
                  Enable A/B Test
                </button>
              </div>
              <textarea
                placeholder={step.action === 'connection'
                  ? "Hi {{firstName}}, I'd love to connect..."
                  : "Hey {{firstName}}, following up on my connection request..."}
                value={step.template}
                onChange={(e) => updateStep(seq, i, 'template', e.target.value)}
                rows={4}
                className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground/40 focus:outline-none focus:border-blue-500/50 resize-y min-h-[80px]"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Variables like {'{{firstName}}'} are replaced with contact data when sent</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const visibilityOptions = [
    { value: 'private', label: 'Private', icon: Lock, desc: 'Only you' },
    { value: 'team', label: 'Shared with Team', icon: Globe, desc: 'Everyone on your team' },
    { value: 'specific', label: 'Specific Users', icon: UsersIcon, desc: 'Choose who can see it' },
  ];

  const renderVisibility = (
    vis: string,
    sharedIds: string,
    onVisChange: (v: string) => void,
    onIdsChange: (ids: string) => void
  ) => (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground block">Sharing</label>
      <div className="flex gap-2">
        {visibilityOptions.map(opt => {
          const Icon = opt.icon;
          const isActive = vis === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onVisChange(opt.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                isActive
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  : 'bg-secondary/50 text-muted-foreground border-border hover:text-white hover:bg-secondary'
              }`}
            >
              <Icon size={12} />
              {opt.label}
            </button>
          );
        })}
      </div>
      {vis === 'specific' && teamUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {teamUsers.filter(u => u.id !== currentUser?.id).map(u => {
            const selected = (',' + sharedIds + ',').includes(',' + u.id + ',');
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  const ids = sharedIds ? sharedIds.split(',').map(s => s.trim()).filter(Boolean) : [];
                  if (selected) {
                    onIdsChange(ids.filter(id => id !== String(u.id)).join(','));
                  } else {
                    onIdsChange([...ids, String(u.id)].join(','));
                  }
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                  selected
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    : 'bg-secondary/50 text-muted-foreground border-border hover:text-white'
                }`}
              >
                {u.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const getVisibilityBadge = (seq: Sequence) => {
    if (seq.visibility === 'team') return { label: 'Team', color: 'text-violet-400 bg-violet-500/10 border-violet-500/15' };
    if (seq.visibility === 'specific') return { label: 'Shared', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/15' };
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Sequences</h1>
          <p className="text-sm text-muted-foreground mt-1">Automated multi-step outreach workflows</p>
        </div>
        <Dialog>
          <DialogTrigger>
            <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-all glow-sm cursor-pointer">
              <Plus size={15} /> New Sequence
            </span>
          </DialogTrigger>
          <DialogContent className="glass border-border/50 text-white sm:rounded-2xl sm:max-w-2xl">
            <DialogHeader><DialogTitle className="text-lg font-semibold">Create Sequence</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <Input placeholder="Sequence name" value={newSequence.name} onChange={(e) => setNewSequence({ ...newSequence, name: e.target.value })} className="bg-background/50 border-border h-10" />
              {renderSteps(newSequence.steps, null)}
              <button onClick={() => addStep(null)} className="w-full py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-white hover:border-border/80 transition-all">
                <Plus size={14} className="inline mr-1" /> Add Step
              </button>
              {renderVisibility(
                newSequence.visibility,
                newSequence.shared_with_user_ids,
                (v) => setNewSequence({ ...newSequence, visibility: v }),
                (ids) => setNewSequence({ ...newSequence, shared_with_user_ids: ids }),
              )}
              <button onClick={saveSequence} className="w-full h-10 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-all">
                Save Sequence
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-secondary rounded-xl animate-pulse" />)}</div>
      ) : sequences.length === 0 ? (
        <div className="py-16 text-center">
          <GitBranch className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground">No sequences yet</p>
        </div>
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
                    <h3 className="text-sm font-medium text-white">{seq.name}</h3>
                    <p className="text-xs text-muted-foreground">{seq.steps.length} steps</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                    seq.active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' : 'bg-secondary text-muted-foreground border border-border/50'
                  }`}>
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
                  <Switch
                    checked={seq.active === 1}
                    onCheckedChange={(v) => {
                      fetch(`/api/sequences/${seq.id}`, {
                        method: 'PUT', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: seq.name, steps: seq.steps, active: v }),
                      }).then(fetchSequences);
                    }}
                  />
                  <button onClick={() => setEditingSequence(seq)} className="p-1.5 rounded-md text-muted-foreground hover:text-white hover:bg-secondary transition-all">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => deleteSequence(seq.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {seq.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-md border ${
                      step.action === 'connection'
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/15'
                        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/15'
                    }`}>
                      {step.action === 'connection' ? 'Connect' : 'Message'}
                    </span>
                    {i < seq.steps.length - 1 && <ArrowRight size={12} className="text-muted-foreground/30" />}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editingSequence && (
        <Dialog open={!!editingSequence} onOpenChange={() => setEditingSequence(null)}>
          <DialogContent className="glass border-border/50 text-white sm:rounded-2xl sm:max-w-2xl">
            <DialogHeader><DialogTitle className="text-lg font-semibold">Edit Sequence</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <Input placeholder="Sequence name" value={editingSequence.name} onChange={(e) => setEditingSequence({ ...editingSequence, name: e.target.value })} className="bg-background/50 border-border h-10" />
              {renderSteps(editingSequence.steps, editingSequence)}
              <button onClick={() => addStep(editingSequence)} className="w-full py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-white hover:border-border/80 transition-all">
                <Plus size={14} className="inline mr-1" /> Add Step
              </button>
              {(editingSequence.user_id === currentUser?.id || isAdmin) && renderVisibility(
                editingSequence.visibility || 'private',
                editingSequence.shared_with_user_ids || '',
                (v) => setEditingSequence({ ...editingSequence, visibility: v }),
                (ids) => setEditingSequence({ ...editingSequence, shared_with_user_ids: ids }),
              )}
              <button onClick={saveSequence} className="w-full h-10 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-all">
                Save Changes
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
