'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useUser } from '@/components/user-context';
import { Save, Key, Clock, Shield, Lock, CheckCircle2 } from 'lucide-react';

interface Config {
  unipile_api_key?: string;
  unipile_dsn?: string;
  pipedrive_api_key: string;
  daily_limit: number;
  message_delay_min: number;
  message_delay_max: number;
}

export default function SettingsPage() {
  const { isAdmin } = useUser();
  const [config, setConfig] = useState<Config>({
    pipedrive_api_key: '',
    daily_limit: 20,
    message_delay_min: 15,
    message_delay_max: 20,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { fetchConfig(); }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      setConfig(await res.json());
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
