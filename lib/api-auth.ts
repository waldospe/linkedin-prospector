import { NextRequest } from 'next/server';

export interface RequestUser {
  userId: number;
  role: string;
}

/**
 * Extract user identity from middleware-injected headers.
 * These headers are set server-side by middleware, not by the client.
 */
export function getUserFromRequest(req: NextRequest): RequestUser {
  const userId = parseInt(req.headers.get('x-user-id') || '0');
  const role = req.headers.get('x-user-role') || 'user';
  return { userId, role };
}

export function requireAdmin(req: NextRequest): RequestUser {
  const user = getUserFromRequest(req);
  if (user.role !== 'admin') {
    throw new Error('Admin required');
  }
  return user;
}
