'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Plus, Trash2, Edit2, FileText, Tag } from 'lucide-react';

interface Template {
  id: number;
  name: string;
  subject: string;
  body: string;
  variables: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: '', subject: '', body: '', variables: 'firstName' });

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      setTemplates(await res.json());
    } finally { setLoading(false); }
  };

  const saveTemplate = async () => {
    if (editingTemplate) {
      await fetch(`/api/templates/${editingTemplate.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTemplate),
      });
      setEditingTemplate(null);
    } else {
      await fetch('/api/templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      });
      setNewTemplate({ name: '', subject: '', body: '', variables: 'firstName' });
    }
    fetchTemplates();
  };

  const deleteTemplate = async (id: number) => {
    if (!confirm('Delete this template?')) return;
    await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    fetchTemplates();
  };

  const availableVars = [
    { key: 'firstName', label: 'First Name', desc: 'Contact first name' },
    { key: 'lastName', label: 'Last Name', desc: 'Contact last name' },
    { key: 'fullName', label: 'Full Name', desc: 'First + last name' },
    { key: 'company', label: 'Company', desc: 'Company name' },
    { key: 'title', label: 'Title', desc: 'Job title' },
  ];

  const insertVariable = (template: any, onChange: (t: any) => void, varKey: string) => {
    const tag = `{{${varKey}}}`;
    onChange({ ...template, body: (template.body || '') + tag });
  };

  const TemplateForm = ({ template, onChange }: { template: any; onChange: (t: any) => void }) => (
    <div className="space-y-3 mt-2">
      <Input placeholder="Template name" value={template.name} onChange={(e) => onChange({ ...template, name: e.target.value })} className="bg-background/50 border-border h-10" />
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Insert Variable</label>
        <div className="flex flex-wrap gap-1.5">
          {availableVars.map(v => (
            <button
              key={v.key}
              type="button"
              onClick={() => insertVariable(template, onChange, v.key)}
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/15 hover:bg-violet-500/20 transition-colors cursor-pointer"
              title={v.desc}
            >
              <Tag size={9} />
              {v.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Message Body</label>
        <Textarea
          placeholder="Hi {{firstName}}, I'd love to connect..."
          value={template.body}
          onChange={(e) => onChange({ ...template, body: e.target.value })}
          className="bg-background/50 border-border min-h-[140px] text-sm leading-relaxed"
        />
        <p className="text-[11px] text-muted-foreground mt-1">Use {'{{variableName}}'} syntax for personalization. Variables are replaced with contact data when messages are sent.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">Reusable message templates for outreach</p>
        </div>
        <Dialog>
          <DialogTrigger>
            <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-all glow-sm cursor-pointer">
              <Plus size={15} /> New Template
            </span>
          </DialogTrigger>
          <DialogContent className="glass border-border/50 text-foreground sm:rounded-2xl sm:max-w-2xl">
            <DialogHeader><DialogTitle className="text-lg font-semibold">Create Template</DialogTitle></DialogHeader>
            <TemplateForm template={newTemplate} onChange={setNewTemplate} />
            <button onClick={saveTemplate} className="w-full h-10 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-all mt-2">
              Save Template
            </button>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-secondary rounded-xl animate-pulse" />)}</div>
      ) : templates.length === 0 ? (
        <div className="py-16 text-center">
          <FileText className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground">No templates yet</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <div key={template.id} className="glass glass-hover rounded-xl p-5 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center">
                    <FileText size={14} className="text-indigo-400" />
                  </div>
                  <h3 className="text-sm font-medium text-foreground">{template.name}</h3>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditingTemplate(template)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => deleteTemplate(template.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {template.variables && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {template.variables.split(',').map((v) => (
                    <span key={v} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/15">
                      <Tag size={9} />
                      {v.trim()}
                    </span>
                  ))}
                </div>
              )}

              <div className="p-3 bg-background/30 rounded-lg border border-border/30 flex-1">
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-6">{template.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingTemplate && (
        <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
          <DialogContent className="glass border-border/50 text-foreground sm:rounded-2xl sm:max-w-2xl">
            <DialogHeader><DialogTitle className="text-lg font-semibold">Edit Template</DialogTitle></DialogHeader>
            <TemplateForm template={editingTemplate} onChange={setEditingTemplate} />
            <button onClick={saveTemplate} className="w-full h-10 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-all mt-2">
              Save Changes
            </button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
