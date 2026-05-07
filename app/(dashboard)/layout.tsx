import Navigation from '@/components/navigation';
import { ViewAsBanner } from '@/components/view-as-banner';
import { MobileNav } from '@/components/mobile-nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:block">
        <Navigation />
      </div>
      <main className="flex-1 overflow-auto main-gradient">
        <ViewAsBanner />
        {/* Mobile top bar — visible only on mobile */}
        <MobileNav />
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
