// What the page "Documents in an S3 bucket" says that is data, each checked
// in apps/storage: server/api.ts (the routes), server/bucket.ts (the client,
// the signed addresses, the rule of origins), .env.example, scripts/ and
// src/App.tsx.

export interface Provider {
  name: string;
  /** S3_ENDPOINT, with `<place>` for what the person gives; empty when it is left out. */
  endpoint: string;
  /** S3_REGION, or `<place>`. */
  region: string;
  pathStyle?: boolean;
  /** What to ask for, put in `<place>`. */
  ask?: string;
  placeholder: string;
  note: string;
}

export const PROVIDERS: Provider[] = [
  {
    name: 'Cloudflare R2',
    endpoint: 'https://<place>.r2.cloudflarestorage.com',
    region: 'auto',
    ask: 'Account id',
    placeholder: '<account-id>',
    note: 'The account id is in the dashboard, R2, and in the address of the S3 API. Not the r2.dev address: that one serves the files to anyone, and the backend refuses it.',
  },
  { name: 'AWS S3', endpoint: '', region: '<place>', ask: 'Region of the bucket', placeholder: 'eu-west-1', note: 'Without an endpoint, the SDK finds the bucket by its region.' },
  {
    name: 'MinIO',
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    pathStyle: true,
    placeholder: '',
    note: 'MinIO takes the bucket in the path, not in the name of the host: S3_FORCE_PATH_STYLE. Any region does.',
  },
  {
    name: 'Backblaze B2',
    endpoint: 'https://s3.<place>.backblazeb2.com',
    region: '<place>',
    ask: 'Region',
    placeholder: 'us-west-004',
    note: 'The region is in the endpoint of the bucket, on its page in Backblaze.',
  },
];

/** The routes of server/api.ts. */
export const ROUTES: { route: string; text: string }[] = [
  { route: 'GET /api/files', text: 'The .docx and .pdf of the bucket, the newest first: key, size, modified. The versions are not among them.' },
  { route: 'GET /api/url?key=…', text: '{ url }: an address to read that file from, good for five minutes.' },
  { route: 'POST /api/url?key=…', text: '{ url, type }: an address to write a .docx to, sending that Content-Type and no other. Never one of a version: those stay as they were kept.' },
  { route: 'GET /api/variables?key=…', text: '{ names }: the variables of a template.' },
  {
    route: 'POST /api/pdf?key=…',
    text: 'Fills the template with the JSON of the body, stores the PDF beside it, and answers { key, url, pages, missingFonts }. A server with no font says so, with a 503.',
  },
  { route: 'GET /api/versions?key=…', text: 'The versions kept of a document: id (its key, read with GET /api/url), date, author, label.' },
  {
    route: 'POST /api/versions?key=…',
    text: '{ url, type, version }: an address to write a new version to. The JSON of the body names it: { label, author }. The oldest beyond the 50 kept (VERSIONS_KEPT) go first.',
  },
];

/** The steps to run the demo with Cloudflare R2. */
export const STEPS: { title: string; text: string }[] = [
  { title: 'A bucket', text: 'In the Cloudflare dashboard, R2, Create bucket. Call it rebodocs-demo, or what you like.' },
  { title: 'Keys', text: 'R2, Manage API tokens, Create API token, with Object Read & Write for that bucket only. It shows the Access Key ID and the Secret Access Key once.' },
  { title: 'The environment', text: 'Copy apps/storage/.env.example to .env and fill it in: the generator below writes it for the S3 you pick.' },
  {
    title: 'Let the page in',
    text: 'npm run cors -w @rebodocs/storage-demo tells the bucket the page may use its addresses. Keys for objects only may not change that: it then prints the rule to paste.',
  },
  { title: 'A document, and the demo', text: 'npm run seed -w @rebodocs/storage-demo puts contract.docx, a template, in the bucket; npm run storage opens http://localhost:5176.' },
];

/** What to know, from the code and from running it. */
export const KNOW: { title: string; text: string }[] = [
  {
    title: 'Check who is asking before signing.',
    text: 'The demo signs for anyone who reaches it, which is right for a machine of your own and wrong anywhere else. In your application the routes know the person and decide which keys they may read and write: a prefix for each account, for one.',
  },
  {
    title: 'Sign the type too.',
    text: 'With signableHeaders, an address to write takes one Content-Type and refuses a PUT with another. Without it, the bucket stores whatever type the browser says.',
  },
  {
    title: 'No checksums the browser cannot send.',
    text: 'Recent versions of the AWS SDK add a checksum to what they sign, as headers a browser does not send, and not every S3 takes them. The two WHEN_REQUIRED lines turn that off.',
  },
  { title: 'The origin has to be allowed.', text: 'A request the browser refuses before it is answered is, nearly always, the CORS rule: the port and the protocol are part of the origin.' },
  {
    title: 'The last one to save wins.',
    text: 'Two people on the same file overwrite each other. For several at once, see collaboration: its demo can keep its documents in this same bucket.',
  },
  { title: 'The PDF is made from what is stored,', text: 'not from what is on screen: save first. The button waits until the document is in the bucket.' },
];
