'use client';

import { ReactNode } from 'react';
import { UserProvider } from '@/components/user-context';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      {children}
    </UserProvider>
  );
}
