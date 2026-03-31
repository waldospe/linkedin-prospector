'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/user-context';
import {
  Users, Server, Activity, AlertTriangle, CheckCircle2, Clock,
  Database, Zap, Send, MessageCircle, Reply, TrendingUp,
  Linkedin, Shield, BarChart3, RefreshCw, XCircle
} from 'lucide-react';

interface SystemData {
  teams: any[];
  users: any[];
  todayStats: any[];
  totals: any;
  queueStats: any[];
  contactStats: any[];
  recentErrors: any[];
  cronLastRun: string | null;
  cronLogSize: number;
  dbSize: number;
  dailyActivity: any[];
  serverTime: string;
}

export default function AdminPage() {
  const router = useRouter();
  const { isAdmin } = useUser();
  const [data, setData] = useState<SystemData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) { router.push('/'); return; }
    fetchData();
    const interval = setInterval(fetchData, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [isAdmin]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/admin/system');
      if (res.ok) setData(await res.json());
    } finally { setLoading(false); }
  };

  if (!isAdmin || loading || !data) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 bg-secondary rounded-xl animate-pulse" />)}
      </div>
    );
  }

  const queueMap = Object.fromEntries(data.queueStats.map((q: any) => [q.status, q.count]));
  const contactMap = Object.fromEntries(data.contactStats.map((c: any) => [c.status, c.count]));
  const totalContacts = data.contactStats.reduce((s: number, c: any) => s + c.count, 0);
  const totalUsers = data.users.length;
  const linkedUsers = data.users.filter((u: any) => u.unipile_account_id && u.unipile_account_id !== 'pending').length;
  const cronAge = data.cronLastRun ? Math.floor((Date.now() - new Date(data.cronLastRun).getTime()) / 60000) : null;

  const formatBytes = (b: number) => {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">System Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Server time: {new Date(data.serverTime).toLocaleString()} &middot; Auto-refreshing
          </p>
        </div>
        <button onClick={fetchData} className="p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-secondary transition-all">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Top-level metrics */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total Users', value: totalUsers, icon: Users, color: 'blue' },
          { label: 'LinkedIn Linked', value: `${linkedUsers}/${totalUsers}`, icon: Linkedin, color: 'emerald' },
          { label: 'All-time Sends', value: data.totals.total_connections + data.totals.total_messages, icon: Send, color: 'indigo' },
          { label: 'Today\'s Activity', value: data.totals.connections_today + data.totals.messages_today, icon: Activity, color: 'violet' },
          { label: 'Total Contacts', value: totalContacts, icon: Users, color: 'cyan' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
              <Icon size={14} className={`text-${color}-400`} />
            </div>
            <p className="text-2xl font-semibold text-white tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* System Health */}
      <div className="grid grid-cols-3 gap-6">
        {/* Cron Status */}
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-white">Cron Status</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Last activity</span>
              <span className={`text-xs font-medium ${cronAge !== null && cronAge < 5 ? 'text-emerald-400' : 'text-red-400'}`}>
                {cronAge !== null ? (cronAge < 1 ? 'Just now' : `${cronAge} min ago`) : 'Unknown'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Status</span>
              {cronAge !== null && cronAge < 5 ? (
                <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 size={12} /> Healthy</span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-red-400"><AlertTriangle size={12} /> Check cron</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Log size</span>
              <span className="text-xs text-white">{formatBytes(data.cronLogSize)}</span>
            </div>
          </div>
        </div>

        {/* Queue Health */}
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-white">Queue</span>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Pending', count: queueMap.pending || 0, color: 'text-amber-400' },
              { label: 'Completed', count: queueMap.completed || 0, color: 'text-emerald-400' },
              { label: 'Failed', count: queueMap.failed || 0, color: 'text-red-400' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className={`text-sm font-semibold tabular-nums ${color}`}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Database */}
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-white">Database</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">DB size</span>
              <span className="text-xs text-white">{formatBytes(data.dbSize)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Contacts</span>
              <span className="text-xs text-white">{totalContacts}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Queue items</span>
              <span className="text-xs text-white">{(queueMap.pending || 0) + (queueMap.completed || 0) + (queueMap.failed || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Teams */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium text-white">Teams</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {data.teams.map((team: any) => (
            <div key={team.id} className="p-3 rounded-lg bg-secondary/30 border border-border/50">
              <p className="text-sm font-medium text-white">{team.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {team.member_count} members &middot; {team.linked_count} linked
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium text-white">All Users</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground uppercase tracking-wider border-b border-border/50">
                <th className="text-left py-2 pr-4">User</th>
                <th className="text-left py-2 pr-4">Team</th>
                <th className="text-left py-2 pr-4">Role</th>
                <th className="text-center py-2 pr-4">LinkedIn</th>
                <th className="text-right py-2 pr-4">Contacts</th>
                <th className="text-right py-2 pr-4">Pending</th>
                <th className="text-right py-2 pr-4">Sent</th>
                <th className="text-right py-2 pr-4">Failed</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user: any) => {
                const todayStat = data.todayStats.find((s: any) => s.user_id === user.id);
                return (
                  <tr key={user.id} className="border-b border-border/30 hover:bg-secondary/20">
                    <td className="py-2.5 pr-4">
                      <div>
                        <p className="text-white font-medium">{user.name}</p>
                        <p className="text-[11px] text-muted-foreground">{user.email}</p>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-muted-foreground">{user.team_name || '—'}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${user.role === 'admin' ? 'text-blue-400 bg-blue-500/10' : 'text-muted-foreground bg-secondary'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-center">
                      {user.unipile_account_id && user.unipile_account_id !== 'pending' ? (
                        <CheckCircle2 size={14} className="text-emerald-400 mx-auto" />
                      ) : (
                        <XCircle size={14} className="text-muted-foreground mx-auto" />
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-xs text-white tabular-nums">{user.contact_count}</td>
                    <td className="py-2.5 pr-4 text-right text-xs text-amber-400 tabular-nums">{user.pending_queue}</td>
                    <td className="py-2.5 pr-4 text-right text-xs text-emerald-400 tabular-nums">{user.completed_queue}</td>
                    <td className="py-2.5 pr-4 text-right text-xs text-red-400 tabular-nums">{user.failed_queue}</td>
                    <td className="py-2.5">
                      {todayStat ? (
                        <span className="text-[11px] text-muted-foreground">
                          {todayStat.connections_sent}c {todayStat.messages_sent}m today
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">No activity</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Today's Activity Per User */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium text-white">Today&apos;s Sends by User</span>
        </div>
        <div className="space-y-3">
          {data.todayStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity today</p>
          ) : (
            data.todayStats.map((stat: any) => {
              const user = data.users.find((u: any) => u.id === stat.user_id);
              const limit = user?.daily_limit || 20;
              const total = stat.connections_sent + stat.messages_sent;
              const pct = Math.min((total / limit) * 100, 100);
              return (
                <div key={stat.user_id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-white">{stat.user_name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {stat.connections_sent}c + {stat.messages_sent}m = {total}/{limit}
                    </span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Contact Funnel (System-wide) */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium text-white">System-wide Contact Funnel</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {data.contactStats.map((stat: any) => (
            <div key={stat.status} className="p-3 rounded-lg bg-secondary/30">
              <p className="text-xs text-muted-foreground capitalize">{stat.status.replace(/_/g, ' ')}</p>
              <p className="text-lg font-semibold text-white tabular-nums mt-1">{stat.count}</p>
              <p className="text-[10px] text-muted-foreground">{totalContacts > 0 ? ((stat.count / totalContacts) * 100).toFixed(0) : 0}%</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Errors */}
      {data.recentErrors.length > 0 && (
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-red-400" />
            <span className="text-sm font-medium text-white">Recent Errors</span>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-auto">
            {data.recentErrors.map((err: any) => (
              <div key={err.id} className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white font-medium">{err.contact_name}</span>
                  <span className="text-[10px] text-muted-foreground">{err.user_name} &middot; {err.action_type}</span>
                </div>
                <p className="text-xs text-red-400 mt-1 truncate">{err.error}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
