// Puts a first document in the bucket: the sample contract of `apps/demo`,
// which is also a template with variables to fill.
//
//   npm run seed

import { readFileSync } from 'node:fs';
import { DOCX, openBucket } from '../server/bucket';

try {
  process.loadEnvFile();
} catch {
  // No .env: the environment has the names already, or openBucket says which are missing.
}
const path = process.argv.slice(2).find((arg) => arg.endsWith('.docx'));
if (!path) throw new Error('Which file? npm run seed gives it one.');
await openBucket().put('contract.docx', new Uint8Array(readFileSync(path)), DOCX);
console.log('contract.docx is in the bucket.');
