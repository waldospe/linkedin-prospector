'use client';

import { Eye, X } from 'lucide-react';
import { useUser } from '@/components/user-context';

export function ViewAsBanner() {
  const { viewAs, viewingUser, isViewingAll, setViewAs, isAdmin } = useUser();
  if (!isAdmin || viewAs === null) return null;

  return (
    <div className="sticky top-0 z-40 w-full bg-amber-500/15 border-b border-amber-500/30 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-8 py-2 flex items-center gap-3">
        <Eye size={14} className="text-amber-300 shrink-0" />
        <p className="text-xs font-medium text-amber-200 flex-1">
          {isViewingAll ? (
            <>You are viewing <span className="font-semibold">aggregated team data</span> across all users.</>
          ) : (
            <>You are viewing as <span className="font-semibold">{viewingUser?.name}</span>. Any actions you take affect their account.</>
          )}
        </p>
        <button
          onClick={() => setViewAs(null)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-200 hover:text-white px-2 py-1 rounded-md hover:bg-amber-500/20 transition-all"
        >
          <X size={12} /> Exit view-as
        </button>
      </div>
    </div>
  );
}
