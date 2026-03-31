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
  Server,
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

  // Redirect to onboarding if user has no team
  if (currentUser && !currentUser.team_id && pathname !== '/onboarding') {
    router.push('/onboarding');
    return null;
  }

  if (loading || !currentUser) {
    return (
      <nav className="w-[250px] min-h-screen bg-[hsl(230,15%,6.5%)] border-r border-[hsl(230,10%,12%)] p-5">
        <div className="animate-pulse space-y-4 mt-4">
          <div className="h-8 w-24 bg-[hsl(230,12%,12%)] rounded-lg" />
          <div className="mt-10 space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-9 bg-[hsl(230,12%,12%)] rounded-lg" />
            ))}
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="w-[250px] min-h-screen border-r border-[hsl(230,10%,12%)] p-5 flex flex-col relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, hsl(230 15% 7%) 0%, hsl(230 15% 5.5%) 100%)' }}>

      {/* Subtle gradient accent at top */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-blue-500/[0.03] to-transparent pointer-events-none" />

      {/* Logo */}
      <div className="flex items-center gap-3 mb-8 px-1 pt-1 relative">
        <div className="w-9 h-9 rounded-xl gradient-blue flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Zap className="w-[18px] h-[18px] text-white" />
        </div>
        <div>
          <h1 className="text-[13px] font-semibold text-white leading-none tracking-tight">LinkedIn Prospector</h1>
          <p className="text-[10px] text-[hsl(220,10%,40%)] mt-0.5 font-medium">Campaign Automation</p>
        </div>
      </div>

      {/* Admin: View-as switcher */}
      {isAdmin && teamUsers.length > 0 && (
        <div className="mb-5 px-1 relative">
          <div className="flex items-center gap-1.5 mb-2">
            <Eye size={10} className="text-[hsl(220,10%,40%)]" />
            <span className="text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-widest">Viewing as</span>
          </div>
          <select
            value={viewAs === null ? 'self' : viewAs === 'all' ? 'all' : String(viewAs)}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'self') setViewAs(null);
              else if (v === 'all') setViewAs('all');
              else setViewAs(parseInt(v));
            }}
            className="w-full h-8 bg-[hsl(230,12%,10%)] text-white text-[12px] font-medium rounded-lg px-2.5 border border-[hsl(230,10%,15%)] focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 cursor-pointer transition-all"
          >
            <option value="self">{currentUser.name} (You)</option>
            <option value="all">All Team</option>
            {teamUsers.filter(u => u.id !== currentUser.id).map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          {viewAs !== null && (
            <div className={`mt-2 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg ${
              isViewingAll
                ? 'text-violet-300 bg-violet-500/10 border border-violet-500/15'
                : 'text-amber-300 bg-amber-500/10 border border-amber-500/15'
            }`}>
              {isViewingAll ? '● Viewing all team data' : `● Viewing as ${viewingUser?.name}`}
            </div>
          )}
        </div>
      )}

      {/* Nav links */}
      <div className="flex-1 space-y-0.5 relative">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-[9px] rounded-xl text-[13px] font-medium transition-all duration-200 relative",
                isActive
                  ? "bg-blue-500/[0.12] text-blue-400 shadow-sm shadow-blue-500/5"
                  : "text-[hsl(220,10%,55%)] hover:text-white hover:bg-white/[0.04]"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-blue-500 shadow-sm shadow-blue-500/50" />
              )}
              <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
              {item.label}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="h-px bg-gradient-to-r from-transparent via-[hsl(230,10%,15%)] to-transparent my-4" />
            <Link
              href="/users"
              className={cn(
                "flex items-center gap-2.5 px-3 py-[9px] rounded-xl text-[13px] font-medium transition-all duration-200 relative",
                pathname === '/users'
                  ? "bg-blue-500/[0.12] text-blue-400"
                  : "text-[hsl(220,10%,55%)] hover:text-white hover:bg-white/[0.04]"
              )}
            >
              {pathname === '/users' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-blue-500" />}
              <UserCog size={16} strokeWidth={pathname === '/users' ? 2 : 1.5} />
              Team
            </Link>
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-2.5 px-3 py-[9px] rounded-xl text-[13px] font-medium transition-all duration-200 relative",
                pathname === '/admin'
                  ? "bg-blue-500/[0.12] text-blue-400"
                  : "text-[hsl(220,10%,55%)] hover:text-white hover:bg-white/[0.04]"
              )}
            >
              {pathname === '/admin' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-blue-500" />}
              <Server size={16} strokeWidth={pathname === '/admin' ? 2 : 1.5} />
              Admin
            </Link>
          </>
        )}
      </div>

      {/* User footer */}
      <div className="border-t border-[hsl(230,10%,12%)] pt-4 mt-4 relative">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/25 to-violet-500/25 border border-blue-500/20 flex items-center justify-center text-[11px] font-bold text-blue-300 shrink-0">
            {currentUser.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-white truncate leading-tight">{currentUser.name}</p>
            <p className="text-[10px] text-[hsl(220,10%,40%)] truncate">{currentUser.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-[hsl(220,10%,45%)] hover:text-white hover:bg-white/[0.04] transition-all duration-200 w-full"
        >
          <LogOut size={15} strokeWidth={1.5} />
          Sign out
        </button>
      </div>
    </nav>
  );
}
