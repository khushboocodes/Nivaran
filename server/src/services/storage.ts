/**
 * S3-compatible object storage. Defaults to the local MinIO instance from
 * `docker-compose.yml`, but works unchanged against any S3-API endpoint
 * (Cloudflare R2, Backblaze B2, AWS S3) — only the env vars change.
 *
 * Two operations are exported:
 *   - presignPutUrl(key, contentType): returns an HTTP PUT URL the
 *     browser uploads bytes to directly.
 *   - publicUrlFor(key): returns the URL the API stores in the
 *     `attachments` table and serves to clients.
 *
 * On boot we ensure the bucket exists. This keeps the dev experience
 * one-command (`docker compose up -d`) — no manual MinIO console step.
 */

import {
  S3Client,
  PutObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const ENDPOINT = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
const REGION = process.env.S3_REGION ?? 'us-east-1';
const ACCESS_KEY = process.env.S3_ACCESS_KEY ?? 'nivaran';
const SECRET_KEY = process.env.S3_SECRET_KEY ?? 'nivaran-dev-only';
const BUCKET = process.env.S3_BUCKET ?? 'nivaran-attachments';
/**
 * Public-facing URL prefix. Defaults to the same endpoint we use for
 * uploads — fine for local MinIO. In production this would be a CDN /
 * R2 public URL.
 */
const PUBLIC_BASE = process.env.S3_PUBLIC_URL ?? ENDPOINT;
/** When true, bucket URLs use `https://endpoint/bucket/key` instead of
 *  `https://bucket.endpoint/key`. MinIO requires path-style. */
const FORCE_PATH_STYLE = (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true';

export const PRESIGN_EXPIRY_SECONDS = 60 * 5; // 5 minutes

const client = new S3Client({
  endpoint: ENDPOINT,
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
  forcePathStyle: FORCE_PATH_STYLE,
});

let bucketReady: Promise<void> | null = null;

async function ensureBucket(): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET }));
    return;
  } catch {
    // Fallthrough to create.
  }
  try {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET }));
    // Allow public reads so browsers can render the uploaded files via
    // the stored `publicUrl` without another roundtrip. Writes still
    // require a presigned URL.
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${BUCKET}/*`],
        },
      ],
    };
    await client.send(
      new PutBucketPolicyCommand({
        Bucket: BUCKET,
        Policy: JSON.stringify(policy),
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

export async function presignPutUrl(
  objectKey: string,
  contentType: string,
): Promise<{ uploadUrl: string; expiresInSeconds: number }> {
  await getBucketReady();
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: objectKey,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGN_EXPIRY_SECONDS,
  });
  return { uploadUrl, expiresInSeconds: PRESIGN_EXPIRY_SECONDS };
}

export function publicUrlFor(objectKey: string): string {
  // Path-style URL — works for both MinIO and AWS S3 in path-style mode.
  return `${PUBLIC_BASE.replace(/\/$/, '')}/${BUCKET}/${objectKey}`;
}

export const storageBucket = BUCKET;
