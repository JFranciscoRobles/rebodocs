# Storage demo

Documents kept in an S3 bucket: list them, open one in the editor, save it
back, and have the server fill a template and store the PDF. For Cloudflare
R2, AWS S3, MinIO, or anything else that speaks S3.

```bash
cp apps/storage/.env.example apps/storage/.env     # and fill it in
npm run cors -w @rebodocs/storage-demo             # lets http://localhost:5176 reach the bucket
npm run seed -w @rebodocs/storage-demo             # puts contract.docx in it
npm run storage                                    # http://localhost:5176
```

[The guide](https://rebodocs.com/docs/storage/) has every step, with where to
find each value in Cloudflare.

It is made to run on your own machine. Nothing checks who is asking: anyone
who reaches the server may open and save what is in the bucket.

## What is where

| File | What it is |
| --- | --- |
| `server/bucket.ts` | The bucket through the S3 API: list, read, write, signed addresses. The one place with the keys. |
| `server/api.ts` | The five routes the page asks, as a plain Node handler. |
| `server/pdf.ts` | A template filled and drawn as a PDF. |
| `server/dev.ts`, `vite.config.ts` | How the demo runs the pages and the backend in one process. |
| `src/api.ts` | What the page asks of the backend, and of the bucket. |
| `src/App.tsx` | The list, the editor, and the dialog of the PDF. |
| `scripts/cors.ts`, `scripts/seed.ts` | The rule of origins, and a first document. |
| `test/api.test.ts` | The backend against an S3 kept in memory. |

## Where it can improve

- **A browser over a real bucket.** Against Cloudflare R2 it was run by hand
  from Node, with the origin rule in place.
- **Who may do what.** No sign-in and no permissions: `server/api.ts` says
  where they go.
- **Deleting and renaming.** Neither is here.
- **Several people at once.** The last to save wins here. `apps/realtime` is
  the demo of that, and can keep its documents in this same bucket.
