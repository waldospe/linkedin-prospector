'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Upload, ExternalLink, Search, Users, FileSpreadsheet, Link2, CheckCircle2, AlertCircle, ArrowRight, Filter, GitBranch, AlertTriangle, Edit2, Save, Pause, Play, Ban, Tag, MoreHorizontal, Megaphone } from 'lucide-react';
import { FUNNEL_STAGES, stageColors, STAGE_MAP } from '@/lib/constants';
import { useUser } from '@/components/user-context';
import ContactDetail from '@/components/contact-detail';
import LabelBadge from '@/components/label-badge';
import LabelPicker from '@/components/label-picker';
import { EmptyState } from '@/components/empty-state';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

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
  avatar_url?: string;
  sequence_name?: string;
  active_sequence_id?: number;
  labels?: Array<{ id: number; name: string; color: string }>;
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
  const [totalContacts, setTotalContacts] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editingContact, setEditingContact] = useState<number | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [detailContactId, setDetailContactId] = useState<number | null>(null);
  const [bulkSequenceId, setBulkSequenceId] = useState('');
  const [newContact, setNewContact] = useState({ first_name: '', last_name: '', linkedin_url: '', company: '', title: '', sequence_id: '', avatar_url: '' });
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
  const [allLabels, setAllLabels] = useState<Array<{ id: number; name: string; color: string }>>([]);
  const [filterLabelIds, setFilterLabelIds] = useState<number[]>([]);
  const [labelPickerContact, setLabelPickerContact] = useState<number | null>(null);
  const [importLabelIds, setImportLabelIds] = useState<Array<number | { name: string; color: string }>>([]);
  const [showImportLabelPicker, setShowImportLabelPicker] = useState(false);
  const [campaignsList, setCampaignsList] = useState<Array<{ id: number; name: string }>>([]);
  const { apiQuery, viewAs, isViewingAll } = useUser();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchContacts();
    fetch('/api/sequences').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setSequencesList(data.filter((s: any) => s.active));
    });
    fetch('/api/labels').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setAllLabels(data);
    });
    fetch(`/api/campaigns${apiQuery}`).then(r => r.json()).then(data => {
      if (Array.isArray(data)) setCampaignsList(data);
    });
  }, [apiQuery, page, filterStatus, search, filterLabelIds]);

  const fetchContacts = async () => {
    try {
      const sep = apiQuery.includes('?') ? '&' : '?';
      const params = `page=${page}&limit=${pageSize}${filterStatus !== 'all' ? `&status=${filterStatus}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}${filterLabelIds.length > 0 ? `&label_ids=${filterLabelIds.join(',')}` : ''}`;
      const res = await fetch(`/api/contacts${apiQuery}${sep}${params}`);
      const data = await res.json();
      if (data.rows) {
        setContacts(data.rows);
        setTotalContacts(data.total);
      } else if (Array.isArray(data)) {
        setContacts(data);
        setTotalContacts(data.length);
      }
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
          avatar_url: data.avatar_url || prev.avatar_url,
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
    setNewContact({ first_name: '', last_name: '', linkedin_url: '', company: '', title: '', sequence_id: '', avatar_url: '' });
    fetchContacts();
  };

  const startEditContact = (c: Contact) => {
    setEditingContact(c.id);
    setEditData({ first_name: c.first_name || '', last_name: c.last_name || '', company: c.company || '', title: c.title || '', linkedin_url: c.linkedin_url || '' });
  };

  const saveEditContact = async () => {
    if (!editingContact) return;
    await fetch(`/api/contacts/${editingContact}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editData),
    });
    setEditingContact(null);
    setEditData({});
    fetchContacts();
  };

  const markOptedOut = async (id: number) => {
    await fetch(`/api/contacts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'opted_out' }),
    });
    fetchContacts();
  };

  const pauseContact = async (id: number) => {
    // Pause all pending queue items for this contact
    await fetch(`/api/contacts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pause: true }),
    });
    fetchContacts();
  };

  const resumeContact = async (id: number) => {
    await fetch(`/api/contacts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume: true }),
    });
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
    try {
      const res = await fetch(`/api/contacts/bulk-sequence${apiQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          sequence_id: parseInt(bulkSequenceId),
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      }
    } catch {
      alert('Failed to assign sequence');
    }
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
            label_ids: importLabelIds.length > 0 ? importLabelIds : undefined,
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

  // Server-side pagination handles filtering — contacts is already the current page
  const filtered = contacts;

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

  const [selectingAll, setSelectingAll] = useState(false);
  const allMatchingSelected = totalContacts > 0 && selectedIds.size === totalContacts;
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = async () => {
    if (allMatchingSelected || someSelected) {
      setSelectedIds(new Set());
      return;
    }
    // If only one page, just select what's loaded
    if (totalContacts <= filtered.length) {
      setSelectedIds(new Set(filtered.map(c => c.id)));
      return;
    }
    // Otherwise fetch all matching IDs across pages
    setSelectingAll(true);
    try {
      const sep = apiQuery.includes('?') ? '&' : '?';
      const params = `ids_only=1${filterStatus !== 'all' ? `&status=${filterStatus}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}${filterLabelIds.length > 0 ? `&label_ids=${filterLabelIds.join(',')}` : ''}`;
      const res = await fetch(`/api/contacts${apiQuery}${sep}${params}`);
      const data = await res.json();
      if (Array.isArray(data.ids)) {
        setSelectedIds(new Set(data.ids));
      }
    } finally {
      setSelectingAll(false);
    }
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleContactLabel = async (contactId: number, labelId: number) => {
    const contact = contacts.find(c => c.id === contactId);
    const hasLabel = contact?.labels?.some(l => l.id === labelId);
    if (hasLabel) {
      await fetch(`/api/contacts/${contactId}/labels`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label_id: labelId }) });
    } else {
      await fetch(`/api/contacts/${contactId}/labels`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label_id: labelId }) });
    }
    // Update local state immediately
    setContacts(prev => prev.map(c => {
      if (c.id !== contactId) return c;
      const currentLabels = c.labels || [];
      if (hasLabel) {
        return { ...c, labels: currentLabels.filter(l => l.id !== labelId) };
      } else {
        const label = allLabels.find(l => l.id === labelId);
        return label ? { ...c, labels: [...currentLabels, label] } : c;
      }
    }));
  };

  const createLabel = async (name: string, color: string) => {
    const res = await fetch('/api/labels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, color }) });
    if (res.ok) {
      const label = await res.json();
      setAllLabels(prev => [...prev, label].sort((a, b) => a.name.localeCompare(b.name)));
      return label;
    }
    return null;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">{totalContacts} prospects in your pipeline</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/contacts/export${apiQuery}`}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-secondary/50 transition-all"
          >
            Export
          </a>
          <button
            onClick={() => { resetImport(); setShowImport(true); }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-secondary/50 transition-all"
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
            <DialogContent className="glass border-border/50 text-foreground sm:rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">Add Contact</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">LinkedIn URL</label>
                  <div className="flex gap-2">
                    <Input placeholder="https://linkedin.com/in/..." value={newContact.linkedin_url} onChange={(e) => setNewContact({ ...newContact, linkedin_url: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookupLinkedIn(newContact.linkedin_url); } }} className="bg-background/50 border-border h-10 flex-1" />
                    <button onClick={() => lookupLinkedIn(newContact.linkedin_url)} disabled={lookingUp || !newContact.linkedin_url} className="px-3 h-10 rounded-lg bg-secondary border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 transition-all shrink-0">
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
                    <select value={newContact.sequence_id} onChange={(e) => setNewContact({ ...newContact, sequence_id: e.target.value })} className="w-full h-10 bg-background/50 text-foreground text-sm rounded-lg px-3 border border-border focus:outline-none focus:border-blue-500/50">
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
          <input placeholder="Search contacts..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="w-full h-9 rounded-lg border border-border bg-card/50 text-foreground pl-10 pr-4 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500/50 transition-all" />
        </div>
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="h-9 bg-card/50 text-foreground text-xs rounded-lg px-3 border border-border focus:outline-none focus:border-blue-500/50">
          <option value="all">All Stages</option>
          {FUNNEL_STAGES.map(s => (<option key={s.key} value={s.key}>{s.label}</option>))}
        </select>
        {allLabels.length > 0 && (
          <select
            value={filterLabelIds.length === 1 ? String(filterLabelIds[0]) : ''}
            onChange={(e) => { setFilterLabelIds(e.target.value ? [parseInt(e.target.value)] : []); setPage(1); }}
            className="h-9 bg-card/50 text-foreground text-xs rounded-lg px-3 border border-border focus:outline-none focus:border-blue-500/50"
          >
            <option value="">All Labels</option>
            {allLabels.map(l => (<option key={l.id} value={l.id}>{l.name}</option>))}
          </select>
        )}
        {(filterStatus !== 'all' || filterLabelIds.length > 0) && (
          <button onClick={() => { setFilterStatus('all'); setFilterLabelIds([]); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Clear
          </button>
        )}
        <span className="text-xs text-muted-foreground">{totalContacts} total</span>
      </div>

      {/* Bulk actions bar — sticky so it stays visible while scrolling long lists */}
      {someSelected && (
        <div className="sticky top-3 z-30 flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/[0.12] border border-blue-500/25 backdrop-blur-md shadow-lg shadow-blue-500/5 animate-fade-in">
          <span className="text-sm text-blue-400 font-medium">{selectedIds.size} selected</span>
          <div className="h-4 w-px bg-border" />
          {sequencesList.length > 0 && (
            <div className="flex items-center gap-2">
              <GitBranch size={14} className="text-muted-foreground" />
              <select value={bulkSequenceId} onChange={(e) => setBulkSequenceId(e.target.value)} className="h-8 bg-background/50 text-foreground text-xs rounded-lg px-2 border border-border focus:outline-none focus:border-blue-500/50">
                <option value="">Select sequence...</option>
                {sequencesList.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
              <button onClick={bulkAssignSequence} disabled={!bulkSequenceId} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 disabled:opacity-40 transition-all">
                Add to Sequence
              </button>
            </div>
          )}
          <div className="h-4 w-px bg-border" />
          {allLabels.length > 0 && (
            <div className="relative">
              <select
                defaultValue=""
                onChange={async (e) => {
                  if (!e.target.value) return;
                  const labelId = parseInt(e.target.value);
                  for (const id of Array.from(selectedIds)) {
                    await fetch(`/api/contacts/${id}/labels`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label_id: labelId }) });
                  }
                  fetchContacts();
                  e.target.value = '';
                }}
                className="h-8 bg-background/50 text-foreground text-xs rounded-lg px-2 border border-border focus:outline-none focus:border-blue-500/50"
              >
                <option value="">+ Label</option>
                {allLabels.map(l => (<option key={l.id} value={l.id}>{l.name}</option>))}
              </select>
            </div>
          )}
          {campaignsList.length > 0 && (<>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Megaphone size={14} className="text-muted-foreground" />
              <select
                defaultValue=""
                onChange={async (e) => {
                  if (!e.target.value) return;
                  const campaignId = parseInt(e.target.value);
                  await fetch(`/api/campaigns/${campaignId}/contacts`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contact_ids: Array.from(selectedIds) }),
                  });
                  e.target.value = '';
                  setSelectedIds(new Set());
                }}
                className="h-8 bg-background/50 text-foreground text-xs rounded-lg px-2 border border-border focus:outline-none focus:border-blue-500/50"
              >
                <option value="">+ Campaign</option>
                {campaignsList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </>)}
          <div className="h-4 w-px bg-border" />
          <button onClick={() => setShowDeleteConfirm(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/10 transition-all">
            <Trash2 size={12} />
            Delete
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors">
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
        search || filterStatus !== 'all' || filterLabelIds.length > 0 ? (
          <EmptyState
            icon={Search}
            title="No contacts match your filters"
            description="Try clearing the search or stage filter."
            action={
              <button onClick={() => { setSearchInput(''); setFilterStatus('all'); setFilterLabelIds([]); }} className="text-sm text-blue-400 hover:text-blue-300 font-medium">
                Clear filters
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={Users}
            title="No contacts yet"
            description="Import a CSV, paste a Google Sheets URL, or add a single LinkedIn profile to get started."
            action={
              <button onClick={() => { resetImport(); setShowImport(true); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-all">
                <Upload size={14} /> Import contacts
              </button>
            }
          />
        )
      ) : (
        <div className="space-y-1.5">
          {/* Select all header */}
          <div className="flex items-center gap-3 px-4 py-1.5">
            <input
              type="checkbox"
              checked={allMatchingSelected}
              ref={el => { if (el) el.indeterminate = someSelected && !allMatchingSelected; }}
              onChange={toggleSelectAll}
              disabled={selectingAll}
              className="w-4 h-4 rounded border-border bg-background accent-blue-600 cursor-pointer disabled:opacity-50"
            />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
              {selectingAll ? `Selecting all ${totalContacts}…` : someSelected ? `${selectedIds.size} of ${totalContacts} selected` : `Select all ${totalContacts}`}
            </span>
          </div>
          {filtered.map((contact) => {
            const cfg = getStatusDisplay(contact.status);
            const isSelected = selectedIds.has(contact.id);
            const isEditing = editingContact === contact.id;
            return (
              <div key={contact.id} className={`glass rounded-xl p-3.5 transition-all ${isSelected ? 'border-blue-500/30 bg-blue-500/5' : 'glass-hover'}`}>
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(contact.id)} className="w-4 h-4 rounded border-border bg-background accent-blue-600 cursor-pointer shrink-0" />
                  <button onClick={() => setDetailContactId(contact.id)} className="shrink-0 hover:opacity-80 transition-opacity">
                    {contact.avatar_url && contact.avatar_url !== 'none' ? (
                      <img src={contact.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-border" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/10 flex items-center justify-center text-xs font-semibold text-blue-300">
                        {(contact.first_name || contact.name || '?').charAt(0)}
                      </div>
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setDetailContactId(contact.id)} className="text-sm font-medium text-foreground truncate hover:text-blue-400 transition-colors text-left">
                        {displayName(contact)}
                      </button>
                      {contact.linkedin_url && (
                        <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 shrink-0"><ExternalLink size={11} /></a>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {contact.title}{contact.title && contact.company ? ' at ' : ''}{contact.company}
                    </p>
                    {contact.labels && contact.labels.length > 0 && (
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        {contact.labels.slice(0, 3).map(l => (
                          <LabelBadge key={l.id} name={l.name} color={l.color} />
                        ))}
                        {contact.labels.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{contact.labels.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md ${cfg.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                    {contact.sequence_name ? (
                      <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/15 max-w-[120px] truncate" title={contact.sequence_name}>
                        {contact.sequence_name}
                      </span>
                    ) : sequencesList.length > 0 && !['opted_out'].includes(contact.status) ? (
                      <select defaultValue="" onChange={(e) => { if (e.target.value) assignSequence(contact.id, parseInt(e.target.value)); }} className="h-7 bg-secondary/50 text-foreground text-[11px] rounded-lg px-1.5 border border-border focus:outline-none focus:border-blue-500/50 cursor-pointer">
                        <option value="">+ Seq</option>
                        {sequencesList.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                      </select>
                    ) : null}
                    <div className="relative">
                      {labelPickerContact === contact.id && (
                        <div className="absolute right-0 top-8 z-50">
                          <LabelPicker
                            selectedIds={contact.labels?.map(l => l.id) || []}
                            onToggle={(labelId) => toggleContactLabel(contact.id, labelId)}
                            onCreate={createLabel}
                            allLabels={allLabels}
                          />
                          <div className="fixed inset-0 -z-10" onClick={() => setLabelPickerContact(null)} />
                        </div>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all" title="Actions">
                        <MoreHorizontal size={14} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => startEditContact(contact)}>
                          <Edit2 size={13} /> Edit details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setLabelPickerContact(contact.id)}>
                          <Tag size={13} /> Manage labels
                        </DropdownMenuItem>
                        {contact.status === 'queued' && (
                          <DropdownMenuItem onClick={() => pauseContact(contact.id)}>
                            <Pause size={13} /> Pause sequence
                          </DropdownMenuItem>
                        )}
                        {contact.status === 'queued' && (
                          <DropdownMenuItem onClick={() => markOptedOut(contact.id)}>
                            <Ban size={13} /> Mark opted out
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => deleteContact(contact.id)}>
                          <Trash2 size={13} /> Delete contact
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {/* Inline edit */}
                {isEditing && (
                  <div className="mt-3 ml-14 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 animate-slide-up">
                    <input value={editData.first_name || ''} onChange={(e) => setEditData({ ...editData, first_name: e.target.value })} placeholder="First name" className="bg-background/50 border border-border rounded-lg px-2 h-8 text-xs text-foreground" />
                    <input value={editData.last_name || ''} onChange={(e) => setEditData({ ...editData, last_name: e.target.value })} placeholder="Last name" className="bg-background/50 border border-border rounded-lg px-2 h-8 text-xs text-foreground" />
                    <input value={editData.company || ''} onChange={(e) => setEditData({ ...editData, company: e.target.value })} placeholder="Company" className="bg-background/50 border border-border rounded-lg px-2 h-8 text-xs text-foreground" />
                    <input value={editData.title || ''} onChange={(e) => setEditData({ ...editData, title: e.target.value })} placeholder="Title" className="bg-background/50 border border-border rounded-lg px-2 h-8 text-xs text-foreground" />
                    <div className="flex gap-1">
                      <button onClick={saveEditContact} className="flex-1 h-8 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-500 transition-all flex items-center justify-center">
                        <Save size={12} />
                      </button>
                      <button onClick={() => setEditingContact(null)} className="h-8 px-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalContacts > pageSize && (
        <div className="flex items-center justify-between py-4">
          <span className="text-xs text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalContacts)} of {totalContacts}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 transition-all">
              Previous
            </button>
            <span className="text-xs text-foreground tabular-nums">Page {page} of {Math.ceil(totalContacts / pageSize)}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(totalContacts / pageSize)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 transition-all">
              Next
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="glass border-border/50 text-foreground sm:rounded-2xl sm:max-w-sm">
          <div className="text-center py-2">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={24} className="text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Delete {selectedIds.size} contacts?</h3>
            <p className="text-sm text-muted-foreground mt-2">
              This will permanently delete the selected contacts and remove them from any active sequences. This cannot be undone.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 h-10 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
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
        <DialogContent className="glass border-border/50 text-foreground sm:rounded-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {importState.step === 'choose' && 'Import Contacts'}
              {importState.step === 'csv-upload' && 'Upload CSV'}
              {importState.step === 'sheets-url' && 'Google Sheets'}
              {importState.step === 'mapping' && 'Map Columns'}
              {importState.step === 'importing' && 'Importing...'}
              {importState.step === 'done' && 'Import Complete'}
            </DialogTitle>
            {/* Progress indicator */}
            {(() => {
              const stepOrder: ImportStep[] = ['choose', 'mapping', 'importing', 'done'];
              const currentIdx = stepOrder.indexOf(importState.step);
              const effectiveIdx = importState.step === 'csv-upload' || importState.step === 'sheets-url' ? 0 : currentIdx;
              return (
                <div className="flex items-center gap-1.5 mt-2">
                  {['Source', 'Map', 'Import', 'Done'].map((label, i) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${
                        i < effectiveIdx ? 'bg-emerald-500/20 text-emerald-400'
                          : i === effectiveIdx ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30'
                          : 'bg-secondary text-muted-foreground'
                      }`}>
                        {i < effectiveIdx ? '✓' : i + 1}
                      </div>
                      <span className={`text-[11px] font-medium ${i === effectiveIdx ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
                      {i < 3 && <div className={`w-6 h-px ${i < effectiveIdx ? 'bg-emerald-500/40' : 'bg-border'}`} />}
                    </div>
                  ))}
                </div>
              );
            })()}
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
                <div><p className="text-sm font-medium text-foreground">CSV File</p><p className="text-xs text-muted-foreground mt-0.5">Upload a .csv file</p></div>
              </button>
              <button onClick={() => setImportState(s => ({ ...s, step: 'sheets-url' }))} className="w-full flex items-center gap-4 p-4 rounded-xl bg-secondary/50 border border-border hover:bg-secondary hover:border-border/80 transition-all text-left">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/15 flex items-center justify-center shrink-0"><Link2 size={18} className="text-blue-400" /></div>
                <div><p className="text-sm font-medium text-foreground">Google Sheets</p><p className="text-xs text-muted-foreground mt-0.5">Paste a public link</p></div>
              </button>
              <button onClick={importFromPipedrive} disabled={importing} className="w-full flex items-center gap-4 p-4 rounded-xl bg-secondary/50 border border-border hover:bg-secondary hover:border-border/80 transition-all text-left disabled:opacity-50">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/15 flex items-center justify-center shrink-0"><Upload size={18} className="text-violet-400" /></div>
                <div><p className="text-sm font-medium text-foreground">{importing ? 'Importing...' : 'Pipedrive'}</p><p className="text-xs text-muted-foreground mt-0.5">Sync from CRM</p></div>
              </button>
            </div>
          )}

          {importState.step === 'csv-upload' && (
            <div className="space-y-4 mt-2">
              <label className="block w-full cursor-pointer">
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-blue-500/30 transition-all">
                  <FileSpreadsheet className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-foreground font-medium">Click to select a CSV file</p>
                </div>
                <input type="file" accept=".csv" onChange={handleCsvFile} className="hidden" />
              </label>
              <button onClick={() => setImportState(s => ({ ...s, step: 'choose' }))} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Back</button>
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
              <button onClick={() => setImportState(s => ({ ...s, step: 'choose', error: '' }))} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Back</button>
            </div>
          )}

          {importState.step === 'mapping' && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">{importState.rows.length}</span> rows, <span className="text-foreground font-medium">{importState.headers.length}</span> columns. Map to contact fields:
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
                      <span className="text-sm text-foreground font-medium w-40 truncate shrink-0" title={header}>{header}</span>
                      <ArrowRight size={14} className="text-muted-foreground shrink-0" />
                      <select value={importState.mapping[header] || ''} onChange={(e) => setImportState(s => ({ ...s, mapping: { ...s.mapping, [header]: e.target.value } }))} className="flex-1 h-8 bg-background/50 text-foreground text-sm rounded-lg px-3 border border-border focus:outline-none focus:border-blue-500/50">
                        <option value="">Skip</option>
                        {importState.validFields.map(f => {
                          const isRequired = ['first_name', 'last_name', 'name', 'linkedin_url'].includes(f);
                          return (
                          <option key={f} value={f} disabled={usedByOthers.has(f)}>
                            {isRequired ? '★ ' : ''}{importState.fieldLabels[f] || f}{usedByOthers.has(f) ? ' (used)' : ''}
                          </option>
                          );
                        })}
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
              {/* Labels on import */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Apply Labels (optional)</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(importLabelIds as any[]).map((item, i) => {
                    const label = typeof item === 'number' ? allLabels.find(l => l.id === item) : item;
                    if (!label) return null;
                    const name = typeof label === 'object' && 'name' in label ? label.name : '';
                    const color = typeof label === 'object' && 'color' in label ? label.color : '#6B7280';
                    return <LabelBadge key={i} name={name} color={color} onRemove={() => setImportLabelIds(prev => prev.filter((_, idx) => idx !== i))} size="md" />;
                  })}
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowImportLabelPicker(!showImportLabelPicker)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                  >
                    <Tag size={12} />
                    Add Labels
                  </button>
                  {showImportLabelPicker && (
                    <div className="absolute left-0 top-9 z-50">
                      <LabelPicker
                        selectedIds={(importLabelIds as any[]).filter(x => typeof x === 'number') as number[]}
                        onToggle={(labelId) => {
                          setImportLabelIds(prev => {
                            const numericIds = prev.filter(x => typeof x === 'number') as number[];
                            if (numericIds.includes(labelId)) return prev.filter(x => x !== labelId);
                            return [...prev, labelId];
                          });
                        }}
                        onCreate={async (name, color) => {
                          const label = await createLabel(name, color);
                          if (label) setImportLabelIds(prev => [...prev, label.id]);
                          return label;
                        }}
                        allLabels={allLabels}
                      />
                      <div className="fixed inset-0 -z-10" onClick={() => setShowImportLabelPicker(false)} />
                    </div>
                  )}
                </div>
              </div>

              {/* Sequence on import */}
              {sequencesList.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Add to Sequence after import (optional)</label>
                  <select value={importState.sequenceId} onChange={(e) => setImportState(s => ({ ...s, sequenceId: e.target.value }))} className="w-full h-9 bg-background/50 text-foreground text-sm rounded-lg px-3 border border-border focus:outline-none focus:border-blue-500/50">
                    <option value="">None — import only</option>
                    {sequencesList.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </select>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={executeImport} disabled={!hasNameMapping} className="flex-1 h-10 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-40 transition-all">
                  Import {importState.rows.length} Contacts
                </button>
                <button onClick={resetImport} className="px-4 h-10 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">Back</button>
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
              <p className="text-foreground font-medium">Imported {importState.result.imported} of {importState.result.total} contacts</p>
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

      {/* Contact Detail Panel */}
      {detailContactId && (
        <ContactDetail contactId={detailContactId} onClose={() => { setDetailContactId(null); fetchContacts(); }} />
      )}
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
