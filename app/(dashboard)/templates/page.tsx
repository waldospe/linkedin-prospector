'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Plus, Trash2, Edit2, FileText } from 'lucide-react';

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

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async () => {
    try {
      if (editingTemplate) {
        await fetch(`/api/templates/${editingTemplate.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingTemplate)
        });
        setEditingTemplate(null);
      } else {
        await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTemplate)
        });
        setNewTemplate({ name: '', subject: '', body: '', variables: 'firstName' });
      }
      fetchTemplates();
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  };

  const deleteTemplate = async (id: number) => {
    if (!confirm('Delete this template?')) return;
    try {
      await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      fetchTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Templates</h1>
          <p className="text-zinc-400 mt-1">Message templates for outreach</p>
        </div>
        <Dialog>
          <DialogTrigger>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Template Name"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                className="bg-zinc-950 border-zinc-800"
              />
              <Input
                placeholder="Variables (comma-separated)"
                value={newTemplate.variables}
                onChange={(e) => setNewTemplate({ ...newTemplate, variables: e.target.value })}
                className="bg-zinc-950 border-zinc-800"
              />
              <Textarea
                placeholder="Message body (use {{variableName}} for personalization)"
                value={newTemplate.body}
                onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })}
                className="bg-zinc-950 border-zinc-800 min-h-32"
              />
              <Button onClick={saveTemplate} className="w-full bg-blue-600 hover:bg-blue-700">
                Save Template
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-500" />
                    <CardTitle className="text-white text-lg">{template.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingTemplate(template)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteTemplate(template.id)}
                      className="text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-400 mb-2">
                  Variables: {template.variables}
                </p>
                <div className="p-3 bg-zinc-950 rounded border border-zinc-800">
                  <p className="text-zinc-300 text-sm whitespace-pre-wrap">{template.body}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      {editingTemplate && (
        <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Template Name"
                value={editingTemplate.name}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                className="bg-zinc-950 border-zinc-800"
              />
              <Input
                placeholder="Variables (comma-separated)"
                value={editingTemplate.variables}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, variables: e.target.value })}
                className="bg-zinc-950 border-zinc-800"
              />
              <Textarea
                placeholder="Message body"
                value={editingTemplate.body}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                className="bg-zinc-950 border-zinc-800 min-h-32"
              />
              <Button onClick={saveTemplate} className="w-full bg-blue-600 hover:bg-blue-700">
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
