import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default function LoginPage() {
  async function handleLogin(formData: FormData) {
    'use server';
    const password = formData.get('password');
    
    if (password === 'admin') {
      cookies().set('auth', 'true', { httpOnly: true, path: '/' });
      redirect('/');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md p-6 rounded-lg border border-zinc-800 bg-zinc-900">
        <h1 className="text-xl text-white mb-4">LinkedIn Prospector</h1>
        <p className="text-zinc-400 mb-4">Sign in to continue</p>
        
        <form action={handleLogin} className="space-y-4">
          <input
            type="password"
            name="password"
            placeholder="Password"
            className="w-full p-2 rounded bg-zinc-950 border border-zinc-800 text-white"
          />
          <button 
            type="submit"
            className="w-full p-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
