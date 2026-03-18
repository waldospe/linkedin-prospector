import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  
  // Allow access to login and auth endpoints
  if (
    url.pathname === '/login' || 
    url.pathname.startsWith('/api/auth') ||
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/static') ||
    url.pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const auth = request.cookies.get('auth');
  
  if (!auth || auth.value !== 'true') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
