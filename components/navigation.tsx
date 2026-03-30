'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  GitBranch,
  ListTodo,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Zap,
  UserCog,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const { currentUser, isAdmin, loading, viewAs, setViewAs, teamUsers, viewingUser, isViewingAll } = useUser();

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  };

  // Redirect to onboarding if user has no team (and not already on onboarding page)
  if (currentUser && !currentUser.team_id && pathname !== '/onboarding') {
    router.push('/onboarding');
    return null;
  }

  if (loading || !currentUser) {
    return (
      <nav className="w-[240px] min-h-screen bg-[hsl(228,14%,9%)] border-r border-[hsl(228,11%,15%)] p-4">
        <div className="animate-pulse space-y-3 mt-4">
          <div className="h-6 w-28 bg-[hsl(228,13%,14%)] rounded-md" />
          <div className="mt-8 space-y-1.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-9 bg-[hsl(228,13%,14%)] rounded-lg" />
            ))}
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="w-[240px] min-h-screen bg-[hsl(228,14%,9%)] border-r border-[hsl(228,11%,15%)] p-4 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-5 px-2 pt-1">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <h1 className="text-[13px] font-semibold text-white leading-none tracking-tight">LinkedIn Prospector</h1>
      </div>

      {/* Admin: View-as switcher */}
      {isAdmin && teamUsers.length > 0 && (
        <div className="mb-4 px-1">
          <div className="flex items-center gap-1.5 mb-2">
            <Eye size={11} className="text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Viewing as</span>
          </div>
          <select
            value={viewAs === null ? 'self' : viewAs === 'all' ? 'all' : String(viewAs)}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'self') setViewAs(null);
              else if (v === 'all') setViewAs('all');
              else setViewAs(parseInt(v));
            }}
            className="w-full h-8 bg-[hsl(228,13%,14%)] text-white text-[12px] font-medium rounded-lg px-2.5 border border-[hsl(228,11%,18%)] focus:outline-none focus:border-blue-500/50 cursor-pointer"
          >
            <option value="self">{currentUser.name} (You)</option>
            <option value="all">All Team</option>
            {teamUsers.filter(u => u.id !== currentUser.id).map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          {viewAs !== null && (
            <div className={`mt-1.5 text-[10px] font-medium px-2 py-1 rounded-md ${
              isViewingAll
                ? 'text-violet-400 bg-violet-500/10 border border-violet-500/15'
                : 'text-amber-400 bg-amber-500/10 border border-amber-500/15'
            }`}>
              {isViewingAll ? 'Viewing all team data' : `Viewing as ${viewingUser?.name}`}
            </div>
          )}
        </div>
      )}

      {/* Nav links */}
      <div className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-blue-600/15 text-blue-400"
                  : "text-[hsl(220,10%,60%)] hover:text-white hover:bg-[hsl(228,13%,14%)]"
              )}
            >
              <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
              {item.label}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="h-px bg-[hsl(228,11%,15%)] my-3" />
            <Link
              href="/users"
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
                pathname === '/users'
                  ? "bg-blue-600/15 text-blue-400"
                  : "text-[hsl(220,10%,60%)] hover:text-white hover:bg-[hsl(228,13%,14%)]"
              )}
            >
              <UserCog size={16} strokeWidth={pathname === '/users' ? 2 : 1.5} />
              Team
            </Link>
          </>
        )}
      </div>

      {/* User footer */}
      <div className="border-t border-[hsl(228,11%,15%)] pt-3 mt-3">
        <div className="flex items-center gap-2.5 px-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-[11px] font-semibold text-blue-400 shrink-0">
            {currentUser.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-white truncate leading-tight">{currentUser.name}</p>
            <p className="text-[11px] text-[hsl(220,10%,45%)] truncate">{currentUser.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-[hsl(220,10%,50%)] hover:text-white hover:bg-[hsl(228,13%,14%)] transition-colors w-full"
        >
          <LogOut size={15} strokeWidth={1.5} />
          Sign out
        </button>
      </div>
    </nav>
  );
}
