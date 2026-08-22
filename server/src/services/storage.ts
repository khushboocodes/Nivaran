/**
 * Attachment object storage, behind a swappable driver.
 *
 * Two drivers exist:
 *
 *   `db`  (default) — bytes live in the `attachment_blobs` Postgres table and
 *                     are uploaded to / served from this API. Needs no
 *                     third-party account, no bucket and no CORS policy.
 *   `s3`            — bytes live in any S3-compatible bucket (MinIO,
 *                     Cloudflare R2, Backblaze B2, AWS S3) and the browser
 *                     uploads straight to it with a presigned PUT.
 *
 * The database driver is the default on purpose. The S3 driver used to be the
 * only option, and its defaults pointed at `http://localhost:9000` — so a
 * deployment that had not configured a bucket handed the browser a presigned
 * URL for a MinIO instance that existed only on a developer's laptop. The
 * upload failed with a network error that looked like a bug in the app rather
 * than missing configuration. Defaulting to a driver that depends on nothing
 * but the database we already require means uploads work everywhere by
 * default, and the same code path runs locally and in production. Divergence
 * between those two is what hides deployment bugs until a demo.
 *
 * Both drivers expose the same three operations, so callers never branch:
 *   - presignPutUrl(key, contentType) → an HTTP PUT URL for raw bytes
 *   - publicUrlFor(key)              → the URL stored in `attachments.url`
 *   - storageDriver                  → which driver is active (for logging)
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SESSION_SECRET } from '../auth/config';

/**
 * Active driver. `s3` requires an explicit opt-in rather than being inferred
 * from the presence of `S3_ENDPOINT`: inference is how the old code ended up
 * silently pointing at localhost in production.
 */
export const storageDriver: 'db' | 's3' =
  (process.env.STORAGE_DRIVER ?? 'db').toLowerCase() === 's3' ? 's3' : 'db';

export const PRESIGN_EXPIRY_SECONDS = 60 * 5; // 5 minutes

/* ------------------------------------------------------------------ *
 * Signed upload tokens (database driver)
 * ------------------------------------------------------------------ */

/**
 * The browser PUTs attachment bytes with `XMLHttpRequest` and does **not**
 * set `withCredentials`, so no session cookie reaches the upload endpoint.
 * That is correct for S3, where authority lives in the presigned URL itself.
 * The database driver therefore needs the same property: authority carried in
 * the URL, not in ambient credentials.
 *
 * So we mint a short-lived HMAC over the exact object key plus its expiry.
 * Signing the key matters — a token that authorised "some upload" rather than
 * "this object" would let a caller redirect bytes to a key belonging to
 * another complaint.
 */
function signUploadToken(objectKey: string, expiresAtMs: number): string {
  return createHmac('sha256', SESSION_SECRET)
    .update(`${objectKey}\n${expiresAtMs}`)
    .digest('base64url');
}

/** Result of verifying an upload token. */
export type UploadTokenCheck =
  | { ok: true }
  | { ok: false; reason: 'expired' | 'bad_signature' | 'malformed' };

export function verifyUploadToken(
  objectKey: string,
  expiresAt: string | undefined,
  token: string | undefined,
): UploadTokenCheck {
  if (!expiresAt || !token) return { ok: false, reason: 'malformed' };

  const expiresAtMs = Number(expiresAt);
  if (!Number.isFinite(expiresAtMs)) return { ok: false, reason: 'malformed' };

  const expected = signUploadToken(objectKey, expiresAtMs);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  // Compare lengths first: timingSafeEqual throws on a length mismatch, and a
  // differing length is not secret information.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' };
  }

  // Expiry is checked *after* the signature so an attacker cannot use timing
  // on this endpoint to distinguish a forged token from a merely stale one.
  if (Date.now() > expiresAtMs) return { ok: false, reason: 'expired' };

  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Absolute URL resolution
 * ------------------------------------------------------------------ */

/**
 * Base URL of this API, used to build absolute upload and download URLs.
 *
 * Absolute rather than relative because `AttachmentSchema.url` is validated
 * with zod's `.url()`, and because the frontend is served from a different
 * origin than the API in any real deployment — a relative path would resolve
 * against the frontend and 404 into the SPA fallback.
 *
 * Resolved per request rather than cached. An earlier version remembered the
 * first origin it saw, which a platform health check poisoned immediately:
 * that probe arrives on the container's plain-HTTP port with no
 * `X-Forwarded-Proto`, so every attachment URL was minted as `http://` and a
 * browser on an HTTPS page then refused to load it as mixed content.
 *
 * `PUBLIC_API_URL` overrides everything, for setups where the externally
 * visible host differs from anything present on the request.
 */
export function resolveApiBase(headers: {
  forwardedProto?: string;
  forwardedHost?: string;
  host?: string;
  requestUrl?: string;
}): string {
  const configured = process.env.PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, '');

  const host = headers.forwardedHost ?? headers.host;
  if (!host) {
    const port = process.env.PORT ?? '3001';
    return `http://localhost:${port}`;
  }

  // Trust the forwarded scheme first: TLS terminates at the platform router,
  // so the request reaching this process is plain HTTP even when the client
  // spoke HTTPS. Falling back to the request's own scheme is only correct
  // when nothing is in front of us, i.e. local development.
  let proto = headers.forwardedProto?.split(',')[0]?.trim();
  if (!proto && headers.requestUrl) {
    try {
      proto = new URL(headers.requestUrl).protocol.replace(':', '');
    } catch {
      proto = undefined;
    }
  }
  if (!proto) proto = 'http';

  // A non-local host reached over plain HTTP is almost certainly a proxy hop
  // that dropped the header rather than a genuinely insecure public endpoint.
  // Assuming HTTPS there is safer than emitting a URL browsers will block.
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/i.test(host);
  if (proto === 'http' && !isLocal) proto = 'https';

  return `${proto}://${host}`;
}

/* ------------------------------------------------------------------ *
 * S3 driver
 * ------------------------------------------------------------------ */

const ENDPOINT = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
const REGION = process.env.S3_REGION ?? 'us-east-1';
const ACCESS_KEY = process.env.S3_ACCESS_KEY ?? 'nivaran';
const SECRET_KEY = process.env.S3_SECRET_KEY ?? 'nivaran-dev-only';
const BUCKET = process.env.S3_BUCKET ?? 'nivaran-attachments';
const PUBLIC_BASE = process.env.S3_PUBLIC_URL ?? ENDPOINT;
/** MinIO requires path-style (`endpoint/bucket/key`) rather than virtual-host. */
const FORCE_PATH_STYLE = (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true';

let s3: S3Client | null = null;
function getS3(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      endpoint: ENDPOINT,
      region: REGION,
      credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
      forcePathStyle: FORCE_PATH_STYLE,
    });
  }
  return s3;
}

let bucketReady: Promise<void> | null = null;

async function ensureBucket(): Promise<void> {
  const client = getS3();
  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET }));
    return;
  } catch {
    // Fall through and try to create it.
  }
  try {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET }));
    // Public reads so a browser can render the stored `publicUrl` directly.
    // Writes still require a presigned URL.
    await client.send(
      new PutBucketPolicyCommand({
        Bucket: BUCKET,
        Policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${BUCKET}/*`],
            },
          ],
        }),
      }),
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[storage] failed to ensure bucket', err);
  }
}

function getBucketReady(): Promise<void> {
  if (!bucketReady) bucketReady = ensureBucket();
  return bucketReady;
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export async function presignPutUrl(
  objectKey: string,
  contentType: string,
  apiBase: string,
): Promise<{ uploadUrl: string; expiresInSeconds: number }> {
  if (storageDriver === 's3') {
    await getBucketReady();
    const uploadUrl = await getSignedUrl(
      getS3(),
      new PutObjectCommand({ Bucket: BUCKET, Key: objectKey, ContentType: contentType }),
      { expiresIn: PRESIGN_EXPIRY_SECONDS },
    );
    return { uploadUrl, expiresInSeconds: PRESIGN_EXPIRY_SECONDS };
  }

  const expiresAtMs = Date.now() + PRESIGN_EXPIRY_SECONDS * 1000;
  const token = signUploadToken(objectKey, expiresAtMs);
  const params = new URLSearchParams({ exp: String(expiresAtMs), token });
  // The key is path-encoded rather than passed as a query parameter so the
  // upload and download URLs stay readable and share one shape.
  const uploadUrl = `${apiBase}/api/uploads/${encodeURI(objectKey)}?${params.toString()}`;
  return { uploadUrl, expiresInSeconds: PRESIGN_EXPIRY_SECONDS };
}

export function publicUrlFor(objectKey: string, apiBase: string): string {
  if (storageDriver === 's3') {
    return `${PUBLIC_BASE.replace(/\/$/, '')}/${BUCKET}/${objectKey}`;
  }
  return `${apiBase}/api/uploads/${encodeURI(objectKey)}`;
}

export const storageBucket = BUCKET;
