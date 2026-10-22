// The backend as this demo runs it: one bucket, opened on the first request
// from what the environment says.

import { resolve } from 'node:path';
import { createApi } from './api';
import { type Bucket, openBucket } from './bucket';

let bucket: Bucket | undefined;

export const api = createApi(() => (bucket ??= openBucket()), {
  fontDirs: process.env.FONTS_DIR ? [resolve(process.env.FONTS_DIR)] : [],
  keepVersions: process.env.VERSIONS_KEPT ? Number(process.env.VERSIONS_KEPT) : undefined,
});
