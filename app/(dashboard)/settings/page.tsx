'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useUser } from '@/components/user-context';
import { Save, Key, Clock, Shield, Lock, CheckCircle2, Globe, Calendar, Linkedin } from 'lucide-react';

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
  const [config, setConfig] = useState<Config>({
    pipedrive_api_key: '',
    daily_limit: 20,
    message_delay_min: 15,
    message_delay_max: 20,
    timezone: 'America/Los_Angeles',
    send_schedule: defaultSchedule,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

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

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-secondary rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
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

      {/* Admin-only: Unipile */}
      {isAdmin && (
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/15 flex items-center justify-center">
              <Lock size={14} className="text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">Unipile Configuration</h3>
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
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/15 flex items-center justify-center">
            <Linkedin size={14} className="text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">LinkedIn Connection</h3>
            <p className="text-xs text-muted-foreground">Connect your LinkedIn account for outreach</p>
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

      {/* Pipedrive */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/15 flex items-center justify-center">
            <Key size={14} className="text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Pipedrive Integration</h3>
            <p className="text-xs text-muted-foreground">Your personal API key for contact sync</p>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">API Key</label>
          <Input type="password" value={config.pipedrive_api_key || ''} onChange={(e) => setConfig({ ...config, pipedrive_api_key: e.target.value })} placeholder="Enter your Pipedrive API key..." className="bg-background/50 border-border h-10 max-w-md" />
        </div>
      </div>

      {/* Timezone */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/15 flex items-center justify-center">
            <Globe size={14} className="text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Timezone</h3>
            <p className="text-xs text-muted-foreground">Used for your send schedule window</p>
          </div>
        </div>
        <select
          value={config.timezone}
          onChange={(e) => setConfig({ ...config, timezone: e.target.value })}
          className="h-10 bg-background/50 text-white text-sm rounded-lg px-3 border border-border focus:outline-none focus:border-blue-500/50 w-64"
        >
          {TIMEZONES.map(tz => (
            <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Send Schedule */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center">
            <Calendar size={14} className="text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Send Schedule</h3>
            <p className="text-xs text-muted-foreground">When the queue is allowed to send messages</p>
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
                  <span className={`text-sm font-medium ${d.enabled ? 'text-white' : 'text-muted-foreground'}`}>
                    {DAY_LABELS[day]}
                  </span>
                </label>
                {d.enabled && (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={d.start}
                      onChange={(e) => updateDay(day, 'start', e.target.value)}
                      className="h-8 bg-background/50 text-white text-sm rounded-lg px-2 border border-border focus:outline-none focus:border-blue-500/50"
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <input
                      type="time"
                      value={d.end}
                      onChange={(e) => updateDay(day, 'end', e.target.value)}
                      className="h-8 bg-background/50 text-white text-sm rounded-lg px-2 border border-border focus:outline-none focus:border-blue-500/50"
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

      {/* Daily limits */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/15 flex items-center justify-center">
            <Shield size={14} className="text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Daily Limits</h3>
            <p className="text-xs text-muted-foreground">Stay within LinkedIn safety guidelines</p>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Max Actions Per Day</label>
          <Input type="number" value={config.daily_limit} onChange={(e) => setConfig({ ...config, daily_limit: parseInt(e.target.value) })} className="bg-background/50 border-border h-10 w-32" />
          <p className="text-xs text-muted-foreground mt-1.5">Total connections + messages per day</p>
        </div>
      </div>

      {/* Timing */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
            <Clock size={14} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Timing Controls</h3>
            <p className="text-xs text-muted-foreground">Randomized delays between actions</p>
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

      <button
        onClick={saveConfig}
        disabled={saving}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-40 transition-all glow-sm"
      >
        <Save size={15} />
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
