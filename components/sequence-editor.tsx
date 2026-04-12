'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Plus, Tag, Lock, Globe, Users as UsersIcon, ArrowLeft, Save, Trash2, MoveUp, MoveDown } from 'lucide-react';
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

export interface SequenceFormValue {
  id?: number;
  name: string;
  steps: Step[];
  visibility: string;
  shared_with_user_ids: string;
  user_id?: number;
}

const AVAILABLE_VARS = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'fullName', label: 'Full Name' },
  { key: 'company', label: 'Company' },
  { key: 'title', label: 'Title' },
];

const visibilityOptions = [
  { value: 'private', label: 'Private', icon: Lock, desc: 'Only you can see and use this sequence' },
  { value: 'team', label: 'Team', icon: Globe, desc: 'Everyone on your team can see and use it' },
  { value: 'specific', label: 'Specific Users', icon: UsersIcon, desc: 'Pick exactly who can see it' },
];

interface Props {
  initial: SequenceFormValue;
  mode: 'new' | 'edit';
  teamUsers?: Array<{ id: number; name: string }>;
}

export default function SequenceEditor({ initial, mode, teamUsers = [] }: Props) {
  const router = useRouter();
  const { apiQuery, currentUser, isAdmin } = useUser();
  const [seq, setSeq] = useState<SequenceFormValue>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateStep = (i: number, field: string, value: any) => {
    const steps = [...seq.steps];
    steps[i] = { ...steps[i], [field]: value };
    setSeq({ ...seq, steps });
  };

  const addStep = () => {
    setSeq({ ...seq, steps: [...seq.steps, { action: 'message', template: '', delay_hours: 72 }] });
  };

  const removeStep = (i: number) => {
    if (seq.steps.length === 1) return;
    setSeq({ ...seq, steps: seq.steps.filter((_, idx) => idx !== i) });
  };

  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= seq.steps.length) return;
    const steps = [...seq.steps];
    [steps[i], steps[j]] = [steps[j], steps[i]];
    setSeq({ ...seq, steps });
  };

  const save = async () => {
    if (!seq.name.trim()) { setError('Please give your sequence a name'); return; }
    setError('');
    setSaving(true);
    try {
      if (mode === 'edit' && seq.id) {
        await fetch(`/api/sequences/${seq.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: seq.name,
            steps: seq.steps,
            visibility: seq.visibility,
            shared_with_user_ids: seq.shared_with_user_ids,
          }),
        });
      } else {
        await fetch(`/api/sequences${apiQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: seq.name,
            steps: seq.steps,
            visibility: seq.visibility,
            shared_with_user_ids: seq.shared_with_user_ids,
          }),
        });
      }
      router.push('/sequences');
    } catch {
      setError('Failed to save sequence');
    } finally {
      setSaving(false);
    }
  };

  const canEditVisibility = mode === 'new' || seq.user_id === currentUser?.id || isAdmin;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/sequences')} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="h-page">{mode === 'new' ? 'New Sequence' : 'Edit Sequence'}</h1>
            <p className="t-caption mt-0.5">Build your outreach steps and decide who can use them.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/sequences')} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
            Cancel
          </button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-40 transition-all glow-sm">
            <Save size={14} /> {saving ? 'Saving…' : mode === 'new' ? 'Create Sequence' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Section 1: Name */}
      <section className="glass rounded-xl p-6 space-y-4">
        <div>
          <h2 className="h-section">Sequence name</h2>
          <p className="t-caption mt-1">Give it a name your team will recognize at a glance.</p>
        </div>
        <Input
          placeholder="e.g. Founders – Series A Outreach"
          value={seq.name}
          onChange={(e) => setSeq({ ...seq, name: e.target.value })}
          className="bg-background/50 border-border h-11 max-w-md"
        />
      </section>

      {/* Section 2: Steps */}
      <section className="glass rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="h-section">Steps</h2>
            <p className="t-caption mt-1">First step usually a connection request, then one or more follow-up messages.</p>
          </div>
          <button onClick={addStep} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-sm text-foreground hover:bg-secondary/80 transition-all">
            <Plus size={13} /> Add step
          </button>
        </div>

        <div className="space-y-3">
          {seq.steps.map((step, i) => (
            <div key={i} className="p-4 bg-background/40 rounded-xl border border-border/50 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/15">
                  Step {i + 1}
                </span>
                <select
                  value={step.action}
                  onChange={(e) => updateStep(i, 'action', e.target.value)}
                  className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-blue-500/50"
                >
                  <option value="connection">Connection request</option>
                  <option value="message">Message</option>
                </select>
                <div className="ml-auto flex items-center gap-2 t-caption">
                  <span>Wait</span>
                  <Input
                    type="number"
                    value={step.delay_hours}
                    onChange={(e) => updateStep(i, 'delay_hours', parseInt(e.target.value) || 0)}
                    className="w-16 bg-secondary/50 border-border h-8 text-sm text-center"
                  />
                  <span>hours</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => moveStep(i, -1)} disabled={i === 0} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 transition-all" title="Move up">
                    <MoveUp size={13} />
                  </button>
                  <button onClick={() => moveStep(i, 1)} disabled={i === seq.steps.length - 1} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 transition-all" title="Move down">
                    <MoveDown size={13} />
                  </button>
                  <button onClick={() => removeStep(i)} disabled={seq.steps.length === 1} className="p-1 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 transition-all" title="Remove step">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Variable chips */}
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_VARS.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      const tag = `{{${v.key}}}`;
                      updateStep(i, 'template', (step.template || '') + tag);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/15 hover:bg-violet-500/20 transition-colors"
                  >
                    <Tag size={9} />
                    {v.label}
                  </button>
                ))}
              </div>

              {/* Message body — single or A/B */}
              {step.variants && step.variants.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="t-caption font-medium">A/B Test Variants</label>
                    <button
                      type="button"
                      onClick={() => {
                        const variants = [...(step.variants || []), { label: String.fromCharCode(65 + (step.variants?.length || 0)), template: '' }];
                        updateStep(i, 'variants', variants);
                      }}
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-medium"
                    >
                      + Add variant
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
                          updateStep(i, 'variants', variants);
                        }}
                        rows={3}
                        className="w-full bg-secondary/50 border border-border rounded-lg pl-10 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-blue-500/50 resize-y min-h-[80px]"
                        placeholder={`Variant ${v.label} message…`}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => updateStep(i, 'variants', undefined)}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Switch to single message
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="t-caption font-medium">Message</label>
                    <button
                      type="button"
                      onClick={() => {
                        updateStep(i, 'variants', [
                          { label: 'A', template: step.template || '' },
                          { label: 'B', template: '' },
                        ]);
                      }}
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-medium"
                    >
                      Enable A/B test
                    </button>
                  </div>
                  <textarea
                    placeholder={step.action === 'connection'
                      ? "Hi {{firstName}}, I'd love to connect…"
                      : "Hey {{firstName}}, following up on my connection request…"}
                    value={step.template}
                    onChange={(e) => updateStep(i, 'template', e.target.value)}
                    rows={4}
                    className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-blue-500/50 resize-y min-h-[100px]"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Variables like <code className="px-1 rounded bg-secondary/60">{'{{firstName}}'}</code> are replaced with contact data when sent.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: Sharing */}
      {canEditVisibility && (
        <section className="glass rounded-xl p-6 space-y-4">
          <div>
            <h2 className="h-section">Sharing</h2>
            <p className="t-caption mt-1">Choose who else on your team can use this sequence.</p>
          </div>
          <div className="space-y-2">
            {visibilityOptions.map((opt) => {
              const Icon = opt.icon;
              const isActive = seq.visibility === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSeq({ ...seq, visibility: opt.value })}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    isActive
                      ? 'bg-blue-500/[0.08] border-blue-500/30'
                      : 'bg-secondary/30 border-border hover:border-border/80'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-blue-500/15 text-blue-400' : 'bg-secondary text-muted-foreground'}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{opt.label}</p>
                    <p className="t-caption">{opt.desc}</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 ${isActive ? 'border-blue-500 bg-blue-500' : 'border-border'}`} />
                </button>
              );
            })}
          </div>
          {seq.visibility === 'specific' && teamUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {teamUsers.filter((u) => u.id !== currentUser?.id).map((u) => {
                const selected = (',' + seq.shared_with_user_ids + ',').includes(',' + u.id + ',');
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      const ids = seq.shared_with_user_ids ? seq.shared_with_user_ids.split(',').map((s) => s.trim()).filter(Boolean) : [];
                      if (selected) {
                        setSeq({ ...seq, shared_with_user_ids: ids.filter((id) => id !== String(u.id)).join(',') });
                      } else {
                        setSeq({ ...seq, shared_with_user_ids: [...ids, String(u.id)].join(',') });
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                      selected
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                        : 'bg-secondary/50 text-muted-foreground border-border hover:text-foreground'
                    }`}
                  >
                    {u.name}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Bottom save bar */}
      <div className="flex items-center justify-end gap-2 pt-2 pb-8">
        <button onClick={() => router.push('/sequences')} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
          Cancel
        </button>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-40 transition-all glow-sm">
          <Save size={14} /> {saving ? 'Saving…' : mode === 'new' ? 'Create Sequence' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
