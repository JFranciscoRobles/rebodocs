# Documents in an S3 bucket

Where documents live is your application's business. This page shows one common answer, with a demo to run: the files in a bucket that speaks S3 (Cloudflare R2, AWS S3, MinIO, Backblaze B2…), a small backend that holds the keys, and the editor in the browser.

```
 browser ──── which files? an address for this one? ────► your backend ── has the keys
    │                                                          │
    └──── GET / PUT with an address signed for 5 minutes ──► the bucket ◄── PDF made on the server
```

The browser never has a key of the bucket. It asks the backend for an address signed for one file and a few minutes, and reads from or writes to the bucket itself, so the files do not pass through your server. Only the PDF is made by the server, because that is work for one.

The demo is [`apps/storage`](https://github.com/JFranciscoRobles/rebodocs/tree/main/apps/storage). It runs on your machine, with a bucket of your own.

## Run it with Cloudflare R2

**1. A bucket.** In the Cloudflare dashboard, R2 → Create bucket. Call it `rebodocs-demo`, or what you like.

**2. Keys.** R2 → Manage API tokens → Create API token, with permission **Object Read & Write**, for that bucket only. It gives an Access Key ID and a Secret Access Key, once. The same page has your account id, which is in the address of the S3 API.

**3. The environment.** From the repository:

```bash
git clone https://github.com/JFranciscoRobles/rebodocs && cd rebodocs && npm install
cp apps/storage/.env.example apps/storage/.env
```

```bash
# apps/storage/.env
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=rebodocs-demo
S3_ACCESS_KEY_ID=…
S3_SECRET_ACCESS_KEY=…
```

**4. Let the page in.** The signed addresses are on another origin than the page, so the bucket has to be told which pages may use them:

```bash
npm run cors -w @rebodocs/storage-demo
```

A token for objects only may not be allowed to change this. Then paste the rule yourself, in the bucket's Settings → CORS policy:

```json
[
  {
    "AllowedOrigins": ["http://localhost:5176"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

**5. A first document, and the demo.**

```bash
npm run seed -w @rebodocs/storage-demo     # puts contract.docx, a template, in the bucket
npm run storage                            # http://localhost:5176
```

Open `contract.docx` from the list, change it, save: it is written to the bucket. **PDF on the server…** asks for the values of its variables and leaves `contract.pdf` beside it. **New** starts an empty document that goes to the bucket when it is saved.

## Another S3

The code is the same. The environment says which one:

| | `S3_ENDPOINT` | `S3_REGION` | `S3_FORCE_PATH_STYLE` |
| --- | --- | --- | --- |
| Cloudflare R2 | `https://<account-id>.r2.cloudflarestorage.com` | `auto` | |
| AWS S3 | leave it out | the bucket's, as `eu-west-1` | |
| MinIO | `http://localhost:9000` | any, as `us-east-1` | `true` |
| Backblaze B2 | `https://s3.<region>.backblazeb2.com` | that region | |

## The backend

Five routes, in [`server/api.ts`](https://github.com/JFranciscoRobles/rebodocs/blob/main/apps/storage/server/api.ts). It is a plain Node handler, `(request, response)`, so it goes as it is into Express, a Next.js route or a server of your own.

| Route | What it answers |
| --- | --- |
| `GET  /api/files` | The `.docx` and `.pdf` of the bucket: `key`, `size`, `modified`. |
| `GET  /api/url?key=…` | `{ url }`: an address to read that file from. |
| `POST /api/url?key=…` | `{ url, type }`: an address to write a `.docx` to, sending that `Content-Type`. |
| `GET  /api/variables?key=…` | `{ names }`: the variables of a template. |
| `POST /api/pdf?key=…` | Fills the template with the JSON of the body, stores the PDF, and answers `{ key, url, pages, missingFonts }`. |

Signing an address is two lines with the AWS SDK:

```ts
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? 'auto',
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

const readUrl = (Key: string) => getSignedUrl(client, new GetObjectCommand({ Bucket, Key }), { expiresIn: 300 });
const writeUrl = (Key: string, ContentType: string) =>
  getSignedUrl(client, new PutObjectCommand({ Bucket, Key, ContentType }), { expiresIn: 300, signableHeaders: new Set(['content-type']) });
```

## The page

Opening is a file given to the component, and saving is what `onSave` hands back:

```tsx
import { DocsEditor } from '@rebodocs/react';

async function read(key: string) {
  const { url } = await (await fetch(`/api/url?key=${encodeURIComponent(key)}`)).json();
  return new Uint8Array(await (await fetch(url)).arrayBuffer());
}

async function write(key: string, docx: Uint8Array) {
  const { url, type } = await (await fetch(`/api/url?key=${encodeURIComponent(key)}`, { method: 'POST' })).json();
  await fetch(url, { method: 'PUT', headers: { 'content-type': type }, body: docx });
}

<DocsEditor key={key} docx={file} name={key} onSave={(docx) => write(key, docx)} />
```

## A PDF on the server

The server reads the template from the bucket, fills it, lays it out with font files and stores the result. See [On a server](/docs/server/) for what each call does.

```ts
import { fillVariables, importDocx, renderPdf } from '@rebodocs/core';

const template = importDocx(await bucket.get('contract.docx'));
const { pdf, missingFonts } = renderPdf(fillVariables(template, values), fonts, 'contract');
await bucket.put('contract.pdf', pdf, 'application/pdf');
```

The demo looks for `.ttf` files in the fonts of the system, or in the folder `FONTS_DIR` names. A server of yours has no fonts unless you put them there: ship the ones your documents use, and read `missingFonts` to know when one was stood in for.

## What to know

- **Check who is asking before signing.** The demo signs for anyone who reaches it, which is right for a machine of your own and wrong anywhere else. In your application, the routes know the person and decide which keys they may read and write: a prefix for each account, for one.
- **Sign the type too.** With `signableHeaders`, an address to write takes one `Content-Type` and refuses a `PUT` with another. Without it the bucket stores whatever type the browser says.
- **No checksums the browser cannot send.** Recent versions of the AWS SDK add a checksum to what they sign, as headers a browser does not send, and not every S3 takes them. The two `WHEN_REQUIRED` lines above turn that off.
- **The origin has to be allowed.** A request the browser refuses before it is answered is, nearly always, the CORS rule: the port and the protocol are part of the origin.
- **The last one to save wins.** Two people on the same file overwrite each other. For several at once, see [collaboration](/docs/collaboration/#a-demo-to-run): its demo can keep its documents in this same bucket.
- **The server makes the PDF from what is stored**, not from what is on screen: save first.
- **How it has been checked.** The backend has automated tests against an S3 kept in memory: listing, signed addresses, writing as a browser does, the PDF. Against a bucket of Cloudflare R2 the same was run by hand from Node, with the origin rule in place.
