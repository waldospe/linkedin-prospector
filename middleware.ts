import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'moco-linkedin-prospector-secure-key'
);

async function decodeToken(token: string): Promise<{ userId: number; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { userId: payload.userId as number, role: payload.role as string };
  } catch {
    return null;
  }
}

export async function middleware(request: Request) {
  const url = new URL(request.url);

  // Allow login, invite, auth routes, and cron endpoint through
  if (url.pathname === '/login' || url.pathname.startsWith('/invite/') || url.pathname.startsWith('/api/invite/') || url.pathname === '/api/auth' || url.pathname === '/api/auth/check' || url.pathname === '/api/queue/auto-process' || url.pathname === '/api/unipile/callback') {
    return NextResponse.next();
  }

  // Extract auth token from cookie
  const cookieHeader = request.headers.get('cookie');
  const token = cookieHeader?.match(/auth_token=([^;]+)/)?.[1];

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const decoded = await decodeToken(token);
  if (!decoded) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Inject user identity into request headers (server-side, trusted)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', decoded.userId.toString());
  requestHeaders.set('x-user-role', decoded.role);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
