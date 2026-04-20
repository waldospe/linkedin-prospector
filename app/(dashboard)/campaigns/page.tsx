'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Megaphone, GitBranch, Users, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useUser } from '@/components/user-context';
import { EmptyState } from '@/components/empty-state';

interface Campaign {
  id: number;
  name: string;
  description: string;
  sequence_name: string;
  contact_count: number;
  status: string;
  created_at: string;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sequences, setSequences] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSeqId, setNewSeqId] = useState('');
  const { apiQuery } = useUser();

  useEffect(() => {
    Promise.all([
      fetch(`/api/campaigns${apiQuery}`).then(r => r.json()),
      fetch('/api/sequences').then(r => r.json()),
    ]).then(([c, s]) => {
      if (Array.isArray(c)) setCampaigns(c);
      if (Array.isArray(s)) setSequences(s.filter((x: any) => x.active));
    }).finally(() => setLoading(false));
  }, [apiQuery]);

  const createCampaign = async () => {
    if (!newName.trim()) return;
    await fetch(`/api/campaigns${apiQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), description: newDesc, sequence_id: newSeqId ? parseInt(newSeqId) : undefined }),
    });
    setNewName(''); setNewDesc(''); setNewSeqId('');
    const res = await fetch(`/api/campaigns${apiQuery}`);
    setCampaigns(await res.json());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="h-page">Campaigns</h1>
          <p className="t-meta mt-1">Track outreach campaigns from launch to results</p>
        </div>
        <Dialog>
          <DialogTrigger>
            <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-all glow-sm cursor-pointer">
              <Plus size={15} /> New Campaign
            </span>
          </DialogTrigger>
          <DialogContent className="glass border-border/50 text-foreground sm:rounded-2xl">
            <DialogHeader><DialogTitle>Create Campaign</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <Input placeholder="Campaign name" value={newName} onChange={e => setNewName(e.target.value)} className="bg-background/50 border-border h-10" />
              <Input placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="bg-background/50 border-border h-10" />
              {sequences.length > 0 && (
                <select value={newSeqId} onChange={e => setNewSeqId(e.target.value)} className="w-full h-10 bg-background/50 text-foreground text-sm rounded-lg px-3 border border-border">
                  <option value="">No sequence (assign later)</option>
                  {sequences.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              <button onClick={createCampaign} className="w-full h-10 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-all">Create Campaign</button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-secondary rounded-xl animate-pulse" />)}</div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Create a campaign to group contacts with a sequence and track results in one place."
        />
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <Link key={c.id} href={`/campaigns/${c.id}`} className="block glass glass-hover rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/15 flex items-center justify-center">
                    <Megaphone size={15} className="text-violet-400" />
                  </div>
                  <div>
                    <h3 className="h-card">{c.name}</h3>
                    {c.description && <p className="t-caption mt-0.5">{c.description}</p>}
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                    c.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' : 'bg-secondary text-muted-foreground border-border/50'
                  }`}>
                    {c.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 t-caption">
                  {c.sequence_name && (
                    <span className="flex items-center gap-1">
                      <GitBranch size={11} /> {c.sequence_name}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Users size={11} /> {c.contact_count}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
