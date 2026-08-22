/**
 * Raw attachment byte transfer for the database storage driver.
 * Mounted at `/api/uploads`.
 *
 *   PUT /api/uploads/<objectKey>?exp=<ms>&token=<hmac>   store bytes
 *   GET /api/uploads/<objectKey>                          serve bytes
 *
 * These two endpoints stand in for an S3 bucket's presigned PUT and
 * public-read GET, so the browser-side upload helper works unchanged against
 * either driver.
 *
 * Neither endpoint uses the session cookie, and that is deliberate rather
 * than an oversight:
 *
 *   PUT  — the browser uploads with `XMLHttpRequest` and no `withCredentials`,
 *          so no cookie is sent. Authority instead comes from a short-lived
 *          HMAC over the exact object key, minted by `/attachments/sign`
 *          *after* it has checked that the caller may attach to the parent
 *          complaint. Same model as a presigned S3 URL.
 *
 *   GET  — an `<img src>` or `<video src>` cannot carry credentials without
 *          CORS gymnastics, so reads are open, exactly as the S3 driver's
 *          public-read bucket policy was. Object keys embed 8 random
 *          characters, so URLs are unguessable, but anyone holding a URL can
 *          read the file. That is a real limitation worth knowing about for
 *          complaint evidence; closing it means serving blobs through
 *          authenticated fetches into object URLs, which is a bigger change
 *          than this driver swap.
 */

import { Hono } from 'hono';
import { prisma } from '../db';
import { verifyUploadToken } from '../services/storage';

const uploads = new Hono();

/**
 * Hard ceiling on a single upload, matching `AttachmentSignRequestSchema`.
 * Enforced again here because the sign step's declared `sizeBytes` is a claim
 * by the client, not a measurement — nothing stops a caller from signing for
 * 1 KB and then PUTting 100 MB.
 */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Keys are minted as `complaints/<complaintId>/<random>.<ext>`. */
const KEY_SHAPE = /^complaints\/([A-Za-z0-9_-]+)\/[A-Za-z0-9._-]+$/;

uploads.put('/:key{.+}', async (c) => {
  const objectKey = c.req.param('key');

  const check = verifyUploadToken(
    objectKey,
    c.req.query('exp'),
    c.req.query('token'),
  );
  if (!check.ok) {
    // 403 for a bad signature, 410 for a token that was valid but has aged
    // out — the client can react differently to "not allowed" than to
    // "try again", and the upload helper surfaces the status.
    const status = check.reason === 'expired' ? 410 : 403;
    return c.json({ code: `upload_token_${check.reason}` }, status);
  }

  const match = KEY_SHAPE.exec(objectKey);
  if (!match) return c.json({ code: 'invalid_object_key' }, 400);
  const complaintId = match[1]!;

  // The blob table has a cascading foreign key to complaints, so a missing
  // parent would surface as an opaque constraint violation. Check first and
  // answer with something a caller can act on.
  const complaint = await prisma.complaint.findUnique({
    where: { id: complaintId },
    select: { id: true },
  });
  if (!complaint) return c.json({ code: 'not_found' }, 404);

  const body = await c.req.arrayBuffer();
  const bytes = Buffer.from(body);
  if (bytes.byteLength === 0) return c.json({ code: 'empty_body' }, 400);
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    return c.json(
      { code: 'payload_too_large', maxBytes: MAX_UPLOAD_BYTES },
      413,
    );
  }

  const contentType = c.req.header('Content-Type') ?? 'application/octet-stream';

  // Upsert rather than create: a presigned PUT is idempotent for its lifetime,
  // and a retried upload after a dropped connection must not collide on the
  // primary key.
  await prisma.attachmentBlob.upsert({
    where: { objectKey },
    create: {
      objectKey,
      complaintId,
      contentType,
      bytes,
      sizeBytes: bytes.byteLength,
    },
    update: { contentType, bytes, sizeBytes: bytes.byteLength },
  });

  return c.body(null, 204);
});

uploads.get('/:key{.+}', async (c) => {
  const objectKey = c.req.param('key');

  const blob = await prisma.attachmentBlob.findUnique({ where: { objectKey } });
  if (!blob) return c.json({ code: 'not_found' }, 404);

  // Prisma maps `Bytes` to Buffer, but normalise so a Uint8Array from a future
  // client version does not silently produce a broken response body.
  const buf = Buffer.isBuffer(blob.bytes) ? blob.bytes : Buffer.from(blob.bytes);

  return c.body(buf, 200, {
    'Content-Type': blob.contentType,
    'Content-Length': String(buf.byteLength),
    // Object keys are unique per upload and never rewritten in practice, so
    // the content behind a given URL is immutable and safe to cache hard.
    'Cache-Control': 'public, max-age=31536000, immutable',
    // Let a browser range-request video/audio so playback can seek.
    'Accept-Ranges': 'none',
  });
});

export default uploads;
