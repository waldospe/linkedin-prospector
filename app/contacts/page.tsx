'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Upload, Download } from 'lucide-react';

interface Contact {
  id: number;
  name: string;
  linkedin_url: string;
  company: string;
  title: string;
  source: string;
  status: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContact, setNewContact] = useState({ name: '', linkedin_url: '', company: '', title: '' });
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/contacts');
      const data = await res.json();
      setContacts(data);
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const addContact = async () => {
    if (!newContact.name) return;
    try {
      await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact)
      });
      setNewContact({ name: '', linkedin_url: '', company: '', title: '' });
      fetchContacts();
    } catch (error) {
      console.error('Failed to add contact:', error);
    }
  };

  const deleteContact = async (id: number) => {
    if (!confirm('Delete this contact?')) return;
    try {
      await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
      fetchContacts();
    } catch (error) {
      console.error('Failed to delete contact:', error);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      await fetch(`/api/contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      fetchContacts();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const importFromPipedrive = async () => {
    setImporting(true);
    try {
      const res = await fetch('/api/pipedrive/sync', { method: 'POST' });
      const data = await res.json();
      alert(`Imported ${data.imported} contacts from Pipedrive`);
      fetchContacts();
    } catch (error) {
      console.error('Failed to import:', error);
    } finally {
      setImporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="text-yellow-500">Pending</Badge>;
      case 'connected': return <Badge variant="outline" className="text-blue-500">Connected</Badge>;
      case 'messaged': return <Badge variant="outline" className="text-purple-500">Messaged</Badge>;
      case 'replied': return <Badge variant="outline" className="text-green-500">Replied</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Contacts</h1>
          <p className="text-zinc-400 mt-1">Manage your LinkedIn outreach contacts</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={importFromPipedrive}
            disabled={importing}
          >
            <Upload className="w-4 h-4 mr-2" />
            {importing ? 'Importing...' : 'Import from Pipedrive'}
          </Button>
          <Dialog>
            <DialogTrigger>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" /> Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
              <DialogHeader>
                <DialogTitle>Add Contact</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Name"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  className="bg-zinc-950 border-zinc-800"
                />
                <Input
                  placeholder="LinkedIn URL"
                  value={newContact.linkedin_url}
                  onChange={(e) => setNewContact({ ...newContact, linkedin_url: e.target.value })}
                  className="bg-zinc-950 border-zinc-800"
                />
                <Input
                  placeholder="Company"
                  value={newContact.company}
                  onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
                  className="bg-zinc-950 border-zinc-800"
                />
                <Input
                  placeholder="Title"
                  value={newContact.title}
                  onChange={(e) => setNewContact({ ...newContact, title: e.target.value })}
                  className="bg-zinc-950 border-zinc-800"
                />
                <Button onClick={addContact} className="w-full bg-blue-600 hover:bg-blue-700">
                  Add Contact
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : (
        <div className="grid gap-3">
          {contacts.map((contact) => (
            <Card key={contact.id} className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium">{contact.name}</h3>
                    <p className="text-sm text-zinc-400">{contact.title} at {contact.company}</p>
                    {contact.linkedin_url && (
                      <a 
                        href={contact.linkedin_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:underline"
                      >
                        View LinkedIn
                      </a>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {contact.source}
                      </Badge>
                      {getStatusBadge(contact.status)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={contact.status} onValueChange={(v) => v && updateStatus(contact.id, v)}>
                      <SelectTrigger className="w-32 bg-zinc-950 border-zinc-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="connected">Connected</SelectItem>
                        <SelectItem value="messaged">Messaged</SelectItem>
                        <SelectItem value="replied">Replied</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteContact(contact.id)}
                      className="text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
