import { Providers } from '@/components/providers';
import Navigation from '@/components/navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <div className="flex min-h-screen bg-zinc-950">
        <Navigation />
        <main className="flex-1 p-8 overflow-auto">
          {children}
        </main>
      </div>
    </Providers>
  );
}
