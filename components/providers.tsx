'use client';

import { ReactNode } from 'react';
import { UserProvider } from '@/components/user-context';
import { PostHogProvider } from '@/components/posthog-provider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      <PostHogProvider>
        {children}
      </PostHogProvider>
    </UserProvider>
  );
}
