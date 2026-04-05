'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, ArrowRight, Zap } from 'lucide-react';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [teams, setTeams] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [newTeamName, setNewTeamName] = useState('');

  useEffect(() => {
    if (mode === 'signup') {
      fetch('/api/teams').then(r => r.json()).then(data => {
        if (Array.isArray(data)) setTeams(data);
      }).catch(() => {});
    }
  }, [mode]);

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.previousLogin) {
          try { localStorage.setItem('lp-previous-login', data.previousLogin); } catch {}
        }
        window.location.href = '/';
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err: any) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup() {
    if (!name || !email || !password) return;
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (selectedTeam === '__new__' && !newTeamName.trim()) { setError('Enter a team name'); return; }
    setLoading(true);
    setError('');
    try {
      const payload: any = { name, email, password };
      if (selectedTeam === '__new__' && newTeamName.trim()) {
        payload.new_team_name = newTeamName.trim();
      } else if (selectedTeam && selectedTeam !== '__new__') {
        payload.team_id = parseInt(selectedTeam);
      }

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        window.location.href = '/';
      } else {
        setError(data.error || 'Signup failed');
      }
    } catch (err: any) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden main-gradient">
      <div className="absolute top-[-20%] left-[30%] w-[500px] h-[500px] bg-blue-500/[0.04] rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[20%] w-[400px] h-[400px] bg-violet-500/[0.03] rounded-full blur-[80px]" />

      <div className="w-full max-w-[380px] animate-fade-in relative">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl gradient-blue shadow-lg shadow-blue-500/20 mb-5">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-[26px] font-bold text-foreground tracking-tight">LinkedIn Prospector</h1>
          <p className="text-[14px] text-muted-foreground mt-1.5 font-light">
            {mode === 'login' ? 'Sign in to manage your campaigns' : 'Create your account'}
          </p>
        </div>

        <div className="glass rounded-2xl p-7 space-y-5">
          <div className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Name</label>
                <input
                  type="text"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 rounded-lg border border-border bg-background/50 text-foreground px-3.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Email</label>
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleSignup())}
                className="w-full h-11 rounded-lg border border-border bg-background/50 text-foreground px-3.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleSignup())}
                  className="w-full h-11 rounded-lg border border-border bg-background/50 text-foreground px-3.5 pr-10 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  type="button"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {mode === 'signup' && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Team</label>
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="w-full h-11 rounded-lg border border-border bg-background/50 text-foreground px-3 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
                >
                  <option value="">Select a team</option>
                  {teams.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
                  <option value="__new__">+ Create a new team</option>
                </select>
                {selectedTeam === '__new__' && (
                  <input
                    type="text"
                    placeholder="Enter your team name"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="w-full h-11 rounded-lg border border-border bg-background/50 text-foreground px-3.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500/50 transition-all mt-2"
                  />
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {mode === 'login' && !forgotMode && (
            <button onClick={() => setForgotMode(true)} className="text-xs text-muted-foreground hover:text-blue-400 transition-colors self-end">
              Forgot password?
            </button>
          )}

          {forgotMode ? (
            <>
              {forgotSent ? (
                <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-emerald-400 text-sm">If that email exists, a reset link has been sent. Check your inbox.</p>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    if (!email) { setError('Enter your email first'); return; }
                    setLoading(true);
                    await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
                    setForgotSent(true);
                    setLoading(false);
                  }}
                  disabled={loading || !email}
                  className="w-full h-11 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-40 transition-all"
                >
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Send Reset Link'}
                </button>
              )}
              <button onClick={() => { setForgotMode(false); setForgotSent(false); setError(''); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center">
                Back to sign in
              </button>
            </>
          ) : (
          <button
            onClick={mode === 'login' ? handleLogin : handleSignup}
            disabled={loading || !email || !password || (mode === 'signup' && !name)}
            className="w-full h-12 rounded-xl btn-primary text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
                <ArrowRight size={16} />
              </>
            )}
          </button>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button onClick={() => { setMode('signup'); setError(''); }} className="text-blue-400 hover:text-blue-300 transition-colors">
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button onClick={() => { setMode('login'); setError(''); }} className="text-blue-400 hover:text-blue-300 transition-colors">
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
