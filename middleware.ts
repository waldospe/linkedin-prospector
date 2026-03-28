import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'moco-linkedin-prospector-secure-key'
);

async function verifyToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: Request) {
  const url = new URL(request.url);
  
  // Allow login and auth API routes
  if (url.pathname === '/login' || url.pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Check for auth token in cookie
  const cookieHeader = request.headers.get('cookie');
  const token = cookieHeader?.match(/auth_token=([^;]+)/)?.[1];
  
  if (!token || !(await verifyToken(token))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
