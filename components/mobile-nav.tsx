'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, Zap, LayoutDashboard, Inbox, Search, Users, Megaphone, GitBranch, ListTodo, BarChart3, Settings, LogOut } from 'lucide-react';
import { useUser } from '@/components/user-context';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/sequences', label: 'Sequences', icon: GitBranch },
  { href: '/queue', label: 'Queue', icon: ListTodo },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser } = useUser();

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  };

  return (
    <div className="md:hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg gradient-blue flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-foreground">LinkedIn Prospector</span>
        </div>
        <button onClick={() => setOpen(!open)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Slide-out menu */}
      {open && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setOpen(false)} />
          <div className="fixed top-0 left-0 bottom-0 w-[280px] bg-background border-r border-border z-50 p-5 overflow-y-auto animate-slide-in-left">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-xl gradient-blue flex items-center justify-center">
                <Zap className="w-[18px] h-[18px] text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">LinkedIn Prospector</p>
                <p className="text-[10px] text-muted-foreground">{currentUser?.email}</p>
              </div>
            </div>
            <nav className="space-y-1">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive ? 'bg-blue-500/[0.12] text-blue-400' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-border mt-4 pt-4">
              <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary w-full">
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </div>

          <style jsx>{`
            @keyframes slideInLeft {
              from { transform: translateX(-100%); }
              to { transform: translateX(0); }
            }
            .animate-slide-in-left {
              animation: slideInLeft 0.2s ease-out;
            }
          `}</style>
        </>
      )}
    </div>
  );
}
