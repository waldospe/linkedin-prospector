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

/**
 * Get the effective user ID for data queries, supporting admin view-as.
 * Returns { effectiveUserId, isAll } where:
 * - effectiveUserId: the user to query data for (or the admin's own ID)
 * - isAll: true if admin is viewing aggregated team data
 *
 * Only admins can use view_as. Regular users always see their own data.
 */
export function getEffectiveUser(req: NextRequest): { userId: number; role: string; effectiveUserId: number | null; isAll: boolean } {
  const { userId, role } = getUserFromRequest(req);
  const viewAs = req.nextUrl.searchParams.get('view_as');

  if (role !== 'admin' || !viewAs) {
    return { userId, role, effectiveUserId: userId, isAll: false };
  }

  if (viewAs === 'all') {
    return { userId, role, effectiveUserId: null, isAll: true };
  }

  const targetId = parseInt(viewAs);
  if (isNaN(targetId)) {
    return { userId, role, effectiveUserId: userId, isAll: false };
  }

  return { userId, role, effectiveUserId: targetId, isAll: false };
}
