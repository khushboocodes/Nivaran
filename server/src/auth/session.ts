import { SignJWT, jwtVerify } from 'jose';
import { SESSION_SECRET, SESSION_TTL_HOURS } from './config';

const secretBytes = new TextEncoder().encode(SESSION_SECRET);

export interface SessionPayload {
  sub: string; // user id
  role: 'citizen' | 'officer' | 'admin';
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_HOURS}h`)
    .sign(secretBytes);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretBytes, { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string') return null;
    const role = payload.role;
    if (role !== 'citizen' && role !== 'officer' && role !== 'admin') return null;
    return { sub: payload.sub, role };
  } catch {
    return null;
  }
}
