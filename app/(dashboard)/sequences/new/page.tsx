'use client';

import { useEffect, useState } from 'react';
import SequenceEditor from '@/components/sequence-editor';
import { useUser } from '@/components/user-context';

export default function NewSequencePage() {
  const { isAdmin } = useUser();
  const [teamUsers, setTeamUsers] = useState<Array<{ id: number; name: string }>>([]);

  useEffect(() => {
    if (isAdmin) {
      fetch('/api/users').then((r) => r.json()).then((data) => {
        if (Array.isArray(data)) setTeamUsers(data);
      }).catch(() => {});
    }
  }, [isAdmin]);

  return (
    <SequenceEditor
      mode="new"
      initial={{
        name: '',
        steps: [{ action: 'connection', template: '', delay_hours: 0 }],
        visibility: 'private',
        shared_with_user_ids: '',
      }}
      teamUsers={teamUsers}
    />
  );
}
