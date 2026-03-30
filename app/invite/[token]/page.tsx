'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Eye, EyeOff, Zap, CheckCircle2, AlertCircle } from 'lucide-react';

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setUser(data);
        }
      })
      .catch(() => setError('Invalid or expired invite link'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async () => {
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/invite/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.push('/login'), 2000);
      } else {
        setError(data.error || 'Failed to set password');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />

      <div className="w-full max-w-sm animate-fade-in relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-4">
            <Zap className="w-6 h-6 text-blue-400" />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">LinkedIn Prospector</h1>
        </div>

        {success ? (
          <div className="glass rounded-2xl p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">You're all set!</h2>
            <p className="text-sm text-muted-foreground">Redirecting to login...</p>
          </div>
        ) : error && !user ? (
          <div className="glass rounded-2xl p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">Invalid Invite</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : user ? (
          <div className="glass rounded-2xl p-6 space-y-5">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Welcome,</p>
              <h2 className="text-lg font-semibold text-white">{user.name}</h2>
              <p className="text-xs text-muted-foreground mt-1">{user.email}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Create Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full h-11 rounded-lg border border-border bg-background/50 text-white px-3.5 pr-10 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                    type="button"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder="Confirm your password"
                  className="w-full h-11 rounded-lg border border-border bg-background/50 text-white px-3.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || !password || !confirmPassword}
              className="w-full h-11 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 glow-blue"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Set Password & Get Started'
              )}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
