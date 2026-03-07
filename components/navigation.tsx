'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  GitBranch, 
  ListTodo, 
  FileText, 
  BarChart3, 
  Settings, 
  LogOut,
  Linkedin
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

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

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  };

  return (
    <nav className="w-64 min-h-screen bg-zinc-900 border-r border-zinc-800 p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-8 px-2">
        <Linkedin className="w-8 h-8 text-blue-500" />
        <div>
          <h1 className="font-bold text-white">Unipile Dashboard</h1>
          <p className="text-xs text-zinc-500">LinkedIn Automation</p>
        </div>
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
