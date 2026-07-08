import { randomBytes, createHash } from 'node:crypto';

/**
 * Mint a single-use token for password reset (and similar one-shot flows).
 * Returns the raw token to email to the user, plus the SHA-256 hash to
 * persist. Only the hash is stored — if the DB leaks, tokens cannot be
 * replayed.
 */
export function mintToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
