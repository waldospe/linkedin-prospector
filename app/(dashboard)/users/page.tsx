'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { useUser } from '@/components/user-context';
import { Plus, Trash2, User, Linkedin, Key, Save, UserCog, X } from 'lucide-react';

interface UserType {
  id: number;
  name: string;
  email: string;
  role: string;
  team_id: number | null;
  unipile_account_id: string | null;
  pipedrive_api_key: string | null;
  daily_limit: number;
  message_delay_min: number;
  message_delay_max: number;
  timezone: string;
  send_schedule: any;
}

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
  'America/Toronto', 'America/Vancouver',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney', 'Pacific/Auckland',
];
const DAY_LABELS: Record<string, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};
const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export default function UsersPage() {
  const router = useRouter();
  const { isAdmin, currentUser } = useUser();
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'user' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFields, setEditFields] = useState<Record<string, any>>({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isAdmin) { router.push('/'); return; }
    fetchUsers();
  }, [isAdmin]);

  const fetchUsers = async () => {
    const res = await fetch('/api/users');
    const data = await res.json();
    if (Array.isArray(data)) setUsers(data);
    setLoading(false);
  };

  const createUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) return;
    const res = await fetch('/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newUser, team_id: currentUser?.team_id }),
    });
    if (res.ok) {
      setNewUser({ name: '', email: '', password: '', role: 'user' });
      setShowAddForm(false);
      fetchUsers();
      showMsg('User created');
    } else {
      const data = await res.json();
      showMsg(data.error || 'Failed');
    }
  };

  const updateUser = async (id: number) => {
    const clean = { ...editFields };
    if (!clean.password) delete clean.password;
    await fetch('/api/users', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...clean }),
    });
    setEditingId(null);
    setEditFields({});
    fetchUsers();
    showMsg('Updated');
  };

  const deleteUser = async (id: number) => {
    if (!confirm('Delete this user and all their data?')) return;
    await fetch('/api/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    fetchUsers();
  };

  const showMsg = (m: string) => { setMessage(m); setTimeout(() => setMessage(''), 3000); };

  const startEdit = (u: UserType) => {
    setEditingId(u.id);
    setEditFields({
      unipile_account_id: u.unipile_account_id || '',
      pipedrive_api_key: u.pipedrive_api_key || '',
      daily_limit: u.daily_limit,
      message_delay_min: u.message_delay_min || 15,
      message_delay_max: u.message_delay_max || 20,
      timezone: u.timezone || 'America/Los_Angeles',
      send_schedule: u.send_schedule || {},
      password: '',
    });
  };

  const updateScheduleDay = (day: string, field: string, value: any) => {
    setEditFields((prev: any) => ({
      ...prev,
      send_schedule: {
        ...prev.send_schedule,
        [day]: { ...(prev.send_schedule?.[day] || { enabled: false, start: '08:00', end: '17:00' }), [field]: value },
      },
    }));
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">{users.length} members</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-all glow-sm"
        >
          {showAddForm ? <X size={15} /> : <Plus size={15} />}
          {showAddForm ? 'Cancel' : 'Add Member'}
        </button>
      </div>

      {message && (
        <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm animate-fade-in">
          {message}
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="glass rounded-xl p-6 animate-slide-up">
          <h3 className="text-sm font-medium text-white mb-4">New Team Member</h3>
          <div className="grid grid-cols-2 gap-3 max-w-xl">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Name</label>
              <Input placeholder="Full name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} className="bg-background/50 border-border h-10" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
              <Input placeholder="email@moco.inc" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="bg-background/50 border-border h-10" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Password</label>
              <Input type="password" placeholder="Initial password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="bg-background/50 border-border h-10" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Role</label>
              <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="w-full h-10 bg-background/50 text-white text-sm rounded-lg px-3 border border-border focus:outline-none focus:border-blue-500/50">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <button onClick={createUser} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-all">
            <Plus size={14} /> Create User
          </button>
        </div>
      )}

      {/* User list */}
      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-secondary rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.id} className="glass glass-hover rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/10 flex items-center justify-center text-sm font-semibold text-blue-300 shrink-0">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white">{user.name}</h3>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                        user.role === 'admin'
                          ? 'text-blue-400 bg-blue-500/10 border-blue-500/15'
                          : 'text-muted-foreground bg-secondary border-border/50'
                      }`}>{user.role}</span>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                        user.unipile_account_id
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/15'
                          : 'text-muted-foreground bg-secondary border-border/50'
                      }`}>
                        <Linkedin size={9} />
                        {user.unipile_account_id ? 'Linked' : 'Not linked'}
                      </span>
                      {user.pipedrive_api_key && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border text-violet-400 bg-violet-500/10 border-violet-500/15">
                          <Key size={9} /> Pipedrive
                        </span>
                      )}
                    </div>

                    {/* Inline edit */}
                    {editingId === user.id && (
                      <div className="mt-4 space-y-3 max-w-md animate-slide-up">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Unipile Account ID</label>
                          <Input value={editFields.unipile_account_id || ''} onChange={(e) => setEditFields({ ...editFields, unipile_account_id: e.target.value })} className="bg-background/50 border-border h-8 text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Pipedrive API Key</label>
                          <Input type="password" value={editFields.pipedrive_api_key || ''} onChange={(e) => setEditFields({ ...editFields, pipedrive_api_key: e.target.value })} className="bg-background/50 border-border h-8 text-sm" />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Daily Limit</label>
                            <Input type="number" value={editFields.daily_limit} onChange={(e) => setEditFields({ ...editFields, daily_limit: parseInt(e.target.value) })} className="bg-background/50 border-border h-8 text-sm" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Min Delay (min)</label>
                            <Input type="number" value={editFields.message_delay_min} onChange={(e) => setEditFields({ ...editFields, message_delay_min: parseInt(e.target.value) })} className="bg-background/50 border-border h-8 text-sm" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Max Delay (min)</label>
                            <Input type="number" value={editFields.message_delay_max} onChange={(e) => setEditFields({ ...editFields, message_delay_max: parseInt(e.target.value) })} className="bg-background/50 border-border h-8 text-sm" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Timezone</label>
                          <select value={editFields.timezone || 'America/Los_Angeles'} onChange={(e) => setEditFields({ ...editFields, timezone: e.target.value })} className="h-8 bg-background/50 text-white text-xs rounded-lg px-2 border border-border focus:outline-none focus:border-blue-500/50 w-full">
                            {TIMEZONES.map(tz => (<option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1.5 block">Send Schedule</label>
                          <div className="space-y-1">
                            {DAY_ORDER.map(day => {
                              const d = editFields.send_schedule?.[day] || { enabled: false, start: '08:00', end: '17:00' };
                              return (
                                <div key={day} className="flex items-center gap-2 p-1.5 rounded-md bg-secondary/30">
                                  <label className="flex items-center gap-1.5 w-14 cursor-pointer">
                                    <input type="checkbox" checked={d.enabled} onChange={(e) => updateScheduleDay(day, 'enabled', e.target.checked)} className="w-3.5 h-3.5 rounded border-border bg-background accent-blue-600" />
                                    <span className={`text-[11px] font-medium ${d.enabled ? 'text-white' : 'text-muted-foreground'}`}>{DAY_LABELS[day]}</span>
                                  </label>
                                  {d.enabled && (
                                    <div className="flex items-center gap-1">
                                      <input type="time" value={d.start} onChange={(e) => updateScheduleDay(day, 'start', e.target.value)} className="h-6 bg-background/50 text-white text-[11px] rounded px-1 border border-border focus:outline-none" />
                                      <span className="text-[10px] text-muted-foreground">-</span>
                                      <input type="time" value={d.end} onChange={(e) => updateScheduleDay(day, 'end', e.target.value)} className="h-6 bg-background/50 text-white text-[11px] rounded px-1 border border-border focus:outline-none" />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Reset Password</label>
                          <Input type="password" value={editFields.password || ''} onChange={(e) => setEditFields({ ...editFields, password: e.target.value })} placeholder="Leave blank to keep" className="bg-background/50 border-border h-8 text-sm" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => updateUser(user.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 transition-all">
                            <Save size={12} /> Save
                          </button>
                          <button onClick={() => { setEditingId(null); setEditFields({}); }} className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-white hover:bg-secondary transition-all">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {editingId !== user.id && (
                    <button onClick={() => startEdit(user)} className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-white hover:bg-secondary transition-all">
                      Edit
                    </button>
                  )}
                  {user.id !== currentUser?.id && (
                    <button onClick={() => deleteUser(user.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
