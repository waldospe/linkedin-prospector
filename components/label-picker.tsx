'use client';

import { useState, useEffect, useRef } from 'react';
import { Tag, Plus, Check, X } from 'lucide-react';

interface Label {
  id: number;
  name: string;
  color: string;
}

const PRESET_COLORS = [
  '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899',
  '#EF4444', '#F59E0B', '#10B981', '#06B6D4',
  '#6B7280', '#78716C',
];

interface LabelPickerProps {
  selectedIds: number[];
  onToggle: (labelId: number) => void;
  onCreate?: (name: string, color: string) => Promise<Label | null>;
  allLabels?: Label[];
  className?: string;
}

export default function LabelPicker({ selectedIds, onToggle, onCreate, allLabels: externalLabels, className }: LabelPickerProps) {
  const [labels, setLabels] = useState<Label[]>(externalLabels || []);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (externalLabels) {
      setLabels(externalLabels);
      return;
    }
    fetch('/api/labels').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setLabels(data);
    }).catch(() => {});
  }, [externalLabels]);

  const filtered = search.trim()
    ? labels.filter(l => l.name.toLowerCase().includes(search.toLowerCase()))
    : labels;

  const exactMatch = labels.find(l => l.name.toLowerCase() === search.trim().toLowerCase());
  const showCreate = search.trim().length > 0 && !exactMatch && onCreate;

  const handleCreate = async () => {
    if (!onCreate || !search.trim()) return;
    setCreating(true);
    const label = await onCreate(search.trim(), newColor);
    if (label) {
      setLabels(prev => [...prev, label].sort((a, b) => a.name.localeCompare(b.name)));
      onToggle(label.id);
      setSearch('');
    }
    setCreating(false);
  };

  return (
    <div className={`bg-card border border-border rounded-xl shadow-lg overflow-hidden w-64 ${className || ''}`}>
      {/* Search */}
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Tag size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && showCreate) handleCreate(); }}
            placeholder="Search or create label..."
            className="w-full h-8 bg-secondary/50 rounded-lg pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-transparent focus:border-blue-500/30"
            autoFocus
          />
        </div>
      </div>

      {/* Label list */}
      <div className="max-h-48 overflow-y-auto p-1">
        {filtered.map(label => {
          const selected = selectedIds.includes(label.id);
          return (
            <button
              key={label.id}
              onClick={() => onToggle(label.id)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-accent/50 transition-colors"
            >
              <span className="w-3 h-3 rounded-full shrink-0 border" style={{ backgroundColor: selected ? label.color : 'transparent', borderColor: label.color }} />
              <span className="text-xs text-foreground truncate flex-1">{label.name}</span>
              {selected && <Check size={13} className="text-blue-400 shrink-0" />}
            </button>
          );
        })}
        {filtered.length === 0 && !showCreate && (
          <p className="text-xs text-muted-foreground text-center py-3">No labels found</p>
        )}
      </div>

      {/* Create new */}
      {showCreate && (
        <div className="border-t border-border p-2">
          <div className="flex gap-1 mb-2 flex-wrap">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-4 h-4 rounded-full border-2 transition-all ${newColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 disabled:opacity-50 transition-all"
          >
            <Plus size={13} />
            Create "{search.trim()}"
          </button>
        </div>
      )}
    </div>
  );
}
