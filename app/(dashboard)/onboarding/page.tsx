'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/user-context';
import { Zap, Users } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const { currentUser, refreshUser } = useUser();
  const [teams, setTeams] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // If user already has a team, redirect to dashboard
    if (currentUser?.team_id) {
      router.push('/');
      return;
    }
    fetch('/api/teams').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setTeams(data);
    });
  }, [currentUser]);

  const selectTeam = async () => {
    if (!selectedTeam) return;
    setSaving(true);
    await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentUser?.id, team_id: selectedTeam }),
    });
    await refreshUser();
    router.push('/');
  };

  if (!currentUser) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-4">
            <Zap className="w-6 h-6 text-blue-400" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Welcome, {currentUser.name}!</h1>
          <p className="text-sm text-muted-foreground mt-2">Select your team to get started</p>
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Your Team</span>
          </div>

          {teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No teams available. Please contact your admin.</p>
          ) : (
            <div className="space-y-2">
              {teams.map(team => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeam(team.id)}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${
                    selectedTeam === team.id
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                      : 'bg-secondary/50 border-border hover:border-border/80 hover:bg-secondary text-foreground'
                  }`}
                >
                  <span className="text-sm font-medium">{team.name}</span>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={selectTeam}
            disabled={!selectedTeam || saving}
            className="w-full h-11 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all glow-blue"
          >
            {saving ? 'Setting up...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
