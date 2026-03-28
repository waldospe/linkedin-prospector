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
import { Plus, Trash2, Edit2, GitBranch, ArrowRight } from 'lucide-react';

interface Step {
  action: string;
  template: string;
  delay_hours: number;
}

interface Sequence {
  id: number;
  name: string;
  steps: Step[];
  active: number;
}

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSequence, setEditingSequence] = useState<Sequence | null>(null);
  const [newSequence, setNewSequence] = useState({ name: '', steps: [{ action: 'connection', template: '', delay_hours: 0 }] });

  useEffect(() => { fetchSequences(); }, []);

  const fetchSequences = async () => {
    try {
      const res = await fetch('/api/sequences');
      setSequences(await res.json());
    } finally { setLoading(false); }
  };

  const saveSequence = async () => {
    if (editingSequence) {
      await fetch(`/api/sequences/${editingSequence.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingSequence.name, steps: editingSequence.steps, active: editingSequence.active }),
      });
    } else {
      await fetch('/api/sequences', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSequence),
      });
      setNewSequence({ name: '', steps: [{ action: 'connection', template: '', delay_hours: 0 }] });
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

  const StepEditor = ({ steps, seq }: { steps: Step[]; seq: Sequence | null }) => (
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
          </div>
          <Input
            placeholder="Message template"
            value={step.template}
            onChange={(e) => updateStep(seq, i, 'template', e.target.value)}
            className="bg-secondary/50 border-border h-9 text-sm"
          />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Wait</span>
            <Input
              type="number" value={step.delay_hours}
              onChange={(e) => updateStep(seq, i, 'delay_hours', parseInt(e.target.value))}
              className="w-20 bg-secondary/50 border-border h-8 text-sm text-center"
            />
            <span className="text-muted-foreground">hours</span>
          </div>
        </div>
      ))}
    </div>
  );

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
              <StepEditor steps={newSequence.steps} seq={null} />
              <button onClick={() => addStep(null)} className="w-full py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-white hover:border-border/80 transition-all">
                <Plus size={14} className="inline mr-1" /> Add Step
              </button>
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
              <StepEditor steps={editingSequence.steps} seq={editingSequence} />
              <button onClick={() => addStep(editingSequence)} className="w-full py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-white hover:border-border/80 transition-all">
                <Plus size={14} className="inline mr-1" /> Add Step
              </button>
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
