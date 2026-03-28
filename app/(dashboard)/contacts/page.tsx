'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Upload, ExternalLink, Search, Users } from 'lucide-react';

interface Contact {
  id: number;
  name: string;
  linkedin_url: string;
  company: string;
  title: string;
  source: string;
  status: string;
}

const statusConfig: Record<string, { label: string; dot: string; bg: string }> = {
  pending: { label: 'Pending', dot: 'bg-amber-400', bg: 'bg-amber-500/10 text-amber-400' },
  connected: { label: 'Connected', dot: 'bg-blue-400', bg: 'bg-blue-500/10 text-blue-400' },
  messaged: { label: 'Messaged', dot: 'bg-indigo-400', bg: 'bg-indigo-500/10 text-indigo-400' },
  replied: { label: 'Replied', dot: 'bg-emerald-400', bg: 'bg-emerald-500/10 text-emerald-400' },
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newContact, setNewContact] = useState({ name: '', linkedin_url: '', company: '', title: '' });
  const [importing, setImporting] = useState(false);

  useEffect(() => { fetchContacts(); }, []);

  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/contacts');
      setContacts(await res.json());
    } finally { setLoading(false); }
  };

  const addContact = async () => {
    if (!newContact.name) return;
    await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newContact),
    });
    setNewContact({ name: '', linkedin_url: '', company: '', title: '' });
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

  const importFromPipedrive = async () => {
    setImporting(true);
    try {
      const res = await fetch('/api/pipedrive/sync', { method: 'POST' });
      const data = await res.json();
      alert(`Imported ${data.imported} contacts from Pipedrive`);
      fetchContacts();
    } finally { setImporting(false); }
  };

  const filtered = contacts.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">{contacts.length} prospects in your pipeline</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={importFromPipedrive}
            disabled={importing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-white hover:border-border/80 hover:bg-secondary/50 transition-all disabled:opacity-40"
          >
            <Upload size={15} />
            {importing ? 'Importing...' : 'Pipedrive'}
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
                <Input placeholder="Full name" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} className="bg-background/50 border-border h-10" />
                <Input placeholder="LinkedIn URL" value={newContact.linkedin_url} onChange={(e) => setNewContact({ ...newContact, linkedin_url: e.target.value })} className="bg-background/50 border-border h-10" />
                <Input placeholder="Company" value={newContact.company} onChange={(e) => setNewContact({ ...newContact, company: e.target.value })} className="bg-background/50 border-border h-10" />
                <Input placeholder="Title" value={newContact.title} onChange={(e) => setNewContact({ ...newContact, title: e.target.value })} className="bg-background/50 border-border h-10" />
                <button onClick={addContact} className="w-full h-10 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-all">
                  Add Contact
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 rounded-lg border border-border bg-card/50 text-white pl-10 pr-4 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500/50 transition-all"
        />
      </div>

      {/* Contact list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-secondary rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Users className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground">{search ? 'No contacts match your search' : 'No contacts yet'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((contact) => {
            const cfg = statusConfig[contact.status] || statusConfig.pending;
            return (
              <div key={contact.id} className="glass glass-hover rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/10 flex items-center justify-center text-xs font-semibold text-blue-300 shrink-0">
                    {contact.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{contact.name}</p>
                      {contact.linkedin_url && (
                        <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 shrink-0">
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {contact.title}{contact.title && contact.company ? ' at ' : ''}{contact.company}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md ${cfg.bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                  <Select value={contact.status} onValueChange={(v) => { if (v) updateStatus(contact.id, v); }}>
                    <SelectTrigger className="w-28 h-8 bg-secondary/50 border-border text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="connected">Connected</SelectItem>
                      <SelectItem value="messaged">Messaged</SelectItem>
                      <SelectItem value="replied">Replied</SelectItem>
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => deleteContact(contact.id)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
