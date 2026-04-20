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
  Search,
  ScrollText,
  Sun,
  Moon,
  Inbox,
  Megaphone,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/components/user-context';
import { useTheme } from '@/components/theme-provider';
import { OnboardingSidebar } from '@/components/onboarding-tracker';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/sequences', label: 'Sequences', icon: GitBranch },
  { href: '/queue', label: 'Queue', icon: ListTodo },
  { href: '/templates', label: 'Templates', icon: FileText },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/activity', label: 'Activity', icon: ScrollText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, isAdmin, loading, viewAs, setViewAs, teamUsers, viewingUser, isViewingAll } = useUser();
  const { theme, toggleTheme } = useTheme();

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
      <nav className="w-[250px] min-h-screen bg-[hsl(var(--sidebar))] border-r border-border p-5">
        <div className="animate-pulse space-y-4 mt-4">
          <div className="h-8 w-24 bg-secondary rounded-lg" />
          <div className="mt-10 space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-9 bg-secondary rounded-lg" />
            ))}
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="w-[250px] min-h-screen border-r border-border p-5 flex flex-col relative overflow-hidden bg-[hsl(var(--sidebar))]">

      {/* Subtle gradient accent at top */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-blue-500/[0.03] to-transparent pointer-events-none" />

      {/* Logo */}
      <div className="flex items-center gap-3 mb-8 px-1 pt-1 relative">
        <div className="w-9 h-9 rounded-xl gradient-blue flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Zap className="w-[18px] h-[18px] text-foreground" />
        </div>
        <div>
          <h1 className="text-[13px] font-semibold text-foreground leading-none tracking-tight">LinkedIn Prospector</h1>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">Campaign Automation</p>
        </div>
      </div>

      {/* Admin: View-as switcher */}
      {isAdmin && teamUsers.length > 0 && (
        <div className="mb-5 px-1 relative">
          <div className="flex items-center gap-1.5 mb-2">
            <Eye size={10} className="text-muted-foreground" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Viewing as</span>
          </div>
          <select
            value={viewAs === null ? 'self' : viewAs === 'all' ? 'all' : String(viewAs)}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'self') setViewAs(null);
              else if (v === 'all') setViewAs('all');
              else setViewAs(parseInt(v));
            }}
            className="w-full h-8 bg-secondary text-foreground text-[12px] font-medium rounded-lg px-2.5 border border-border focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 cursor-pointer transition-all"
          >
            <option value="self">{currentUser.name} (You)</option>
            <option value="all">All Users</option>
            {(() => {
              const grouped = new Map<string, typeof teamUsers>();
              teamUsers.filter(u => u.id !== currentUser.id).forEach(u => {
                const key = String((u as any).team_id || 'none');
                if (!grouped.has(key)) grouped.set(key, []);
                grouped.get(key)!.push(u);
              });
              return Array.from(grouped.entries()).map(([teamId, members]) => {
                const teamName = members[0] && (members[0] as any).team_name;
                return (
                  <optgroup key={teamId} label={teamName || 'No Team'}>
                    {members.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </optgroup>
                );
              });
            })()}
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

      {/* Onboarding tracker */}
      <OnboardingSidebar />

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
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
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
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent my-4" />
            <Link
              href="/users"
              className={cn(
                "flex items-center gap-2.5 px-3 py-[9px] rounded-xl text-[13px] font-medium transition-all duration-200 relative",
                pathname === '/users'
                  ? "bg-blue-500/[0.12] text-blue-400"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
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
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
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
      <div className="border-t border-border pt-4 mt-4 relative">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/25 to-violet-500/25 border border-blue-500/20 flex items-center justify-center text-[11px] font-bold text-blue-300 shrink-0">
            {currentUser.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-foreground truncate leading-tight">{currentUser.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{currentUser.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200 flex-1"
          >
            {theme === 'dark' ? <Sun size={15} strokeWidth={1.5} /> : <Moon size={15} strokeWidth={1.5} />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200"
            title="Sign out"
          >
            <LogOut size={15} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </nav>
  );
}
