'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Linkedin } from 'lucide-react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSetup, setIsSetup] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/check', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.needsSetup) {
          setIsSetup(true);
          setStatusMsg('Welcome! Create your password below.');
        }
      });
  }, []);

  async function handleLogin() {
    if (!password) return;
    
    setLoading(true);
    setError('');
    setStatusMsg('Creating account...');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, setup: isSetup })
      });

      const data = await res.json();

      if (res.ok) {
        setStatusMsg('Success! Redirecting...');
        window.location.href = '/';
      } else {
        setStatusMsg('');
        setError(data.error || 'Failed');
        if (data.error?.toLowerCase().includes('setup') || data.error?.toLowerCase().includes('no password')) {
          setIsSetup(true);
        }
      }
    } catch (err: any) {
      setStatusMsg('');
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="space-y-1 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Linkedin className="w-6 h-6 text-blue-500" />
            <h1 className="text-xl font-bold text-white">Unipile Dashboard</h1>
          </div>
          <p className="text-zinc-400 text-sm">
            {isSetup ? 'Create your admin password' : 'Enter your password'}
          </p>
        </div>
        
        {statusMsg && (
          <div className="mb-4 p-3 bg-blue-600/20 border border-blue-600/30 rounded-lg">
            <p className="text-blue-400 text-sm">{statusMsg}</p>
          </div>
        )}
        
        <div className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full h-10 rounded-lg border border-zinc-700 bg-zinc-950 text-white px-3 pr-10 text-sm placeholder:text-zinc-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              type="button"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          
          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}
          
          <button 
            onClick={handleLogin}
            disabled={loading || !password}
            className="w-full h-10 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Please wait...' : isSetup ? 'Create Password' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
