'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Megaphone, Users, TrendingUp, MessageCircle, UserCheck, Reply } from 'lucide-react';
import { useUser } from '@/components/user-context';
import { FUNNEL_STAGES, stageColors, STAGE_MAP } from '@/lib/constants';

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [campaign, setCampaign] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { apiQuery } = useUser();

  useEffect(() => {
    Promise.all([
      fetch(`/api/campaigns/${id}${apiQuery}`).then(r => r.json()),
      fetch(`/api/campaigns/${id}/stats${apiQuery}`).then(r => r.json()),
    ]).then(([c, s]) => {
      setCampaign(c);
      setStats(s);
    }).finally(() => setLoading(false));
  }, [id, apiQuery]);

  if (loading) {
    return <div className="space-y-4"><div className="h-8 w-48 bg-secondary rounded animate-pulse" /><div className="h-64 bg-secondary rounded-xl animate-pulse" /></div>;
  }

  if (!campaign) {
    return <div className="t-meta text-red-400">Campaign not found</div>;
  }

  const stagesWithCounts = stats ? FUNNEL_STAGES.filter(s => (stats.byStatus[s.key] || 0) > 0) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/campaigns')} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="h-page">{campaign.name}</h1>
          {campaign.description && <p className="t-meta mt-0.5">{campaign.description}</p>}
        </div>
      </div>

      {stats && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Contacts', value: stats.total, icon: Users, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
              { label: 'Connected', value: stats.connected, icon: UserCheck, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
              { label: 'Replied', value: stats.replied, icon: Reply, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
              { label: 'Connect Rate', value: `${stats.connectRate}%`, icon: TrendingUp, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
              { label: 'Reply Rate', value: `${stats.replyRate}%`, icon: MessageCircle, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="glass rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="t-eyebrow">{label}</span>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${color}`}>
                    <Icon size={14} />
                  </div>
                </div>
                <p className="text-2xl font-semibold text-foreground tabular-nums">{value}</p>
              </div>
            ))}
          </div>

          {/* Completion bar */}
          <div className="glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="h-card">Campaign Progress</span>
              <span className={`text-sm font-medium ${stats.completionPct === 100 ? 'text-emerald-400' : 'text-blue-400'}`}>
                {stats.completionPct}% complete
              </span>
            </div>
            <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${stats.completionPct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                style={{ width: `${stats.completionPct}%` }}
              />
            </div>
            <p className="t-caption mt-2">{stats.queueCompleted} / {stats.queueTotal} actions completed</p>
          </div>

          {/* Stage breakdown */}
          {stagesWithCounts.length > 0 && (
            <div className="glass rounded-xl p-5">
              <h3 className="h-card mb-4">Contact Stages</h3>
              <div className="flex flex-wrap gap-2">
                {stagesWithCounts.map(s => {
                  const cnt = stats.byStatus[s.key] || 0;
                  const pct = stats.total > 0 ? Math.round((cnt / stats.total) * 100) : 0;
                  const colors = stageColors[s.key];
                  return (
                    <div key={s.key} className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border/50 ${colors?.bg || ''}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${colors?.dot}`} />
                      <span className={colors?.text}>{STAGE_MAP[s.key]?.label}</span>
                      <span className="text-foreground font-semibold">{cnt}</span>
                      <span className="text-muted-foreground">({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
