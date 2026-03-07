import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'unipile-dashboard-secret-key-change-in-production';

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function createToken(): string {
  return jwt.sign({ authenticated: true }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): boolean {
  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get('auth_token')?.value;
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;
  return verifyToken(token);
}

export async function requireAuth() {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    throw new Error('Unauthorized');
  }
}
