import { SignJWT, jwtVerify } from 'jose';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    console.error('WARNING: JWT_SECRET environment variable is not set. Using insecure default key.');
  }
  return new TextEncoder().encode(secret || 'moco-linkedin-prospector-dev-key');
}
const JWT_SECRET = getJwtSecret();

export interface TokenPayload {
  userId: number;
  role: string;
}

export async function createToken(userId: number, role: string): Promise<string> {
  return new SignJWT({ userId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { userId: payload.userId as number, role: payload.role as string };
  } catch {
    return null;
  }
}
