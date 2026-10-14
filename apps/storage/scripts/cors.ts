// Tells the bucket which pages may read from and write to it: without this a
// browser refuses the signed addresses, because they are on another origin.
//
//   npm run cors                                     → http://localhost:5176
//   npm run cors -- https://app.example.com …        → those, in place of it

import { openBucket } from '../server/bucket';

try {
  process.loadEnvFile();
} catch {
  // No .env: the environment has the names already, or openBucket says which are missing.
}
const given = process.argv.slice(2).filter((arg) => /^https?:\/\//.test(arg));
const origins = given.length ? given : ['http://localhost:5176'];
try {
  await openBucket().allowOrigins(origins);
  console.log(`The bucket now takes requests from: ${origins.join(', ')}`);
} catch (error) {
  if ((error as { name?: string }).name !== 'AccessDenied') throw error;
  // Keys for objects only cannot change the bucket: the rule goes in by hand.
  const rule = [{ AllowedOrigins: origins, AllowedMethods: ['GET', 'PUT'], AllowedHeaders: ['content-type'], MaxAgeSeconds: 3600 }];
  console.error(`These keys may not change the settings of the bucket. Paste this as its CORS policy (in Cloudflare: the bucket, Settings, CORS policy):\n\n${JSON.stringify(rule, null, 2)}\n`);
  process.exitCode = 1;
}
