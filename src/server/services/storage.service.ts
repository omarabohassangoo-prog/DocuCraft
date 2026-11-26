import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { resolveTenantSecret } from '../core/secrets.ts';
import { AppError } from '../core/errors.ts';
import type { DatabaseSchema } from '../../shared/types.ts';

function resolveUploadDir(): string {
  if (process.env.VERCEL === '1' || process.env.VERCEL_ENV) {
    return path.join('/tmp', 'ufuq-uploads');
  }
  return path.resolve(process.cwd(), 'data', 'uploads');
}

const UPLOAD_DIR = resolveUploadDir();

const ALLOWED_IMAGE_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export function validateImageMagicBytes(buf: Buffer, mimeType: string): boolean {
  if (buf.length < 12) return false;
  if (mimeType === 'image/jpeg') {
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  }
  if (mimeType === 'image/webp') {
    return buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  if (mimeType === 'image/avif') {
    return buf.subarray(4, 8).toString('ascii') === 'ftyp';
  }
  return false;
}

function signAwsV4(params: {
  method: string;
  url: URL;
  region: string;
  service: string;
  accessKey: string;
  secretKey: string;
  payloadHash: string;
  extraHeaders?: Record<string, string>;
}): Record<string, string> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const headers: Record<string, string> = {
    host: params.url.host,
    'x-amz-content-sha256': params.payloadHash,
    'x-amz-date': amzDate,
    ...(params.extraHeaders || {}),
  };

  const sortedKeys = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort();

  const canonicalHeaders = sortedKeys
    .map((k) => {
      const origKey = Object.keys(headers).find((h) => h.toLowerCase() === k)!;
      return `${k}:${headers[origKey].trim()}\n`;
    })
    .join('');

  const signedHeaders = sortedKeys.join(';');
  const canonicalRequest = [
    params.method.toUpperCase(),
    params.url.pathname,
    params.url.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    params.payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${params.region}/${params.service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const hmac = (key: Buffer | string, data: string) =>
    crypto.createHmac('sha256', key).update(data).digest();
  const kDate = hmac(`AWS4${params.secretKey}`, dateStamp);
  const kRegion = hmac(kDate, params.region);
  const kService = hmac(kRegion, params.service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  return {
    ...headers,
    Authorization: `AWS4-HMAC-SHA256 Credential=${params.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

function getS3Config(db: DatabaseSchema, tenantId: string) {
  const endpoint = process.env.STORAGE_ENDPOINT || resolveTenantSecret(db, tenantId, 'STORAGE_ENDPOINT');
  const bucket = process.env.STORAGE_PUBLIC_BUCKET || resolveTenantSecret(db, tenantId, 'STORAGE_PUBLIC_BUCKET');
  const accessKey = resolveTenantSecret(db, tenantId, 'STORAGE_ACCESS_KEY_ID');
  const secretKey = resolveTenantSecret(db, tenantId, 'STORAGE_SECRET_ACCESS_KEY');
  const region = process.env.STORAGE_REGION || 'auto';
  const driver: 's3' | 'r2' = endpoint?.includes('r2.cloudflarestorage.com') ? 'r2' : 's3';
  if (!endpoint || !bucket || !accessKey || !secretKey) return null;
  return { endpoint: endpoint.replace(/\/$/, ''), bucket, accessKey, secretKey, region, driver };
}

export async function storeUploadedImage(params: {
  db: DatabaseSchema;
  tenantId: string;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{
  driver: 's3' | 'r2' | 'local';
  bucketName: string;
  objectKey: string;
  ext: string;
}> {
  const ext = ALLOWED_IMAGE_MIME[params.mimeType];
  if (!ext) {
    throw new AppError({
      status: 400,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'Only JPEG, PNG, WebP, and AVIF images are allowed.',
    });
  }
  if (params.buffer.length === 0 || params.buffer.length > 5 * 1024 * 1024) {
    throw new AppError({
      status: 400,
      code: 'INVALID_FILE_SIZE',
      message: 'Image size must be between 1 byte and 5 MB.',
    });
  }
  if (!validateImageMagicBytes(params.buffer, params.mimeType)) {
    throw new AppError({
      status: 400,
      code: 'INVALID_IMAGE_HEADER',
      message: 'Uploaded binary does not match declared image MIME type.',
    });
  }

  const objectKey = `${params.tenantId}/${crypto.randomUUID()}.${ext}`;
  const s3 = getS3Config(params.db, params.tenantId);

  if (s3) {
    const targetUrl = new URL(`${s3.endpoint}/${s3.bucket}/${objectKey}`);
    const payloadHash = crypto.createHash('sha256').update(params.buffer).digest('hex');
    const signedHeaders = signAwsV4({
      method: 'PUT',
      url: targetUrl,
      region: s3.region,
      service: 's3',
      accessKey: s3.accessKey,
      secretKey: s3.secretKey,
      payloadHash,
      extraHeaders: { 'content-type': params.mimeType },
    });
    const res = await fetch(targetUrl.toString(), {
      method: 'PUT',
      headers: signedHeaders,
      body: new Uint8Array(params.buffer),
    });
    if (!res.ok) {
      throw new AppError({
        status: 502,
        code: 'STORAGE_UPLOAD_FAILED',
        message: `S3/R2 upload failed with HTTP ${res.status}`,
      });
    }
    return { driver: s3.driver, bucketName: s3.bucket, objectKey, ext };
  }

  // Local disk fallback with strict path confinement
  const safeFileName = `${crypto.randomUUID()}.${ext}`;
  const tenantDir = path.resolve(UPLOAD_DIR, params.tenantId.replace(/[^a-zA-Z0-9-]/g, ''));
  if (!tenantDir.startsWith(UPLOAD_DIR + path.sep)) {
    throw new AppError({ status: 400, code: 'INVALID_PATH', message: 'Invalid storage path' });
  }
  await fs.promises.mkdir(tenantDir, { recursive: true });
  const absTarget = path.resolve(tenantDir, safeFileName);
  if (!absTarget.startsWith(tenantDir + path.sep)) {
    throw new AppError({ status: 400, code: 'INVALID_PATH', message: 'Invalid file target' });
  }
  await fs.promises.writeFile(absTarget, params.buffer);

  return {
    driver: 'local',
    bucketName: 'local-uploads',
    objectKey: path.relative(UPLOAD_DIR, absTarget),
    ext,
  };
}

export async function readStoredMediaBuffer(params: {
  db: DatabaseSchema;
  tenantId: string;
  driver: 's3' | 'r2' | 'local';
  bucketName: string;
  objectKey: string;
}): Promise<Buffer | null> {
  if (params.driver === 'local') {
    const resolved = path.resolve(UPLOAD_DIR, params.objectKey);
    if (!resolved.startsWith(UPLOAD_DIR + path.sep)) return null;
    if (!fs.existsSync(resolved)) return null;
    return fs.promises.readFile(resolved);
  }

  const s3 = getS3Config(params.db, params.tenantId);
  if (!s3) return null;
  const targetUrl = new URL(`${s3.endpoint}/${params.bucketName}/${params.objectKey}`);
  const payloadHash = crypto.createHash('sha256').update('').digest('hex');
  const signedHeaders = signAwsV4({
    method: 'GET',
    url: targetUrl,
    region: s3.region,
    service: 's3',
    accessKey: s3.accessKey,
    secretKey: s3.secretKey,
    payloadHash,
  });
  const res = await fetch(targetUrl.toString(), { headers: signedHeaders });
  if (!res.ok) return null;
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

export async function pingStorageProvider(
  db: DatabaseSchema,
  tenantId: string
): Promise<{ configured: boolean; status: 'verified' | 'auth_failed' | 'not_configured'; message: string; latency_ms: number }> {
  const s3 = getS3Config(db, tenantId);
  if (!s3) {
    return {
      configured: false,
      status: 'not_configured',
      message: 'S3/R2 env not set (using local disk /api/v1/public/media storage)',
      latency_ms: 0,
    };
  }
  const started = Date.now();
  const targetUrl = new URL(`${s3.endpoint}/${s3.bucket}`);
  const payloadHash = crypto.createHash('sha256').update('').digest('hex');
  const signedHeaders = signAwsV4({
    method: 'HEAD',
    url: targetUrl,
    region: s3.region,
    service: 's3',
    accessKey: s3.accessKey,
    secretKey: s3.secretKey,
    payloadHash,
  });
  const res = await fetch(targetUrl.toString(), { method: 'HEAD', headers: signedHeaders });
  return {
    configured: true,
    status: res.ok ? 'verified' : 'auth_failed',
    message: res.ok ? `${s3.driver.toUpperCase()} bucket reachable` : `Storage HTTP ${res.status}`,
    latency_ms: Date.now() - started,
  };
}
