// Simple in-memory rate limiter
const attempts = new Map<string, { count: number; resetAt: number }>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  attempts.forEach((data, key) => {
    if (data.resetAt < now) attempts.delete(key);
  });
}, 300000);

export function checkRateLimit(key: string, maxAttempts: number = 5, windowMs: number = 900000): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now();
  const data = attempts.get(key);

  if (!data || data.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  if (data.count >= maxAttempts) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((data.resetAt - now) / 1000) };
  }

  data.count++;
  return { allowed: true, remaining: maxAttempts - data.count };
}
