# Site

[rebodocs.com](https://rebodocs.com): the landing page, with the editor itself on it, and the developer documentation.

```bash
npm run site          # http://localhost:5174, from the root of the repository
npm run build:site    # static files in apps/site/out
```

It is a Next.js application exported as plain files (`output: 'export'`), so it can be put on any static host. It installs `@rebodocs/react` as any application would, which makes it the first user of the package: both commands build that package first.

## Deploying

On Vercel, set the project's **Root Directory** to `apps/site` and leave the rest as it is: `vercel.json` says how to install and build.

The site is one workspace of the repository and is built with tools of the others. Installing in `apps/site` alone, which is what a host does by default, leaves those out; so both steps run from the root of the repository: `npm ci`, then `npm run build:site`, which builds `@rebodocs/react`, writes the sample document and builds the site.

On any other static host, run `npm run build:site` and publish `apps/site/out`.

## Where things are

| Path | What it is |
| --- | --- |
| `app/page.tsx` | The landing page. |
| `components/LiveDemo.tsx` | The editor on the landing page. |
| `scripts/demo.ts` | Writes the document it opens with, `public/demo.docx`, when the site is built. |
| `content/docs/*.md` | The documentation: one Markdown file per page. |
| `lib/site.ts` | The order of the pages in the menu, the address of the repository and of the site. |
| `lib/docs.ts` | Turns the Markdown into HTML, with its code coloured, when the site is built. |

## Adding a page

Write `content/docs/my-page.md`, starting with `# Its title`, and add it to `NAV` in `lib/site.ts`. Links to other pages are written `/docs/other-page/`.
