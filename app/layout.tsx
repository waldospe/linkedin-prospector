import './globals.css';
import { Providers } from '@/components/providers';
import Navigation from '@/components/navigation';

export const metadata = {
  title: 'LinkedIn Prospector',
  description: 'LinkedIn outreach automation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="flex min-h-screen bg-zinc-950">
            <Navigation />
            <main className="flex-1 p-8 overflow-auto">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
