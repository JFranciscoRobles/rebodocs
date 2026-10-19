// The bucket, through the S3 API: the one thing here that has the keys.
// Anything that speaks S3 takes the same calls, so Cloudflare R2, AWS S3 and
// MinIO differ only in what the environment says.

import { GetObjectCommand, ListObjectsV2Command, PutBucketCorsCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
/** How long an address handed to the browser is good for, in seconds. */
const URL_LIFE = 300;

export interface BucketFile {
  key: string;
  size: number;
  /** When it was last written, as an ISO date. */
  modified: string;
}

export interface Bucket {
  /** The documents and the PDFs in it, or those whose key starts with `prefix`, the newest first. */
  list(prefix?: string): Promise<BucketFile[]>;
  get(key: string): Promise<Uint8Array | undefined>;
  put(key: string, body: Uint8Array, type: string): Promise<void>;
  /** An address the browser can read the file from, with no keys, for a few minutes. */
  readUrl(key: string): Promise<string>;
  /** An address the browser can write the file to, sending this `Content-Type`. */
  writeUrl(key: string, type: string): Promise<string>;
  /** Lets pages of these origins read from and write to those addresses. */
  allowOrigins(origins: string[]): Promise<void>;
}

/** What says which bucket and with what keys; `process.env` has the same names. */
export interface BucketEnv {
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_FORCE_PATH_STYLE?: string;
}

export function openBucket(env: BucketEnv = process.env): Bucket {
  const missing = (['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const).filter((name) => !env[name]);
  if (missing.length) throw new Error(`Missing in the environment: ${missing.join(', ')}. Copy .env.example to .env and fill it in.`);
  if (env.S3_ENDPOINT && !/^https?:\/\/[^\s/]+\/?$/.test(env.S3_ENDPOINT)) throw new Error('S3_ENDPOINT in the environment is not an address like https://<account-id>.r2.cloudflarestorage.com, with no bucket after it.');
  // The public address of an R2 bucket serves its files to anyone; it is not where the S3 API is.
  if (/\.r2\.dev\/?$/.test(env.S3_ENDPOINT ?? '')) throw new Error('S3_ENDPOINT in the environment is the public address of the bucket (r2.dev). The S3 API is at https://<account-id>.r2.cloudflarestorage.com.');
  const Bucket = env.S3_BUCKET!;
  const client = new S3Client({
    endpoint: env.S3_ENDPOINT || undefined,
    region: env.S3_REGION || 'auto',
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
    forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
    // Checksums only where the service asks for them: the ones the SDK adds by itself
    // go into a signed address as headers a browser does not send, and not every S3 takes them.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  return {
    async list(prefix) {
      const files: BucketFile[] = [];
      let ContinuationToken: string | undefined;
      do {
        const page = await client.send(new ListObjectsV2Command({ Bucket, ContinuationToken, Prefix: prefix || undefined }));
        for (const item of page.Contents ?? []) {
          if (item.Key && /\.(docx|pdf)$/i.test(item.Key)) files.push({ key: item.Key, size: item.Size ?? 0, modified: (item.LastModified ?? new Date(0)).toISOString() });
        }
        ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (ContinuationToken);
      return files.sort((a, b) => b.modified.localeCompare(a.modified));
    },
    async get(key) {
      try {
        const answer = await client.send(new GetObjectCommand({ Bucket, Key: key }));
        return await answer.Body?.transformToByteArray();
      } catch (error) {
        if ((error as { name?: string }).name === 'NoSuchKey') return undefined;
        throw error;
      }
    },
    async put(key, body, type) {
      await client.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: type }));
    },
    readUrl: (key) => getSignedUrl(client, new GetObjectCommand({ Bucket, Key: key }), { expiresIn: URL_LIFE }),
    // The type is signed too: the address takes a file of that type and no other.
    writeUrl: (key, type) => getSignedUrl(client, new PutObjectCommand({ Bucket, Key: key, ContentType: type }), { expiresIn: URL_LIFE, signableHeaders: new Set(['content-type']) }),
    async allowOrigins(origins) {
      await client.send(
        new PutBucketCorsCommand({
          Bucket,
          CORSConfiguration: { CORSRules: [{ AllowedOrigins: origins, AllowedMethods: ['GET', 'PUT'], AllowedHeaders: ['content-type'], MaxAgeSeconds: 3600 }] },
        }),
      );
    },
  };
}
