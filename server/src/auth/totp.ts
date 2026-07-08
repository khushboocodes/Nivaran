import { Secret, TOTP } from 'otpauth';

const ISSUER = 'NIVARAN';

/**
 * Generate a fresh TOTP secret and matching otpauth:// URI for an
 * authenticator app to scan. Persist `secret.base32` on the user once the
 * verification step succeeds — never before, otherwise an attacker could
 * brute-force a partial enrollment.
 */
export function newSecret(label: string): { base32: string; uri: string } {
  const secret = new Secret({ size: 20 });
  const totp = new TOTP({
    issuer: ISSUER,
    label,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  });
  return { base32: secret.base32, uri: totp.toString() };
}

/**
 * Verify a 6-digit code against the secret. Allows ±1 step (≤30s of clock
 * skew on each side) which is the conventional default.
 */
export function verifyCode(secretBase32: string, code: string): boolean {
  const totp = new TOTP({
    issuer: ISSUER,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  });
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}
