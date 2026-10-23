import { useEffect, useState } from 'react';
import { FullEditor } from './FullEditor';
import { HeadlessEditor } from './HeadlessEditor';
import './App.css';

type Mode = 'full' | 'screen' | 'headless';

function App() {
  const [mode, setMode] = useState<Mode>(location.hash === '#headless' ? 'headless' : location.hash === '#screen' ? 'screen' : 'full');
  const [docx, setDocx] = useState<Uint8Array>();
  const [name, setName] = useState('documento.docx');

  // Opens with the sample `scripts/sample.ts` writes, unless the person has opened a file of their own meanwhile.
  useEffect(() => {
    let gone = false;
    fetch(`${import.meta.env.BASE_URL}sample.docx`)
      .then((answer) => (answer.ok ? answer.arrayBuffer() : Promise.reject(new Error(String(answer.status)))))
      .then((bytes) => {
        if (gone) return;
        setDocx((now) => now ?? new Uint8Array(bytes));
        setName((now) => (now === 'documento.docx' ? 'agreement.docx' : now));
      })
      .catch(() => {});
    return () => {
      gone = true;
    };
  }, []);

  async function open(file: File | undefined) {
    if (!file) return;
    setDocx(new Uint8Array(await file.arrayBuffer()));
    setName(file.name);
  }

  return (
    <div className={`app ${mode}`}>
      <header className="bar">
        <strong>rebodocs demo</strong>
        <nav className="tabs">
          <button className={mode === 'full' ? 'on' : ''} onClick={() => setMode('full')}>
            DocsEditor
          </button>
          <button className={mode === 'screen' ? 'on' : ''} onClick={() => setMode('screen')}>
            Another layout
          </button>
          <button className={mode === 'headless' ? 'on' : ''} onClick={() => setMode('headless')}>
            Headless
          </button>
        </nav>
        <label className="open">
          Open a .docx
          <input type="file" accept=".docx" hidden onChange={(e) => open(e.target.files?.[0])} />
        </label>
      </header>
      <main className="stage">
        {mode !== 'headless' ? <FullEditor key={mode} docx={docx} name={name} layout={mode === 'screen' ? 'another' : 'included'} /> : <HeadlessEditor docx={docx} name={name} />}
      </main>
    </div>
  );
}

export default App;
