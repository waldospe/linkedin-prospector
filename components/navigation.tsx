'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  GitBranch, 
  ListTodo, 
  FileText, 
  BarChart3, 
  Settings, 
  LogOut,
  Linkedin,
  ChevronDown,
  UserPlus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useUser } from '@/components/user-context';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/sequences', label: 'Sequences', icon: GitBranch },
  { href: '/queue', label: 'Queue', icon: ListTodo },
  { href: '/templates', label: 'Templates', icon: FileText },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { users, currentUser, setCurrentUser, isAdmin, loading } = useUser();

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  };

  if (loading || !currentUser) {
    return (
      <nav className="w-64 min-h-screen bg-zinc-900 border-r border-zinc-800 p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-800 rounded" />
          <div className="h-4 bg-zinc-800 rounded" />
        </div>
      </nav>
    );
  }

  return (
    <nav className="w-64 min-h-screen bg-zinc-900 border-r border-zinc-800 p-4 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-6 px-2">
        <Linkedin className="w-8 h-8 text-blue-500" />
        <div>
          <h1 className="font-bold text-white">Unipile Dashboard</h1>
          <p className="text-xs text-zinc-500">LinkedIn Automation</p>
        </div>
      </div>

      {/* User Switcher */}
      <div className="mb-4 px-2">
        <div className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">Acting as</div>
        <div className="relative">
          <select
            value={currentUser.id}
            onChange={(e) => {
              const user = users.find(u => u.id === parseInt(e.target.value));
              if (user) setCurrentUser(user);
            }}
            className="w-full bg-zinc-800 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
          >
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.name} {user.role === 'admin' ? '(Admin)' : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        </div>
        
        {isAdmin && (
          <Link
            href="/users"
            className="flex items-center gap-2 mt-2 text-xs text-blue-400 hover:text-blue-300"
          >
            <UserPlus className="w-3 h-3" />
            Manage Users
          </Link>
        )}
      </div>

      <div className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                pathname === item.href
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </div>

      <Button
        variant="ghost"
        onClick={handleLogout}
        className="w-full justify-start gap-3 text-zinc-400 hover:text-zinc-200"
      >
        <LogOut size={18} />
        Logout
      </Button>
    </nav>
  );
}
