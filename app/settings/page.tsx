'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Key, Clock, Shield } from 'lucide-react';

interface Config {
  unipile_api_key: string;
  unipile_dsn: string;
  pipedrive_api_key: string;
  daily_limit: number;
  message_delay_min: number;
  message_delay_max: number;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<Config>({
    unipile_api_key: '',
    unipile_dsn: '',
    pipedrive_api_key: '',
    daily_limit: 20,
    message_delay_min: 15,
    message_delay_max: 20
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setConfig(data);
    } catch (error) {
      console.error('Failed to fetch config:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      setMessage('Settings saved successfully');
    } catch (error) {
      setMessage('Failed to save settings');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-zinc-400 mt-1">Configure Unipile and automation settings</p>
      </div>

      {message && (
        <div className={`p-3 rounded ${message.includes('success') ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
          {message}
        </div>
      )}

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Key size={18} /> API Configuration
          </CardTitle>
          <CardDescription className="text-zinc-500">Connect your Unipile and Pipedrive accounts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-zinc-300">Unipile API Key</Label>
            <Input
              type="password"
              value={config.unipile_api_key || ''}
              onChange={(e) => setConfig({ ...config, unipile_api_key: e.target.value })}
              placeholder="jDxsfHNE..."
              className="bg-zinc-950 border-zinc-800 mt-1"
            />
          </div>
          <div>
            <Label className="text-zinc-300">Unipile DSN</Label>
            <Input
              value={config.unipile_dsn || ''}
              onChange={(e) => setConfig({ ...config, unipile_dsn: e.target.value })}
              placeholder="api21.unipile.com:15135"
              className="bg-zinc-950 border-zinc-800 mt-1"
            />
          </div>
          <div>
            <Label className="text-zinc-300">Pipedrive API Key</Label>
            <Input
              type="password"
              value={config.pipedrive_api_key || ''}
              onChange={(e) => setConfig({ ...config, pipedrive_api_key: e.target.value })}
              placeholder="fb7a5470..."
              className="bg-zinc-950 border-zinc-800 mt-1"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield size={18} /> Daily Limits
          </CardTitle>
          <CardDescription className="text-zinc-500">Set automation limits to stay within LinkedIn guidelines</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-zinc-300">Daily Action Limit</Label>
            <Input
              type="number"
              value={config.daily_limit}
              onChange={(e) => setConfig({ ...config, daily_limit: parseInt(e.target.value) })}
              className="bg-zinc-950 border-zinc-800 mt-1"
            />
            <p className="text-xs text-zinc-500 mt-1">Maximum connections + messages per day</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Clock size={18} /> Timing Controls
          </CardTitle>
          <CardDescription className="text-zinc-500">Configure delays between actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-zinc-300">Min Delay (minutes)</Label>
              <Input
                type="number"
                value={config.message_delay_min}
                onChange={(e) => setConfig({ ...config, message_delay_min: parseInt(e.target.value) })}
                className="bg-zinc-950 border-zinc-800 mt-1"
              />
            </div>
            <div>
              <Label className="text-zinc-300">Max Delay (minutes)</Label>
              <Input
                type="number"
                value={config.message_delay_max}
                onChange={(e) => setConfig({ ...config, message_delay_max: parseInt(e.target.value) })}
                className="bg-zinc-950 border-zinc-800 mt-1"
              />
            </div>
          </div>
          <p className="text-xs text-zinc-500">Random delay between actions to appear more natural</p>
        </CardContent>
      </Card>

      <Button 
        onClick={saveConfig} 
        disabled={saving}
        className="bg-blue-600 hover:bg-blue-700"
      >
        <Save className="w-4 h-4 mr-2" />
        {saving ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  );
}
