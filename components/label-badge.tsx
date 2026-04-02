'use client';

import { X } from 'lucide-react';

interface LabelBadgeProps {
  name: string;
  color: string;
  onRemove?: () => void;
  size?: 'sm' | 'md';
}

export default function LabelBadge({ name, color, onRemove, size = 'sm' }: LabelBadgeProps) {
  const isSmall = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border font-medium ${
        isSmall ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
      }`}
      style={{
        backgroundColor: `${color}15`,
        borderColor: `${color}30`,
        color: color,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      {name}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 hover:opacity-70 transition-opacity"
        >
          <X size={isSmall ? 10 : 12} />
        </button>
      )}
    </span>
  );
}
