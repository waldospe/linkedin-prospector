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
  const { currentUser, isAdmin, loading } = useUser();

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  };

  if (loading || !currentUser) {
    return (
      <nav className="w-[260px] min-h-screen border-r border-border/50 bg-card/30 p-5">
        <div className="animate-pulse space-y-6">
          <div className="h-6 w-32 bg-secondary rounded-md" />
          <div className="space-y-2">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-9 bg-secondary rounded-lg" />
            ))}
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="w-[260px] min-h-screen border-r border-border/50 bg-card/30 p-5 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8 px-1">
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Zap className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-white leading-none">LinkedIn Prospector</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Campaign Automation</p>
        </div>
      </div>

      {/* Nav links */}
      <div className="flex-1 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150",
                isActive
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/15"
                  : "text-muted-foreground hover:text-white hover:bg-secondary/80 border border-transparent"
              )}
            >
              <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
              {item.label}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="h-px bg-border/50 my-3" />
            <Link
              href="/users"
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150",
                pathname === '/users'
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/15"
                  : "text-muted-foreground hover:text-white hover:bg-secondary/80 border border-transparent"
              )}
            >
              <UserCog size={16} strokeWidth={pathname === '/users' ? 2 : 1.5} />
              Team
            </Link>
          </>
        )}
      </div>

      {/* User footer */}
      <div className="border-t border-border/50 pt-4 mt-4">
        <div className="flex items-center gap-3 px-1 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/20 flex items-center justify-center text-xs font-semibold text-blue-300">
            {currentUser.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{currentUser.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{currentUser.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-white hover:bg-secondary/80 transition-all duration-150 w-full"
        >
          <LogOut size={16} strokeWidth={1.5} />
          Sign out
        </button>
      </div>
    </nav>
  );
}
