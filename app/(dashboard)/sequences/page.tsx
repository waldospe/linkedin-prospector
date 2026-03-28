'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Plus, Trash2, Edit2, GitBranch } from 'lucide-react';

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

  useEffect(() => {
    fetchSequences();
  }, []);

  const fetchSequences = async () => {
    try {
      const res = await fetch('/api/sequences');
      const data = await res.json();
      setSequences(data);
    } catch (error) {
      console.error('Failed to fetch sequences:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSequence = async () => {
    try {
      if (editingSequence) {
        await fetch(`/api/sequences/${editingSequence.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editingSequence.name, steps: editingSequence.steps, active: editingSequence.active })
        });
      } else {
        await fetch('/api/sequences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSequence)
        });
        setNewSequence({ name: '', steps: [{ action: 'connection', template: '', delay_hours: 0 }] });
      }
      setEditingSequence(null);
      fetchSequences();
    } catch (error) {
      console.error('Failed to save sequence:', error);
    }
  };

  const deleteSequence = async (id: number) => {
    if (!confirm('Delete this sequence?')) return;
    try {
      await fetch(`/api/sequences/${id}`, { method: 'DELETE' });
      fetchSequences();
    } catch (error) {
      console.error('Failed to delete sequence:', error);
    }
  };

  const addStep = (sequence: Sequence | null) => {
    if (sequence) {
      setEditingSequence({
        ...sequence,
        steps: [...sequence.steps, { action: 'message', template: '', delay_hours: 72 }]
      });
    } else {
      setNewSequence({
        ...newSequence,
        steps: [...newSequence.steps, { action: 'message', template: '', delay_hours: 72 }]
      });
    }
  };

  const updateStep = (sequence: Sequence | null, index: number, field: string, value: any) => {
    if (sequence) {
      const newSteps = [...sequence.steps];
      newSteps[index] = { ...newSteps[index], [field]: value };
      setEditingSequence({ ...sequence, steps: newSteps });
    } else {
      const newSteps = [...newSequence.steps];
      newSteps[index] = { ...newSteps[index], [field]: value };
      setNewSequence({ ...newSequence, steps: newSteps });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Sequences</h1>
          <p className="text-zinc-400 mt-1">Create and manage outreach sequences</p>
        </div>
        <Dialog>
          <DialogTrigger>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Create Sequence
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Sequence</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Sequence Name"
                value={newSequence.name}
                onChange={(e) => setNewSequence({ ...newSequence, name: e.target.value })}
                className="bg-zinc-950 border-zinc-800"
              />
              <div className="space-y-3">
                {newSequence.steps.map((step, i) => (
                  <div key={i} className="p-3 bg-zinc-950 rounded border border-zinc-800 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-600">Step {i + 1}</Badge>
                      <select
                        value={step.action}
                        onChange={(e) => updateStep(null, i, 'action', e.target.value)}
                        className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm"
                      >
                        <option value="connection">Connection Request</option>
                        <option value="message">Message</option>
                      </select>
                    </div>
                    <Input
                      placeholder="Message template"
                      value={step.template}
                      onChange={(e) => updateStep(null, i, 'template', e.target.value)}
                      className="bg-zinc-900 border-zinc-800"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-400">Wait:</span>
                      <Input
                        type="number"
                        value={step.delay_hours}
                        onChange={(e) => updateStep(null, i, 'delay_hours', parseInt(e.target.value))}
                        className="w-24 bg-zinc-900 border-zinc-800"
                      />
                      <span className="text-sm text-zinc-400">hours</span>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" onClick={() => addStep(null)} className="w-full">
                <Plus className="w-4 h-4 mr-2" /> Add Step
              </Button>
              <Button onClick={saveSequence} className="w-full bg-blue-600 hover:bg-blue-700">
                Save Sequence
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : (
        <div className="grid gap-4">
          {sequences.map((seq) => (
            <Card key={seq.id} className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GitBranch className="w-5 h-5 text-blue-500" />
                    <CardTitle className="text-white text-lg">{seq.name}</CardTitle>
                    <Badge variant={seq.active ? 'default' : 'secondary'} className={seq.active ? 'bg-blue-600' : ''}>
                      {seq.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={seq.active === 1}
                      onCheckedChange={(v) => {
                        fetch(`/api/sequences/${seq.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: seq.name, steps: seq.steps, active: v })
                        }).then(fetchSequences);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingSequence(seq)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSequence(seq.id)}
                      className="text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {seq.steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Badge variant="outline" className="border-zinc-700">
                        {step.action === 'connection' ? '🔗' : '💬'} {i + 1}
                      </Badge>
                      {i < seq.steps.length - 1 && (
                        <span className="text-zinc-600">→</span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-zinc-500 text-sm mt-2">{seq.steps.length} steps</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      {editingSequence && (
        <Dialog open={!!editingSequence} onOpenChange={() => setEditingSequence(null)}>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Sequence</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Sequence Name"
                value={editingSequence.name}
                onChange={(e) => setEditingSequence({ ...editingSequence, name: e.target.value })}
                className="bg-zinc-950 border-zinc-800"
              />
              <div className="space-y-3">
                {editingSequence.steps.map((step, i) => (
                  <div key={i} className="p-3 bg-zinc-950 rounded border border-zinc-800 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-600">Step {i + 1}</Badge>
                      <select
                        value={step.action}
                        onChange={(e) => updateStep(editingSequence, i, 'action', e.target.value)}
                        className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm"
                      >
                        <option value="connection">Connection Request</option>
                        <option value="message">Message</option>
                      </select>
                    </div>
                    <Input
                      placeholder="Message template"
                      value={step.template}
                      onChange={(e) => updateStep(editingSequence, i, 'template', e.target.value)}
                      className="bg-zinc-900 border-zinc-800"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-400">Wait:</span>
                      <Input
                        type="number"
                        value={step.delay_hours}
                        onChange={(e) => updateStep(editingSequence, i, 'delay_hours', parseInt(e.target.value))}
                        className="w-24 bg-zinc-900 border-zinc-800"
                      />
                      <span className="text-sm text-zinc-400">hours</span>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" onClick={() => addStep(editingSequence)} className="w-full">
                <Plus className="w-4 h-4 mr-2" /> Add Step
              </Button>
              <Button onClick={saveSequence} className="w-full bg-blue-600 hover:bg-blue-700">
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
