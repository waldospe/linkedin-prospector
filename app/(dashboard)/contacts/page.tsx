'use client';

import { useEffect, useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Upload, ExternalLink, Search, Users, FileSpreadsheet, Link2, CheckCircle2, AlertCircle, ArrowRight, Filter, GitBranch, AlertTriangle } from 'lucide-react';
import { FUNNEL_STAGES, stageColors, STAGE_MAP } from '@/lib/constants';
import { useUser } from '@/components/user-context';

interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  name: string;
  linkedin_url: string;
  company: string;
  title: string;
  source: string;
  status: string;
}

const getStatusDisplay = (status: string) => {
  const stage = STAGE_MAP[status];
  const colors = stageColors[status] || stageColors.new;
  return { label: stage?.label || status, dot: colors.dot, bg: `${colors.bg} ${colors.text}` };
};

type ImportStep = 'choose' | 'csv-upload' | 'sheets-url' | 'mapping' | 'importing' | 'done';

interface ImportState {
  step: ImportStep;
  headers: string[];
  rows: any[];
  mapping: Record<string, string>;
  suggestions: Record<string, string | null>;
  fieldLabels: Record<string, string>;
  validFields: string[];
  result: { imported: number; total: number } | null;
  error: string;
  sequenceId: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkSequenceId, setBulkSequenceId] = useState('');
  const [newContact, setNewContact] = useState({ first_name: '', last_name: '', linkedin_url: '', company: '', title: '', sequence_id: '' });
  const [sequencesList, setSequencesList] = useState<Array<{ id: number; name: string }>>([]);
  const [importing, setImporting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importState, setImportState] = useState<ImportState>({
    step: 'choose', headers: [], rows: [], mapping: {}, suggestions: {},
    fieldLabels: {}, validFields: [], result: null, error: '', sequenceId: '',
  });
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { apiQuery, viewAs, isViewingAll } = useUser();

  useEffect(() => {
    fetchContacts();
    fetch('/api/sequences').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setSequencesList(data.filter((s: any) => s.active));
    });
  }, [viewAs]);

  const fetchContacts = async () => {
    try {
      const res = await fetch(`/api/contacts${apiQuery}`);
      setContacts(await res.json());
    } finally { setLoading(false); }
  };

  const lookupLinkedIn = async (urlInput: string) => {
    const url = urlInput?.trim();
    if (!url || lookingUp) return;
    setLookingUp(true);
    setLookupError('');
    try {
      const res = await fetch('/api/contacts/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedin_url: url }),
      });
      const data = await res.json();
      if (res.ok && (data.first_name || data.last_name || data.name || data.company || data.title)) {
        setNewContact(prev => ({
          ...prev,
          first_name: data.first_name || prev.first_name,
          last_name: data.last_name || prev.last_name,
          company: data.company || prev.company,
          title: data.title || prev.title,
          linkedin_url: data.linkedin_url || url,
        }));
      } else if (!res.ok) {
        setLookupError(data.error || 'Lookup failed');
      } else {
        setLookupError('No profile data returned. You can fill in the fields manually.');
      }
    } catch (err: any) {
      setLookupError('Failed to look up profile: ' + (err.message || ''));
    } finally {
      setLookingUp(false);
    }
  };

  const addContact = async () => {
    if (!newContact.first_name && !newContact.last_name && !newContact.linkedin_url) return;
    const payload: any = { ...newContact };
    if (payload.sequence_id) payload.sequence_id = parseInt(payload.sequence_id);
    else delete payload.sequence_id;
    await fetch(`/api/contacts${apiQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setNewContact({ first_name: '', last_name: '', linkedin_url: '', company: '', title: '', sequence_id: '' });
    fetchContacts();
  };

  const deleteContact = async (id: number) => {
    if (!confirm('Delete this contact?')) return;
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    fetchContacts();
  };

  const updateStatus = async (id: number, status: string) => {
    await fetch(`/api/contacts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchContacts();
  };

  const assignSequence = async (contactId: number, sequenceId: number) => {
    await fetch(`/api/contacts/${contactId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence_id: sequenceId }),
    });
    fetchContacts();
  };

  const bulkAssignSequence = async () => {
    if (!bulkSequenceId || selectedIds.size === 0) return;
    const seqId = parseInt(bulkSequenceId);
    await Promise.all(
      Array.from(selectedIds).map(id =>
        fetch(`/api/contacts/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sequence_id: seqId }),
        })
      )
    );
    setSelectedIds(new Set());
    setBulkSequenceId('');
    fetchContacts();
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    await fetch(`/api/contacts/bulk-delete${apiQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    });
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
    fetchContacts();
  };

  const importFromPipedrive = async () => {
    setImporting(true);
    try {
      const res = await fetch('/api/pipedrive/sync', { method: 'POST' });
      const data = await res.json();
      if (data.error) alert(data.error);
      else alert(`Imported ${data.imported} contacts from Pipedrive`);
      fetchContacts();
    } finally { setImporting(false); }
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCsvFull(text);
      if (headers.length === 0 || rows.length === 0) {
        setImportState(s => ({ ...s, error: 'CSV file is empty or has no data rows' }));
        return;
      }
      await validateHeaders(headers, rows);
    };
    reader.readAsText(file);
  };

  const handleSheetsImport = async () => {
    if (!sheetsUrl) return;
    setImportState(s => ({ ...s, error: '' }));
    try {
      const res = await fetch(`/api/contacts/import/sheets${apiQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sheetsUrl }),
      });
      const data = await res.json();
      if (data.error) {
        setImportState(s => ({ ...s, error: data.error }));
        return;
      }
      await validateHeaders(data.headers, data.rows);
    } catch {
      setImportState(s => ({ ...s, error: 'Failed to fetch sheet' }));
    }
  };

  const validateHeaders = async (headers: string[], rows: any[]) => {
    const res = await fetch(`/api/contacts/import${apiQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headers }),
    });
    const data = await res.json();
    const mapping: Record<string, string> = {};
    for (const [header, suggested] of Object.entries(data.suggestions)) {
      if (suggested) mapping[header] = suggested as string;
    }
    setImportState(s => ({
      ...s, step: 'mapping', headers, rows,
      mapping, suggestions: data.suggestions,
      fieldLabels: data.fieldLabels, validFields: data.validFields, error: '',
    }));
  };

  const executeImport = async () => {
    setImportState(s => ({ ...s, step: 'importing' }));
    try {
      const allRows = importState.rows;
      const CHUNK_SIZE = 200;
      let totalImported = 0;
      let totalInvalid = 0;
      let totalDuplicates = 0;
      let totalSequenced = 0;
      const errors: string[] = [];

      // Send in chunks of 200 rows to avoid body size limits
      for (let i = 0; i < allRows.length; i += CHUNK_SIZE) {
        const chunk = allRows.slice(i, i + CHUNK_SIZE);
        const isLastChunk = i + CHUNK_SIZE >= allRows.length;

        const res = await fetch(`/api/contacts/import${apiQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: chunk,
            mapping: importState.mapping,
            sequence_id: importState.sequenceId ? parseInt(importState.sequenceId) : undefined,
          }),
        });

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          errors.push(`Chunk ${Math.floor(i / CHUNK_SIZE) + 1} failed (${res.status})`);
          continue;
        }

        const data = await res.json();
        if (data.error) {
          errors.push(data.error);
        } else {
          totalImported += data.imported || 0;
          totalInvalid += data.invalidUrls || 0;
          totalDuplicates += data.duplicates || 0;
          totalSequenced += data.sequenced || 0;
        }
      }

      if (errors.length > 0 && totalImported === 0) {
        setImportState(s => ({ ...s, step: 'mapping', error: errors.join('. ') }));
      } else {
        setImportState(s => ({
          ...s, step: 'done',
          result: { imported: totalImported, total: allRows.length, duplicates: totalDuplicates, invalidUrls: totalInvalid } as any,
        }));
        fetchContacts();
      }
    } catch (err: any) {
      setImportState(s => ({ ...s, step: 'mapping', error: 'Import failed: ' + (err.message || 'Unknown error') }));
    }
  };

  const resetImport = () => {
    setImportState({
      step: 'choose', headers: [], rows: [], mapping: {}, suggestions: {},
      fieldLabels: {}, validFields: [], result: null, error: '', sequenceId: '',
    });
    setSheetsUrl('');
  };

  // Filtering
  const sources = useMemo(() => Array.from(new Set(contacts.map(c => c.source).filter(Boolean))), [contacts]);

  const filtered = useMemo(() => {
    return contacts.filter(c => {
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      if (filterSource !== 'all' && c.source !== filterSource) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(c.name?.toLowerCase().includes(q) || c.first_name?.toLowerCase().includes(q) ||
              c.last_name?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q) ||
              c.title?.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [contacts, filterStatus, filterSource, search]);

  const displayName = (c: Contact) => {
    if (c.first_name || c.last_name) return [c.first_name, c.last_name].filter(Boolean).join(' ');
    return c.name;
  };

  const mappedFieldCount = Object.values(importState.mapping).filter(Boolean).length;
  const hasNameMapping = importState.mapping && (
    Object.values(importState.mapping).includes('first_name') ||
    Object.values(importState.mapping).includes('last_name') ||
    Object.values(importState.mapping).includes('name')
  );

  const allFilteredSelected = filtered.length > 0 && filtered.every(c => selectedIds.has(c.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">{contacts.length} prospects in your pipeline</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { resetImport(); setShowImport(true); }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-white hover:border-border/80 hover:bg-secondary/50 transition-all"
          >
            <Upload size={15} />
            Import
          </button>
          <Dialog>
            <DialogTrigger>
              <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-all glow-sm cursor-pointer">
                <Plus size={15} />
                Add Contact
              </span>
            </DialogTrigger>
            <DialogContent className="glass border-border/50 text-white sm:rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">Add Contact</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">LinkedIn URL</label>
                  <div className="flex gap-2">
                    <Input placeholder="https://linkedin.com/in/..." value={newContact.linkedin_url} onChange={(e) => setNewContact({ ...newContact, linkedin_url: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookupLinkedIn(newContact.linkedin_url); } }} className="bg-background/50 border-border h-10 flex-1" />
                    <button onClick={() => lookupLinkedIn(newContact.linkedin_url)} disabled={lookingUp || !newContact.linkedin_url} className="px-3 h-10 rounded-lg bg-secondary border border-border text-xs font-medium text-muted-foreground hover:text-white hover:bg-accent disabled:opacity-40 transition-all shrink-0">
                      {lookingUp ? <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-white rounded-full animate-spin" /> : 'Lookup'}
                    </button>
                  </div>
                  {lookupError && <p className="text-xs text-red-400 mt-1">{lookupError}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1">Paste a LinkedIn URL and click Lookup to auto-fill</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="First name" value={newContact.first_name} onChange={(e) => setNewContact({ ...newContact, first_name: e.target.value })} className="bg-background/50 border-border h-10" />
                  <Input placeholder="Last name" value={newContact.last_name} onChange={(e) => setNewContact({ ...newContact, last_name: e.target.value })} className="bg-background/50 border-border h-10" />
                </div>
                <Input placeholder="Company" value={newContact.company} onChange={(e) => setNewContact({ ...newContact, company: e.target.value })} className="bg-background/50 border-border h-10" />
                <Input placeholder="Title" value={newContact.title} onChange={(e) => setNewContact({ ...newContact, title: e.target.value })} className="bg-background/50 border-border h-10" />
                {sequencesList.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Add to Sequence (optional)</label>
                    <select value={newContact.sequence_id} onChange={(e) => setNewContact({ ...newContact, sequence_id: e.target.value })} className="w-full h-10 bg-background/50 text-white text-sm rounded-lg px-3 border border-border focus:outline-none focus:border-blue-500/50">
                      <option value="">None</option>
                      {sequencesList.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                    </select>
                  </div>
                )}
                <button onClick={addContact} className="w-full h-10 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-all">Add Contact</button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input placeholder="Search contacts..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-9 rounded-lg border border-border bg-card/50 text-white pl-10 pr-4 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500/50 transition-all" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-9 bg-card/50 text-white text-xs rounded-lg px-3 border border-border focus:outline-none focus:border-blue-500/50">
          <option value="all">All Stages</option>
          {FUNNEL_STAGES.map(s => (<option key={s.key} value={s.key}>{s.label}</option>))}
        </select>
        {sources.length > 1 && (
          <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="h-9 bg-card/50 text-white text-xs rounded-lg px-3 border border-border focus:outline-none focus:border-blue-500/50">
            <option value="all">All Sources</option>
            {sources.map(s => (<option key={s} value={s}>{s}</option>))}
          </select>
        )}
        {(filterStatus !== 'all' || filterSource !== 'all') && (
          <button onClick={() => { setFilterStatus('all'); setFilterSource('all'); }} className="text-xs text-muted-foreground hover:text-white transition-colors">
            Clear
          </button>
        )}
        <span className="text-xs text-muted-foreground">{filtered.length} shown</span>
      </div>

      {/* Bulk actions bar */}
      {someSelected && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/15 animate-fade-in">
          <span className="text-sm text-blue-400 font-medium">{selectedIds.size} selected</span>
          <div className="h-4 w-px bg-border" />
          {sequencesList.length > 0 && (
            <div className="flex items-center gap-2">
              <GitBranch size={14} className="text-muted-foreground" />
              <select value={bulkSequenceId} onChange={(e) => setBulkSequenceId(e.target.value)} className="h-8 bg-background/50 text-white text-xs rounded-lg px-2 border border-border focus:outline-none focus:border-blue-500/50">
                <option value="">Select sequence...</option>
                {sequencesList.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
              <button onClick={bulkAssignSequence} disabled={!bulkSequenceId} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 disabled:opacity-40 transition-all">
                Add to Sequence
              </button>
            </div>
          )}
          <div className="h-4 w-px bg-border" />
          <button onClick={() => setShowDeleteConfirm(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/10 transition-all">
            <Trash2 size={12} />
            Delete
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-white transition-colors">
            Deselect all
          </button>
        </div>
      )}

      {/* Contact list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-secondary rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Users className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground">{search || filterStatus !== 'all' ? 'No contacts match your filters' : 'No contacts yet'}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Select all header */}
          <div className="flex items-center gap-3 px-4 py-1.5">
            <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} className="w-4 h-4 rounded border-border bg-background accent-blue-600 cursor-pointer" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Select all</span>
          </div>
          {filtered.map((contact) => {
            const cfg = getStatusDisplay(contact.status);
            const isSelected = selectedIds.has(contact.id);
            return (
              <div key={contact.id} className={`glass rounded-xl p-3.5 flex items-center gap-3 transition-all ${isSelected ? 'border-blue-500/30 bg-blue-500/5' : 'glass-hover'}`}>
                <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(contact.id)} className="w-4 h-4 rounded border-border bg-background accent-blue-600 cursor-pointer shrink-0" />
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/10 flex items-center justify-center text-xs font-semibold text-blue-300 shrink-0">
                  {(contact.first_name || contact.name || '?').charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">{displayName(contact)}</p>
                    {contact.linkedin_url && (
                      <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 shrink-0"><ExternalLink size={11} /></a>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {contact.title}{contact.title && contact.company ? ' at ' : ''}{contact.company}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md ${cfg.bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                  {sequencesList.length > 0 && !['queued', 'opted_out'].includes(contact.status) && (
                    <select defaultValue="" onChange={(e) => { if (e.target.value) assignSequence(contact.id, parseInt(e.target.value)); }} className="h-7 bg-secondary/50 text-white text-[11px] rounded-lg px-1.5 border border-border focus:outline-none focus:border-blue-500/50 cursor-pointer">
                      <option value="">+ Seq</option>
                      {sequencesList.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                    </select>
                  )}
                  <Select value={contact.status} onValueChange={(v) => { if (v) updateStatus(contact.id, v); }}>
                    <SelectTrigger className="w-32 h-7 bg-secondary/50 border-border text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FUNNEL_STAGES.map(s => (<SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <button onClick={() => deleteContact(contact.id)} className="p-1 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="glass border-border/50 text-white sm:rounded-2xl sm:max-w-sm">
          <div className="text-center py-2">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={24} className="text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Delete {selectedIds.size} contacts?</h3>
            <p className="text-sm text-muted-foreground mt-2">
              This will permanently delete the selected contacts and remove them from any active sequences. This cannot be undone.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 h-10 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-white hover:bg-secondary transition-all"
              >
                Cancel
              </button>
              <button
                onClick={bulkDelete}
                className="flex-1 h-10 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-all"
              >
                Delete {selectedIds.size} Contacts
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={(open) => { if (!open) { setShowImport(false); resetImport(); } }}>
        <DialogContent className="glass border-border/50 text-white sm:rounded-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {importState.step === 'choose' && 'Import Contacts'}
              {importState.step === 'csv-upload' && 'Upload CSV'}
              {importState.step === 'sheets-url' && 'Google Sheets'}
              {importState.step === 'mapping' && 'Map Columns'}
              {importState.step === 'importing' && 'Importing...'}
              {importState.step === 'done' && 'Import Complete'}
            </DialogTitle>
          </DialogHeader>

          {importState.error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle size={14} className="text-red-400 shrink-0" />
              <p className="text-red-400 text-sm">{importState.error}</p>
            </div>
          )}

          {importState.step === 'choose' && (
            <div className="space-y-3 mt-2">
              <button onClick={() => setImportState(s => ({ ...s, step: 'csv-upload' }))} className="w-full flex items-center gap-4 p-4 rounded-xl bg-secondary/50 border border-border hover:bg-secondary hover:border-border/80 transition-all text-left">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center shrink-0"><FileSpreadsheet size={18} className="text-emerald-400" /></div>
                <div><p className="text-sm font-medium text-white">CSV File</p><p className="text-xs text-muted-foreground mt-0.5">Upload a .csv file</p></div>
              </button>
              <button onClick={() => setImportState(s => ({ ...s, step: 'sheets-url' }))} className="w-full flex items-center gap-4 p-4 rounded-xl bg-secondary/50 border border-border hover:bg-secondary hover:border-border/80 transition-all text-left">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/15 flex items-center justify-center shrink-0"><Link2 size={18} className="text-blue-400" /></div>
                <div><p className="text-sm font-medium text-white">Google Sheets</p><p className="text-xs text-muted-foreground mt-0.5">Paste a public link</p></div>
              </button>
              <button onClick={importFromPipedrive} disabled={importing} className="w-full flex items-center gap-4 p-4 rounded-xl bg-secondary/50 border border-border hover:bg-secondary hover:border-border/80 transition-all text-left disabled:opacity-50">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/15 flex items-center justify-center shrink-0"><Upload size={18} className="text-violet-400" /></div>
                <div><p className="text-sm font-medium text-white">{importing ? 'Importing...' : 'Pipedrive'}</p><p className="text-xs text-muted-foreground mt-0.5">Sync from CRM</p></div>
              </button>
            </div>
          )}

          {importState.step === 'csv-upload' && (
            <div className="space-y-4 mt-2">
              <label className="block w-full cursor-pointer">
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-blue-500/30 transition-all">
                  <FileSpreadsheet className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-white font-medium">Click to select a CSV file</p>
                </div>
                <input type="file" accept=".csv" onChange={handleCsvFile} className="hidden" />
              </label>
              <button onClick={() => setImportState(s => ({ ...s, step: 'choose' }))} className="text-sm text-muted-foreground hover:text-white transition-colors">Back</button>
            </div>
          )}

          {importState.step === 'sheets-url' && (
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Google Sheets URL</label>
                <Input placeholder="https://docs.google.com/spreadsheets/d/..." value={sheetsUrl} onChange={(e) => setSheetsUrl(e.target.value)} className="bg-background/50 border-border h-10" />
                <p className="text-xs text-muted-foreground mt-1.5">Sheet must be publicly accessible</p>
              </div>
              <button onClick={handleSheetsImport} disabled={!sheetsUrl} className="w-full h-10 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-40 transition-all">Fetch Sheet</button>
              <button onClick={() => setImportState(s => ({ ...s, step: 'choose', error: '' }))} className="text-sm text-muted-foreground hover:text-white transition-colors">Back</button>
            </div>
          )}

          {importState.step === 'mapping' && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                <span className="text-white font-medium">{importState.rows.length}</span> rows, <span className="text-white font-medium">{importState.headers.length}</span> columns. Map to contact fields:
              </p>
              <div className="space-y-2 max-h-[250px] overflow-auto">
                {importState.headers.map((header) => {
                  // Find which fields are already used by OTHER headers
                  const usedByOthers = new Set(
                    Object.entries(importState.mapping)
                      .filter(([h, v]) => h !== header && v)
                      .map(([_, v]) => v)
                  );
                  return (
                    <div key={header} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border/50">
                      <span className="text-sm text-white font-medium w-40 truncate shrink-0" title={header}>{header}</span>
                      <ArrowRight size={14} className="text-muted-foreground shrink-0" />
                      <select value={importState.mapping[header] || ''} onChange={(e) => setImportState(s => ({ ...s, mapping: { ...s.mapping, [header]: e.target.value } }))} className="flex-1 h-8 bg-background/50 text-white text-sm rounded-lg px-3 border border-border focus:outline-none focus:border-blue-500/50">
                        <option value="">Skip</option>
                        {importState.validFields.map(f => (
                          <option key={f} value={f} disabled={usedByOthers.has(f)}>
                            {importState.fieldLabels[f] || f}{usedByOthers.has(f) ? ' (used)' : ''}
                          </option>
                        ))}
                      </select>
                      {importState.suggestions[header] && importState.mapping[header] === importState.suggestions[header] && (
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
              {!hasNameMapping && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle size={14} className="text-amber-400 shrink-0" />
                  <p className="text-amber-400 text-sm">Map at least a name column</p>
                </div>
              )}
              {/* Sequence on import */}
              {sequencesList.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Add to Sequence after import (optional)</label>
                  <select value={importState.sequenceId} onChange={(e) => setImportState(s => ({ ...s, sequenceId: e.target.value }))} className="w-full h-9 bg-background/50 text-white text-sm rounded-lg px-3 border border-border focus:outline-none focus:border-blue-500/50">
                    <option value="">None — import only</option>
                    {sequencesList.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </select>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={executeImport} disabled={!hasNameMapping} className="flex-1 h-10 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-40 transition-all">
                  Import {importState.rows.length} Contacts
                </button>
                <button onClick={resetImport} className="px-4 h-10 rounded-lg text-sm text-muted-foreground hover:text-white hover:bg-secondary transition-all">Back</button>
              </div>
            </div>
          )}

          {importState.step === 'importing' && (
            <div className="py-8 text-center">
              <div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Importing contacts...</p>
            </div>
          )}

          {importState.step === 'done' && importState.result && (
            <div className="py-6 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-white font-medium">Imported {importState.result.imported} of {importState.result.total} contacts</p>
              <div className="text-sm text-muted-foreground mt-2 space-y-0.5">
                {(importState.result as any).duplicates > 0 && <p>{(importState.result as any).duplicates} duplicates skipped</p>}
                {(importState.result as any).invalidUrls > 0 && <p>{(importState.result as any).invalidUrls} invalid LinkedIn URLs</p>}
                {importState.sequenceId && <p>Added to sequence</p>}
              </div>
              <button onClick={() => { setShowImport(false); resetImport(); }} className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-all">Done</button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Full CSV parser that handles multi-line quoted fields (e.g. companyDescription with line breaks)
function parseCsvFull(text: string): { headers: string[]; rows: Array<Record<string, string>> } {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n' || (char === '\r' && text[i + 1] === '\n')) {
        if (char === '\r') i++; // skip \r in \r\n
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.some(f => f)) rows.push(currentRow); // skip fully empty rows
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }
  // Last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f)) rows.push(currentRow);
  }

  if (rows.length < 2) return { headers: [], rows: [] };

  const headers = rows[0];
  const dataRows = rows.slice(1).map(values => {
    const row: Record<string, string> = {};
    headers.forEach((h, j) => { row[h] = values[j] || ''; });
    return row;
  });

  return { headers, rows: dataRows };
}
