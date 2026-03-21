import crypto from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

// ---------------------------------------------------------------------------
// Allowed content types
// ---------------------------------------------------------------------------

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'video/mp4',
  'video/quicktime',
]);

// ---------------------------------------------------------------------------
// S3 client (lazy-initialized)
// ---------------------------------------------------------------------------

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new AppError(503, 'File storage not configured');
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  return s3Client;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 200);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface PresignedUploadParams {
  userId: string;
  fileName: string;
  contentType: string;
  folder?: string;
}

export async function getPresignedUploadUrl(params: PresignedUploadParams) {
  const { userId, fileName, contentType, folder } = params;

  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new AppError(
      400,
      `Content type "${contentType}" is not allowed. Allowed types: ${[...ALLOWED_CONTENT_TYPES].join(', ')}`
    );
  }

  const client = getS3Client();
  const sanitized = sanitizeFileName(fileName);
  const key = `uploads/${userId}/${folder || 'general'}/${crypto.randomUUID()}-${sanitized}`;

  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });

  const publicUrl = env.R2_PUBLIC_URL
    ? `${env.R2_PUBLIC_URL}/${key}`
    : key; // Fallback to just the key if no public URL configured

  return {
    uploadUrl,
    fileUrl: publicUrl,
    key,
  };
}

export async function deleteFile(key: string) {
  const client = getS3Client();

  const command = new DeleteObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
  });

  await client.send(command);

  return { message: 'File deleted successfully' };
}
