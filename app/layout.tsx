import './globals.css';
import { Providers } from '@/components/providers';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
