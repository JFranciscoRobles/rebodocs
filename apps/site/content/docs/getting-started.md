# Getting started

Every package is on npm: [`@rebodocs/react`](https://www.npmjs.com/package/@rebodocs/react) for React and Next.js, and the engine, the editor without a framework, collaboration and the tools for an assistant by themselves. [Packages](/docs/packages/) says which to take.

## Put it in a React application

```bash
npm install @rebodocs/react
```

It is one package with the engine, the editor and the collaboration client inside. React 18 or later is its only peer.

Use the component. The element it is in must have a height:

```tsx
'use client';
import { DocsEditor } from '@rebodocs/react';

export default function Page() {
  return (
    <div style={{ height: '100vh' }}>
      <DocsEditor name="untitled.docx" locale="en" onSave={(docx, name) => console.log(name, docx.byteLength)} />
    </div>
  );
}
```

That gives an empty document. To open a file, pass its bytes as `docx`. See [React component](/docs/react/).

No React? The same package has the whole editor without it: `import { mountDocs } from '@rebodocs/react/mount'`. See [Without a framework](/docs/vanilla/).

## Run the repository

To try everything, change the code, or use the packages that are not published yet:

```bash
git clone https://github.com/JFranciscoRobles/rebodocs.git
cd rebodocs
npm install
npm run dev
```

Open `http://localhost:5173`. That is the playground: the editor with everything switched on. Open a Word file from the menu and edit it.

You need Node 22.12 or later.

## Use the engine in Node

Inside the repository, the packages import each other as TypeScript source. Scripts run with `vite-node`:

```ts
// tools/my-script.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { importDocx, fillVariables, exportDocx } from '../packages/core/src/index';

const doc = importDocx(new Uint8Array(readFileSync('template.docx')));
writeFileSync('out.docx', exportDocx(fillVariables(doc, { client: 'Ana Pérez' })));
```

```bash
npx vite-node tools/my-script.ts
```

Or use the tool that is already there:

```bash
npm run generate -- template.docx data.json -o out.pdf
```

See [On a server](/docs/server/).

## Where to go next

- [React component](/docs/react/): every prop.
- [Headless](/docs/headless/): your own toolbar and panels, with Tailwind.
- [Templates and variables](/docs/templates/): documents that fill themselves.
- [Real-time collaboration](/docs/collaboration/): several people at once.
- [AI assistants](/docs/assistants/): Claude Desktop on your documents, or Claude in a chat of your application.
- [Demos to run](/docs/demos/): the React package, an S3 bucket, real time and Claude in the editor, each as a small application.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | The playground, with hot reload. |
| `npm run demo` | The React package, two ways. |
| `npm run storage` | The demo of documents in an S3 bucket. |
| `npm run realtime` | The demo of several people on one document. |
| `npm run assistant` | The demo of Claude in a shared document; needs a key of the Claude API. |
| `npm run desktop` | The desktop application, with Tauri; needs Rust. |
| `npm test` | The tests. |
| `npm run typecheck` | Types, over every package. |
| `npm run build:react` | Builds and packs `@rebodocs/react`. |
| `npm run build:packages` | Builds core, editor, collab and mcp, each into its `dist/`, to publish. |
| `npm run generate -- template.docx data.json -o out.pdf` | Fills a template without a browser. |
| `npm run collab` | The collaboration server; `npx @rebodocs/collab` outside the repository. |
| `npm run mcp` | The MCP server for AI assistants; `npx @rebodocs/mcp` outside the repository. |
| `npm run locale -- fr texts/fr.json` | Starts or updates a translation of the interface. |
| `npm run site` | This website, locally. |
