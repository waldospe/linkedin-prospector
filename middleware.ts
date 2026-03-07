import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';

export async function middleware(request: Request) {
  const url = new URL(request.url);
  if (url.pathname === '/login' || url.pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
