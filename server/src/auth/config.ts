const required = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
};

export const SESSION_SECRET = required('SESSION_SECRET');
export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? 'nivaran_session';
export const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS ?? 168);
export const IS_PROD = process.env.NODE_ENV === 'production';
