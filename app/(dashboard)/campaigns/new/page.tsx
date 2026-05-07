'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ArrowRight, Rocket, GitBranch, Users, Upload, CheckCircle2, Search } from 'lucide-react';
import { useUser } from '@/components/user-context';

type Step = 'name' | 'sequence' | 'contacts' | 'launch';

export default function NewCampaignPage() {
  const router = useRouter();
  const { apiQuery } = useUser();
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sequenceId, setSequenceId] = useState('');
  const [sequences, setSequences] = useState<Array<{ id: number; name: string; steps: any[] }>>([]);
  const [contactSource, setContactSource] = useState<'existing' | 'csv' | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [launching, setLaunching] = useState(false);
  const [created, setCreated] = useState(false);
  const [campaignId, setCampaignId] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/sequences').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setSequences(data.filter((s: any) => s.active));
    });
  }, []);

  const searchContacts = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const sep = apiQuery.includes('?') ? '&' : '?';
    const res = await fetch(`/api/contacts${apiQuery}${sep}page=1&limit=20&search=${encodeURIComponent(q)}`);
    const data = await res.json();
    setSearchResults(data.rows || []);
  };

  const toggleContact = (id: number) => {
    setSelectedContactIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = async () => {
    const sep = apiQuery.includes('?') ? '&' : '?';
    const res = await fetch(`/api/contacts${apiQuery}${sep}ids_only=1${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`);
    const data = await res.json();
    if (Array.isArray(data.ids)) setSelectedContactIds(data.ids);
  };

  const launch = async () => {
    setLaunching(true);
    try {
      // 1. Create campaign
      const createRes = await fetch(`/api/campaigns${apiQuery}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, sequence_id: sequenceId ? parseInt(sequenceId) : undefined }),
      });
      const { id } = await createRes.json();
      setCampaignId(id);

      // 2. Add contacts
      if (selectedContactIds.length > 0) {
        await fetch(`/api/campaigns/${id}/contacts`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact_ids: selectedContactIds,
            assign_sequence: !!sequenceId,
          }),
        });
      }

      setCreated(true);
      setStep('launch');
    } catch {
      alert('Failed to create campaign');
    } finally {
      setLaunching(false);
    }
  };

  const steps: Array<{ key: Step; label: string }> = [
    { key: 'name', label: 'Name' },
    { key: 'sequence', label: 'Sequence' },
    { key: 'contacts', label: 'Contacts' },
    { key: 'launch', label: 'Launch' },
  ];
  const currentIdx = steps.findIndex(s => s.key === step);

  const selectedSeq = sequences.find(s => String(s.id) === sequenceId);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/campaigns')} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="h-page">New Campaign</h1>
          <p className="t-caption mt-0.5">Set up and launch in under a minute.</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
              i < currentIdx ? 'bg-emerald-500/20 text-emerald-400'
                : i === currentIdx ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30'
                : 'bg-secondary text-muted-foreground'
            }`}>
              {i < currentIdx ? <CheckCircle2 size={14} /> : i + 1}
            </div>
            <span className={`text-xs font-medium ${i === currentIdx ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
            {i < steps.length - 1 && <div className={`flex-1 h-px ${i < currentIdx ? 'bg-emerald-500/40' : 'bg-border'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Name */}
      {step === 'name' && (
        <div className="glass rounded-xl p-6 space-y-4">
          <div>
            <h2 className="h-section">What's this campaign about?</h2>
            <p className="t-caption mt-1">Give it a name you'll recognize later.</p>
          </div>
          <Input placeholder="e.g. AgeTech Founders - May 2026" value={name} onChange={e => setName(e.target.value)} className="bg-background/50 border-border h-11" autoFocus />
          <Input placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} className="bg-background/50 border-border h-10" />
          <div className="flex justify-end">
            <button onClick={() => setStep('sequence')} disabled={!name.trim()} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-40 transition-all">
              Next <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Sequence */}
      {step === 'sequence' && (
        <div className="glass rounded-xl p-6 space-y-4">
          <div>
            <h2 className="h-section">Pick a sequence</h2>
            <p className="t-caption mt-1">This defines the connection request + follow-up messages each contact receives.</p>
          </div>
          {sequences.length === 0 ? (
            <div className="py-8 text-center">
              <GitBranch className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">No sequences yet</p>
              <button onClick={() => router.push('/sequences/new')} className="text-sm text-blue-400 hover:text-blue-300 font-medium">
                Create a sequence first
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {sequences.map(s => (
                <button key={s.id} onClick={() => setSequenceId(String(s.id))} className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                  sequenceId === String(s.id) ? 'bg-blue-500/[0.06] border-blue-500/30' : 'bg-secondary/20 border-border/50 hover:border-border'
                }`}>
                  <GitBranch size={16} className={sequenceId === String(s.id) ? 'text-blue-400' : 'text-muted-foreground'} />
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${sequenceId === String(s.id) ? 'text-foreground' : 'text-muted-foreground'}`}>{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.steps?.length || 0} steps</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 ${sequenceId === String(s.id) ? 'border-blue-500 bg-blue-500' : 'border-border'}`} />
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-between">
            <button onClick={() => setStep('name')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Back</button>
            <button onClick={() => setStep('contacts')} disabled={!sequenceId} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-40 transition-all">
              Next <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Contacts */}
      {step === 'contacts' && (
        <div className="glass rounded-xl p-6 space-y-4">
          <div>
            <h2 className="h-section">Add contacts</h2>
            <p className="t-caption mt-1">Search your existing contacts or select all. You can also import more from the contacts page later.</p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              placeholder="Search contacts by name, company..."
              value={searchQuery}
              onChange={e => searchContacts(e.target.value)}
              className="w-full h-10 rounded-lg border border-border bg-background/50 text-foreground pl-10 pr-4 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div className="flex items-center gap-3">
            <button onClick={selectAll} className="text-xs text-blue-400 hover:text-blue-300 font-medium">
              Select all {searchQuery ? 'matching' : ''} contacts
            </button>
            {selectedContactIds.length > 0 && (
              <span className="text-xs text-foreground font-medium bg-blue-500/10 px-2 py-1 rounded">{selectedContactIds.length} selected</span>
            )}
            {selectedContactIds.length > 0 && (
              <button onClick={() => setSelectedContactIds([])} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="max-h-[300px] overflow-y-auto space-y-1 border border-border/50 rounded-xl p-2">
              {searchResults.map((c: any) => {
                const selected = selectedContactIds.includes(c.id);
                return (
                  <button key={c.id} onClick={() => toggleContact(c.id)} className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all ${selected ? 'bg-blue-500/10 border border-blue-500/20' : 'hover:bg-secondary/50'}`}>
                    <input type="checkbox" checked={selected} readOnly className="w-4 h-4 rounded accent-blue-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{[c.first_name, c.last_name].filter(Boolean).join(' ') || c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.title}{c.title && c.company ? ' at ' : ''}{c.company}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep('sequence')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Back</button>
            <button onClick={launch} disabled={selectedContactIds.length === 0 || launching} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-40 transition-all glow-sm">
              <Rocket size={14} /> {launching ? 'Launching...' : `Launch with ${selectedContactIds.length} contacts`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 'launch' && created && (
        <div className="glass rounded-xl p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto">
            <Rocket size={28} className="text-emerald-400" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Campaign launched!</h2>
          <p className="t-meta max-w-sm mx-auto">
            <strong>{name}</strong> is live with {selectedContactIds.length} contacts using <strong>{selectedSeq?.name}</strong>.
            Connection requests will start sending during your next send window.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button onClick={() => router.push(`/campaigns/${campaignId}`)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-all">
              View Campaign <ArrowRight size={14} />
            </button>
            <button onClick={() => router.push('/campaigns')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              All campaigns
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
