'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useUser } from '@/components/user-context';
import { useOnboarding } from '@/components/onboarding-tracker';
import { Save, Key, Clock, Shield, Lock, CheckCircle2, Globe, Calendar, Linkedin, Eye, EyeOff, Mail, Flame } from 'lucide-react';

function WarmupCard() {
  const [warmupStatus, setWarmupStatus] = useState<any>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    fetch('/api/warmup').then(r => r.json()).then(setWarmupStatus).catch(() => {});
  }, []);

  const toggle = async (enabled: boolean) => {
    setToggling(true);
    await fetch('/api/warmup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) });
    const res = await fetch('/api/warmup');
    setWarmupStatus(await res.json());
    setToggling(false);
  };

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/15 flex items-center justify-center">
          <Flame size={14} className="text-orange-400" />
        </div>
        <div className="flex-1">
          <h3 className="h-card">Account Warmup</h3>
          <p className="t-caption">Gradually ramp connection requests to protect your LinkedIn account</p>
        </div>
        <button
          onClick={() => toggle(!warmupStatus?.enabled)}
          disabled={toggling}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            warmupStatus?.enabled
              ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20'
              : 'bg-secondary text-muted-foreground border border-border hover:text-foreground'
          }`}
        >
          {toggling ? 'Saving...' : warmupStatus?.enabled ? 'Enabled' : 'Enable'}
        </button>
      </div>
      {warmupStatus?.enabled && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="t-caption">Day {warmupStatus.daysSinceStart} of warmup</span>
            <span className="text-sm font-medium text-foreground">
              {warmupStatus.currentLimit} / {warmupStatus.maxLimit} per day
            </span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${warmupStatus.complete ? 'bg-emerald-500' : 'bg-orange-500'}`}
              style={{ width: `${Math.round((warmupStatus.currentLimit / warmupStatus.maxLimit) * 100)}%` }}
            />
          </div>
          <p className="t-caption">
            {warmupStatus.complete
              ? 'Warmup complete — sending at full daily limit.'
              : `Ramping by 3/day. Full limit in ~${Math.ceil((warmupStatus.maxLimit - warmupStatus.currentLimit) / 3)} days.`}
          </p>
        </div>
      )}
      {!warmupStatus?.enabled && (
        <p className="t-caption">
          Recommended for new LinkedIn accounts or after a period of inactivity. Starts at 5 connections/day and increases by 3 each day until reaching your daily limit.
        </p>
      )}
    </div>
  );
}

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
];

const DAY_LABELS: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};
const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

interface SendDay {
  enabled: boolean;
  start: string;
  end: string;
}

interface Config {
  unipile_api_key?: string;
  unipile_dsn?: string;
  pipedrive_api_key: string;
  daily_limit: number;
  message_delay_min: number;
  message_delay_max: number;
  timezone: string;
  send_schedule: Record<string, SendDay>;
  email_daily_digest?: number;
  email_reply_alerts?: number;
  digest_send_hour?: number;
}

const defaultSchedule: Record<string, SendDay> = {
  mon: { enabled: true, start: '08:00', end: '17:00' },
  tue: { enabled: true, start: '08:00', end: '17:00' },
  wed: { enabled: true, start: '08:00', end: '17:00' },
  thu: { enabled: true, start: '08:00', end: '17:00' },
  fri: { enabled: true, start: '08:00', end: '17:00' },
  sat: { enabled: false, start: '08:00', end: '12:00' },
  sun: { enabled: false, start: '08:00', end: '12:00' },
};

export default function SettingsPage() {
  const { isAdmin, currentUser } = useUser();
  const { refresh: refreshOnboarding } = useOnboarding();
  const [config, setConfig] = useState<Config>({
    pipedrive_api_key: '',
    daily_limit: 20,
    message_delay_min: 15,
    message_delay_max: 20,
    timezone: 'America/Los_Angeles',
    send_schedule: defaultSchedule,
    email_daily_digest: 1,
    email_reply_alerts: 1,
    digest_send_hour: 8,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => { fetchConfig(); }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setConfig({
        ...data,
        send_schedule: data.send_schedule || defaultSchedule,
        timezone: data.timezone || 'America/Los_Angeles',
      });
    } finally { setLoading(false); }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      setMessage('Settings saved successfully');
      refreshOnboarding();
    } catch {
      setMessage('Failed to save settings');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const updateDay = (day: string, field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      send_schedule: {
        ...prev.send_schedule,
        [day]: { ...prev.send_schedule[day], [field]: value },
      },
    }));
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword) return;
    if (newPassword.length < 6) { setMessage('New password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setMessage('Passwords do not match'); return; }
    setChangingPassword(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMessage(data.error || 'Failed to change password');
      }
    } catch {
      setMessage('Failed to change password');
    } finally {
      setChangingPassword(false);
      setTimeout(() => setMessage(''), 4000);
    }
  };

  const [activeSection, setActiveSection] = useState('account');

  const sections: Array<{ key: string; label: string; adminOnly?: boolean }> = [
    { key: 'account', label: 'Account' },
    { key: 'sending', label: 'Sending' },
    { key: 'integrations', label: 'Integrations' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'security', label: 'Security' },
    ...(isAdmin ? [{ key: 'admin', label: 'Admin', adminOnly: true }] : []),
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-secondary rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="h-page">Settings</h1>
        <p className="t-meta mt-1">
          {isAdmin ? 'Manage global and personal configuration' : 'Your personal settings'}
        </p>
      </div>

      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl ${
          message.includes('success')
            ? 'bg-emerald-500/10 border border-emerald-500/20'
            : 'bg-red-500/10 border border-red-500/20'
        } animate-fade-in`}>
          <CheckCircle2 size={15} className={message.includes('success') ? 'text-emerald-400' : 'text-red-400'} />
          <p className={`text-sm ${message.includes('success') ? 'text-emerald-400' : 'text-red-400'}`}>{message}</p>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Section nav */}
        <aside className="col-span-12 md:col-span-3">
          <nav className="flex md:flex-col gap-1 sticky top-3">
            {sections.map((s) => (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                  activeSection === s.key
                    ? 'bg-blue-500/[0.12] text-blue-400 font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Section content */}
        <div className="col-span-12 md:col-span-9 space-y-6">

      {/* ============ ACCOUNT ============ */}
      {activeSection === 'account' && (<>
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/15 flex items-center justify-center">
            <Globe size={14} className="text-cyan-400" />
          </div>
          <div>
            <h3 className="h-card">Timezone</h3>
            <p className="t-caption">Used for your send schedule window</p>
          </div>
        </div>
        <select
          value={config.timezone}
          onChange={(e) => setConfig({ ...config, timezone: e.target.value })}
          className="h-10 bg-background/50 text-foreground text-sm rounded-lg px-3 border border-border focus:outline-none focus:border-blue-500/50 w-64"
        >
          {TIMEZONES.map(tz => (
            <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>
      </>)}

      {/* ============ ADMIN ============ */}
      {activeSection === 'admin' && isAdmin && (
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/15 flex items-center justify-center">
              <Lock size={14} className="text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground">Unipile Configuration</h3>
              <p className="text-xs text-muted-foreground">Global API credentials for all team members</p>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/15 ml-auto">
              Admin
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">API Key</label>
              <Input type="password" value={config.unipile_api_key || ''} onChange={(e) => setConfig({ ...config, unipile_api_key: e.target.value })} placeholder="Enter API key..." className="bg-background/50 border-border h-10" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">DSN</label>
              <Input value={config.unipile_dsn || ''} onChange={(e) => setConfig({ ...config, unipile_dsn: e.target.value })} placeholder="api21.unipile.com:15135" className="bg-background/50 border-border h-10" />
            </div>
          </div>
        </div>
      )}

      {/* LinkedIn Connection */}
      {activeSection === 'account' && (
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/15 flex items-center justify-center">
            <Linkedin size={14} className="text-blue-400" />
          </div>
          <div>
            <h3 className="h-card">LinkedIn Connection</h3>
            <p className="t-caption">Connect your LinkedIn account for outreach</p>
          </div>
        </div>
        {currentUser?.unipile_account_id && currentUser.unipile_account_id !== 'pending' ? (
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <CheckCircle2 size={16} />
            LinkedIn connected
          </div>
        ) : (
          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/unipile/connect', { method: 'POST' });
                const data = await res.json();
                if (data.url) {
                  window.open(data.url, '_blank');
                } else {
                  setMessage(data.error || 'Failed to generate connection link');
                }
              } catch {
                setMessage('Failed to connect');
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-all glow-sm"
          >
            <Linkedin size={15} />
            Connect LinkedIn
          </button>
        )}
      </div>
      )}

      {/* Pipedrive */}
      {activeSection === 'integrations' && (
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/15 flex items-center justify-center">
            <Key size={14} className="text-violet-400" />
          </div>
          <div>
            <h3 className="h-card">Pipedrive Integration</h3>
            <p className="t-caption">Your personal API key for contact sync</p>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">API Key</label>
          <Input type="password" value={config.pipedrive_api_key || ''} onChange={(e) => setConfig({ ...config, pipedrive_api_key: e.target.value })} placeholder="Enter your Pipedrive API key..." className="bg-background/50 border-border h-10 max-w-md" />
        </div>
      </div>
      )}

      {/* Email Notifications */}
      {activeSection === 'notifications' && (
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
            <Mail size={14} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">Email Notifications</h3>
            <p className="text-xs text-muted-foreground">Stay on top of replies and daily activity</p>
          </div>
        </div>
        <div className="space-y-4 max-w-md">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!config.email_reply_alerts}
              onChange={(e) => setConfig({ ...config, email_reply_alerts: e.target.checked ? 1 : 0 })}
              className="w-4 h-4 mt-0.5 rounded border-border bg-background accent-blue-600 shrink-0"
            />
            <div>
              <p className="text-sm font-medium text-foreground">Instant reply alerts</p>
              <p className="text-xs text-muted-foreground mt-0.5">Email me the moment someone replies on LinkedIn</p>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!config.email_daily_digest}
              onChange={(e) => setConfig({ ...config, email_daily_digest: e.target.checked ? 1 : 0 })}
              className="w-4 h-4 mt-0.5 rounded border-border bg-background accent-blue-600 shrink-0"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Daily morning digest</p>
              <p className="text-xs text-muted-foreground mt-0.5">Yesterday's activity + today's queue, delivered to your inbox</p>
              {config.email_daily_digest ? (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-muted-foreground">Send at</span>
                  <select
                    value={config.digest_send_hour || 8}
                    onChange={(e) => setConfig({ ...config, digest_send_hour: parseInt(e.target.value) })}
                    className="h-7 bg-background/50 text-foreground text-xs rounded-lg px-2 border border-border focus:outline-none focus:border-blue-500/50"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>
                    ))}
                  </select>
                  <span className="text-xs text-muted-foreground">({config.timezone.replace(/_/g, ' ')})</span>
                </div>
              ) : null}
            </div>
          </label>
        </div>
      </div>
      )}

      {/* Send Schedule */}
      {activeSection === 'sending' && (
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center">
            <Calendar size={14} className="text-indigo-400" />
          </div>
          <div>
            <h3 className="h-card">Send Schedule</h3>
            <p className="t-caption">When the queue is allowed to send messages</p>
          </div>
        </div>
        <div className="space-y-2">
          {DAY_ORDER.map(day => {
            const d = config.send_schedule[day] || { enabled: false, start: '08:00', end: '17:00' };
            return (
              <div key={day} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                <label className="flex items-center gap-2 w-28 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={d.enabled}
                    onChange={(e) => updateDay(day, 'enabled', e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-background accent-blue-600"
                  />
                  <span className={`text-sm font-medium ${d.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {DAY_LABELS[day]}
                  </span>
                </label>
                {d.enabled && (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={d.start}
                      onChange={(e) => updateDay(day, 'start', e.target.value)}
                      className="h-8 bg-background/50 text-foreground text-sm rounded-lg px-2 border border-border focus:outline-none focus:border-blue-500/50"
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <input
                      type="time"
                      value={d.end}
                      onChange={(e) => updateDay(day, 'end', e.target.value)}
                      className="h-8 bg-background/50 text-foreground text-sm rounded-lg px-2 border border-border focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                )}
                {!d.enabled && (
                  <span className="text-xs text-muted-foreground">Off</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Daily limits */}
      {activeSection === 'sending' && (
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/15 flex items-center justify-center">
            <Shield size={14} className="text-blue-400" />
          </div>
          <div>
            <h3 className="h-card">Daily Limits</h3>
            <p className="t-caption">Stay within LinkedIn safety guidelines</p>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Max Connection Requests Per Day</label>
          <Input type="number" value={config.daily_limit} onChange={(e) => setConfig({ ...config, daily_limit: parseInt(e.target.value) })} className="bg-background/50 border-border h-10 w-32" />
          <p className="text-xs text-muted-foreground mt-1.5">Connection requests per day (messages are unlimited)</p>
        </div>
      </div>
      )}

      {/* Warmup */}
      {activeSection === 'sending' && (
      <WarmupCard />
      )}

      {/* Timing */}
      {activeSection === 'sending' && (
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
            <Clock size={14} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="h-card">Timing Controls</h3>
            <p className="t-caption">Randomized delays between actions</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 max-w-sm">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Min Delay (min)</label>
            <Input type="number" value={config.message_delay_min} onChange={(e) => setConfig({ ...config, message_delay_min: parseInt(e.target.value) })} className="bg-background/50 border-border h-10" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Max Delay (min)</label>
            <Input type="number" value={config.message_delay_max} onChange={(e) => setConfig({ ...config, message_delay_max: parseInt(e.target.value) })} className="bg-background/50 border-border h-10" />
          </div>
        </div>
      </div>
      )}

      {/* Change Password */}
      {activeSection === 'security' && (
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/15 flex items-center justify-center">
            <Key size={14} className="text-amber-400" />
          </div>
          <div>
            <h3 className="h-card">Change Password</h3>
            <p className="t-caption">Update your login password</p>
          </div>
        </div>
        <div className="space-y-3 max-w-sm">
          <div className="relative">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Current Password</label>
            <Input
              type={showPasswords ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="bg-background/50 border-border h-10 pr-10"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">New Password</label>
            <Input
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="bg-background/50 border-border h-10"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Confirm New Password</label>
            <Input
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="bg-background/50 border-border h-10"
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={changePassword}
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 disabled:opacity-40 transition-all"
            >
              <Lock size={14} />
              {changingPassword ? 'Changing...' : 'Change Password'}
            </button>
            <button
              onClick={() => setShowPasswords(!showPasswords)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
              title={showPasswords ? 'Hide passwords' : 'Show passwords'}
            >
              {showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
      </div>
      )}

        </div> {/* /section content */}
      </div> {/* /grid */}

      {/* Sticky save bar — applies to every section except security (password has its own button) */}
      {activeSection !== 'security' && (
        <div className="fixed bottom-0 left-[250px] right-0 bg-background/80 backdrop-blur-md border-t border-border z-20">
          <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-end gap-3">
            <span className="t-caption">Changes apply to your settings only.</span>
            <button
              onClick={saveConfig}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-40 transition-all glow-sm"
            >
              <Save size={15} />
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
