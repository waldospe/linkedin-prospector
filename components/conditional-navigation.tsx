'use client';

import { usePathname } from 'next/navigation';
import Navigation from './navigation';

export default function ConditionalNavigation() {
  const pathname = usePathname();
  
  // Don't show navigation on login page
  if (pathname === '/login') {
    return null;
  }
  
  return <Navigation />;
}
