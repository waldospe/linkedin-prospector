import Link from 'next/link';
import { Zap } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 main-gradient">
      <div className="text-center animate-fade-in">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl gradient-blue shadow-lg shadow-blue-500/20 mb-6">
          <Zap className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-6xl font-bold text-foreground mb-2">404</h1>
        <p className="text-lg text-muted-foreground mb-8">This page doesn't exist</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl btn-primary text-white text-sm font-medium"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
