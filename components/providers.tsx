'use client';

import { ReactNode } from 'react';
import { UserProvider } from '@/components/user-context';
import { PostHogProvider } from '@/components/posthog-provider';
import { ThemeProvider } from '@/components/theme-provider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <UserProvider>
        <PostHogProvider>
          {children}
        </PostHogProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
