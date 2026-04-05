'use client';

import { ReactNode } from 'react';
import { UserProvider } from '@/components/user-context';
import { PostHogProvider } from '@/components/posthog-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { OnboardingProvider } from '@/components/onboarding-tracker';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <UserProvider>
        <OnboardingProvider>
          <PostHogProvider>
            {children}
          </PostHogProvider>
        </OnboardingProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
