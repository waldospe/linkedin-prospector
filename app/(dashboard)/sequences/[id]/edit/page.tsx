'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import SequenceEditor, { SequenceFormValue } from '@/components/sequence-editor';
import { useUser } from '@/components/user-context';

export default function EditSequencePage() {
  const params = useParams();
  const id = parseInt(params.id as string);
  const { isAdmin } = useUser();
  const [seq, setSeq] = useState<SequenceFormValue | null>(null);
  const [teamUsers, setTeamUsers] = useState<Array<{ id: number; name: string }>>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/sequences/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) {
          setError(data.error);
          return;
        }
        const steps = typeof data.steps === 'string' ? JSON.parse(data.steps) : data.steps;
        setSeq({
          id: data.id,
          name: data.name,
          steps,
          visibility: data.visibility || 'private',
          shared_with_user_ids: data.shared_with_user_ids || '',
          user_id: data.user_id,
        });
      })
      .catch(() => setError('Failed to load sequence'));

    if (isAdmin) {
      fetch('/api/users').then((r) => r.json()).then((data) => {
        if (Array.isArray(data)) setTeamUsers(data);
      }).catch(() => {});
    }
  }, [id, isAdmin]);

  if (error) {
    return <div className="t-meta text-red-400">{error}</div>;
  }
  if (!seq) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="h-8 w-48 bg-secondary rounded animate-pulse" />
        <div className="h-32 bg-secondary rounded-xl animate-pulse" />
        <div className="h-64 bg-secondary rounded-xl animate-pulse" />
      </div>
    );
  }
  return <SequenceEditor mode="edit" initial={seq} teamUsers={teamUsers} />;
}
