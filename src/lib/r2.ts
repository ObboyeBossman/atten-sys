import { S3Client } from '@aws-sdk/client-s3';

let r2ClientInstance: S3Client | null = null;

export function getR2Client(): S3Client {
  if (!r2ClientInstance) {
    r2ClientInstance = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID || "placeholder"}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "placeholder",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "placeholder",
      },
    });
  }
  return r2ClientInstance;
}

export function r2PublicUrl(key: string): string {
  if (!key) return '';
  const bucketUrl = process.env.R2_PUBLIC_URL || "https://placeholder.r2.dev";
  const base = bucketUrl.replace(/\/$/, '');
  const path = key.replace(/^\//, '');
  return `${base}/${path}`;
}
