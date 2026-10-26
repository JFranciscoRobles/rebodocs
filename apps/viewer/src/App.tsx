import { useEffect, useRef, useState } from 'react';
import { pagePicture, type Viewer, type ViewerLayout } from '@rebodocs/viewer';
import { DocsViewer } from '@rebodocs/viewer/react';
import './App.css';

interface Shelved {
  name: string;
  bytes: Uint8Array;
  /** The address of its first page as a JPEG, once it is drawn. */
  thumbnail?: string;
  failed?: boolean;
}

const SAMPLES = `${import.meta.env.BASE_URL}samples/`;

export default function App() {
  const [shelf, setShelf] = useState<Shelved[]>([]);
  const [open, setOpen] = useState<Shelved>();

  // The samples `scripts/samples.ts` puts in public/, unless they are not there.
  useEffect(() => {
    let gone = false;
    fetch(`${SAMPLES}index.json`)
      .then((answer) => (answer.ok ? (answer.json() as Promise<string[]>) : []))
      .then((names) => Promise.all(names.map(async (name) => ({ name, bytes: new Uint8Array(await (await fetch(SAMPLES + name)).arrayBuffer()) }))))
      .then((found) => !gone && setShelf((now) => [...found, ...now]))
      .catch(() => {});
    return () => {
      gone = true;
    };
  }, []);

  // A thumbnail for each document that has none: one at a time, as the viewer makes them.
  const drawing = useRef(new Set<Uint8Array>());
  useEffect(() => {
    for (const item of shelf) {
      if (item.thumbnail || item.failed || drawing.current.has(item.bytes)) continue;
      drawing.current.add(item.bytes);
      pagePicture(item.bytes, 480)
        .then((jpeg) => ({ thumbnail: URL.createObjectURL(jpeg) }))
        .catch(() => ({ failed: true }))
        .then((drawn) => setShelf((now) => now.map((other) => (other.bytes === item.bytes ? { ...other, ...drawn } : other))));
    }
  }, [shelf]);

  async function add(files: FileList | null) {
    const read = await Promise.all([...(files ?? [])].map(async (file) => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })));
    setShelf((now) => [...read, ...now]);
  }

  return open ? (
    <Reader item={open} onClose={() => setOpen(undefined)} />
  ) : (
    <div className="shelf">
      <header className="top">
        <strong>rebodocs viewer</strong>
        <label className="button">
          Open .docx
          <input type="file" accept=".docx" multiple hidden onChange={(event) => add(event.target.files)} />
        </label>
      </header>
      {shelf.length === 0 ? (
        <p className="empty">Open a .docx to see it here.</p>
      ) : (
        <ul className="grid">
          {shelf.map((item) => (
            <li key={`${item.name}-${shelf.indexOf(item)}`}>
              <button type="button" className="card" onClick={() => setOpen(item)}>
                <span className="thumb">{item.thumbnail ? <img src={item.thumbnail} alt="" /> : <span className="wait">{item.failed ? 'No preview' : ''}</span>}</span>
                <span className="name">{item.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Reader({ item, onClose }: { item: Shelved; onClose: () => void }) {
  const [layout, setLayout] = useState<ViewerLayout>('pages');
  const [viewer, setViewer] = useState<Viewer>();
  return (
    <div className="reader">
      <header className="top">
        <button type="button" className="button" onClick={onClose} aria-label="Back to the documents">
          ←
        </button>
        <strong className="title">{item.name}</strong>
        <button type="button" className="button wide-only" onClick={() => setLayout(layout === 'pages' ? 'all' : 'pages')}>
          {layout === 'pages' ? 'All pages' : 'One by one'}
        </button>
        <button type="button" className="button" disabled={!viewer} onClick={() => viewer?.print()}>
          Print
        </button>
      </header>
      <DocsViewer docx={item.bytes} layout={layout} locale="en" className="pages" onReady={setViewer} />
    </div>
  );
}
