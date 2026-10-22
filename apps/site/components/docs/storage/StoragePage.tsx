import { LIGHT_THEME, highlight } from '@/lib/docs';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { KNOW, ROUTES, STEPS } from './data';
import { Flow } from './Flow';
import { LazyEnvDemo, LazyRequestsDemo } from './Lazy';

const REPO = 'https://github.com/JFranciscoRobles/rebodocs';
const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

/**
 * "Documents in an S3 bucket": the storage demo's protocol played on the page
 * with a real editor, how to run the demo, the .env for each S3, the routes of
 * its backend, the page's side, the PDF on the server, and what to know.
 */
export async function StoragePage() {
  const [run, signing, page, pdf] = await Promise.all([
    highlight(
      `git clone ${REPO} && cd rebodocs && npm install
cp apps/storage/.env.example apps/storage/.env     # and fill it in
npm run cors -w @rebodocs/storage-demo             # lets http://localhost:5176 reach the bucket
npm run seed -w @rebodocs/storage-demo             # puts contract.docx in it
npm run storage                                    # http://localhost:5176`,
      'bash',
      LIGHT_THEME,
    ),
    highlight(
      `import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
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
  getSignedUrl(client, new PutObjectCommand({ Bucket, Key, ContentType }), { expiresIn: 300, signableHeaders: new Set(['content-type']) });`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `import { DocsEditor } from '@rebodocs/react';

async function read(key: string) {
  const { url } = await (await fetch(\`/api/url?key=\${encodeURIComponent(key)}\`)).json();
  return new Uint8Array(await (await fetch(url)).arrayBuffer());
}

async function write(key: string, docx: Uint8Array) {
  const { url, type } = await (await fetch(\`/api/url?key=\${encodeURIComponent(key)}\`, { method: 'POST' })).json();
  await fetch(url, { method: 'PUT', headers: { 'content-type': type }, body: docx });
}

<DocsEditor key={key} docx={file} name={key} onSave={(docx) => write(key, docx)} />`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `import { fillVariables, importDocx, renderPdf } from '@rebodocs/core';

const template = importDocx(await bucket.get('contract.docx'));
const { pdf, missingFonts } = renderPdf(fillVariables(template, values), fonts, 'contract');
await bucket.put('contract.pdf', pdf, 'application/pdf');`,
      'ts',
      LIGHT_THEME,
    ),
  ]);

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">Documents in an S3 bucket</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        Where documents live is your application&apos;s business. This page shows one common answer, with a demo to run: the files in a bucket that speaks S3 (Cloudflare R2, AWS S3, MinIO,
        Backblaze B2…), a small backend that holds the keys, and the editor in the browser.
      </p>
      <Flow />
      <p className={prose}>
        The browser never has a key of the bucket. It asks the backend for an address signed for one file and five minutes, and reads from or writes to the bucket itself, so the files do not
        pass through your server. Only the PDF is made by the server, because that is work for one.
      </p>
      <div className="mt-4">
        <HandTip>tip: save the contract below and watch where each request goes</HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge="Live" color="green" title="The requests of a save">
          A real editor over the same protocol as the demo, with the backend and the bucket played in this page: the addresses are signed and checked as an S3 checks them, but nothing leaves the
          browser.
        </SectionHead>
        <LazyRequestsDemo />
        <p className={prose}>
          Opening is a list, an address and a read from the bucket. A save is two addresses and two writes: the document, and a copy of it under <code className={mono}>versions/</code>. Take the{' '}
          <em>CORS rule</em> away and the browser never reaches the bucket; a <em>PUT of another type</em> breaks the signature; <em>five minutes later</em> the address has run out.
        </p>
      </section>

      <section aria-labelledby="run-it" className="mt-24">
        <SectionHead id="run-it" badge="Start here" color="blue" title="Run it with Cloudflare R2">
          The demo is{' '}
          <a href={`${REPO}/tree/main/apps/storage`} className={LINK}>
            apps/storage
          </a>
          . It runs on your machine, with a bucket of your own.
        </SectionHead>
        <ol className="m-0 mt-6 grid max-w-[920px] list-none gap-3 p-0 [counter-reset:step]">
          {STEPS.map((step) => (
            <li key={step.title} className="flex gap-4 rounded-2xl border border-border px-5 py-4 [counter-increment:step] before:font-display before:text-xl before:font-extrabold before:text-brand before:content-[counter(step)]">
              <div>
                <p className="m-0 text-[15px] font-semibold text-ink">{step.title}</p>
                <p className="m-0 mt-1 text-[15px] leading-normal text-ink-soft">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: run }} />
        <p className={prose}>
          Open <code className={mono}>contract.docx</code> from the list, change it, save: it is written to the bucket, and a version beside it, signed with the name you give your notes. If
          the document is written and its version is not, the demo says so apart: the document is saved. <strong>PDF on the server…</strong> asks for the
          values of its variables and leaves <code className={mono}>contract.pdf</code> beside it. <strong>New</strong> starts an empty document that goes to the bucket when it is saved.
        </p>
      </section>

      <section aria-labelledby="another-s3" className="mt-24">
        <SectionHead id="another-s3" badge="Any S3" color="purple" title="Another S3">
          The code is the same; the environment says which one. Pick yours, and copy what it writes.
        </SectionHead>
        <LazyEnvDemo />
      </section>

      <section aria-labelledby="the-backend" className="mt-24">
        <SectionHead id="the-backend" badge="Node" color="orange" title="The backend">
          Seven routes, in{' '}
          <a href={`${REPO}/blob/main/apps/storage/server/api.ts`} className={LINK}>
            server/api.ts
          </a>
          . It is a plain Node handler, <code className={mono}>(request, response)</code>, so it goes as it is into Express, a Next.js route or a server of your own.
        </SectionHead>
        <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
          {ROUTES.map((row) => (
            <div key={row.route} className="grid gap-x-6 border-t border-[#f0eee9] py-3 first:border-t-0 sm:grid-cols-[230px_1fr]">
              <dt className="font-code text-[13.5px] font-semibold text-ink">{row.route}</dt>
              <dd className="m-0 text-[15px] leading-normal text-ink-soft">{row.text}</dd>
            </div>
          ))}
        </dl>
        <p className={prose}>
          A version is a file under <code className={mono}>versions/&lt;key&gt;/</code>. Its key holds when it was kept and, encoded, who kept it and its name, so that one listing request gives
          them all; the editor&apos;s side panel lists them, compares them and restores them. It is written once and never again: the backend signs no address to write over one. Fifty are kept
          of each document, or what <code className={mono}>VERSIONS_KEPT</code> says, and the oldest go as new ones come. See{' '}
          <a href="/docs/versions/" className={LINK}>
            versions
          </a>
          . Signing an address is two lines with the AWS SDK:
        </p>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: signing }} />
      </section>

      <section aria-labelledby="the-page" className="mt-24">
        <SectionHead id="the-page" badge="React" color="pink" title="The page">
          Opening is a file given to the component, and saving is what <code className={mono}>onSave</code> hands back.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: page }} />
      </section>

      <section aria-labelledby="a-pdf-on-the-server" className="mt-24">
        <SectionHead id="a-pdf-on-the-server" badge="@rebodocs/core" color="orange" title="A PDF on the server">
          The server reads the template from the bucket, fills it, lays it out with font files and stores the result. See{' '}
          <a href="/docs/server/" className={LINK}>
            On a server
          </a>{' '}
          for what each call does.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: pdf }} />
        <p className={prose}>
          The demo looks for <code className={mono}>.ttf</code> and <code className={mono}>.otf</code> files in the fonts of the system, or in the folder <code className={mono}>FONTS_DIR</code>{' '}
          names. A server of yours has no fonts unless you put them there: ship the ones your documents use, and read <code className={mono}>missingFonts</code> to know when one was stood in for.
        </p>
      </section>

      <section aria-labelledby="know" className="mt-24">
        <SectionHead id="know" badge="Limits" color="yellow" title="What to know" />
        <div className="mt-6 grid max-w-[920px] grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-3">
          {KNOW.map((item) => (
            <div key={item.title} className="rounded-2xl border border-border p-4">
              <p className="m-0 text-[15px] font-semibold text-ink">{item.title}</p>
              <p className="m-0 mt-1.5 text-[14px] leading-[1.55] text-ink-soft">{item.text}</p>
            </div>
          ))}
        </div>
        <p className={prose}>
          <strong>How it has been checked.</strong> The backend has automated tests against an S3 kept in memory: listing, signed addresses, writing as a browser does, the variables, the PDF (on a
          machine with fonts), versions kept, pruned and never written over, and the rule of origins. Against a bucket of Cloudflare R2 the same was run by hand from Node, with the origin rule in place.
        </p>
      </section>
    </>
  );
}
