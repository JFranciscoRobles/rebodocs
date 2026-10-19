import { useCallback, useEffect, useMemo, useState } from 'react'
import { DocsEditor, type Versions } from '@rebodocs/react'
import { type BucketFile, type MadePdf, listFiles, listVersions, makePdf, readFile, readUrl, saveVersion, variablesOf, writeFile } from './api'

const isDocx = (key: string) => /\.docx$/i.test(key)
const sizeOf = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`)
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** The document in the editor: its place in the bucket, and what it had when it was opened; none for a new one. */
interface Open {
  key: string
  docx?: Uint8Array
}

/** Asks for the values of a template, and has the server make the PDF with them. */
function PdfDialog({ file, onDone, onClose }: { file: string; onDone: () => void; onClose: () => void }) {
  const [names, setNames] = useState<string[]>()
  const [values, setValues] = useState<Record<string, string>>({})
  const [working, setWorking] = useState(false)
  const [made, setMade] = useState<MadePdf>()
  const [error, setError] = useState('')

  useEffect(() => {
    variablesOf(file).then(setNames, (problem) => setError(messageOf(problem)))
  }, [file])

  async function make() {
    setWorking(true)
    setError('')
    try {
      setMade(await makePdf(file, values))
      onDone()
    } catch (problem) {
      setError(messageOf(problem))
    }
    setWorking(false)
  }

  const missing = Object.entries(made?.missingFonts ?? {})
  return (
    <div className="scrim" onClick={onClose}>
      <form
        className="dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          void make()
        }}
      >
        <h2>A PDF made on the server</h2>
        <p>
          The server reads <code>{file}</code> from the bucket as it was last saved, fills its variables, lays it out and stores the PDF beside it.
        </p>
        {!names && !error && <p className="quiet">Reading the variables…</p>}
        {names?.length === 0 && <p className="quiet">This document has no variables: the PDF is the document as it is.</p>}
        {names?.map((name) => (
          <label key={name}>
            {name}
            <input value={values[name] ?? ''} onChange={(e) => setValues({ ...values, [name]: e.target.value })} />
          </label>
        ))}
        {error && <p className="bad">{error}</p>}
        {made && (
          <p className="good">
            <a href={made.url} target="_blank" rel="noreferrer">{made.key}</a> is in the bucket: {made.pages} {made.pages === 1 ? 'page' : 'pages'}.
            {missing.length > 0 && ` The server has no font for ${missing.map(([family, used]) => `${family} (it used ${used})`).join(', ')}, so lines may break elsewhere.`}
          </p>
        )}
        <div className="row">
          <button type="button" onClick={onClose}>Close</button>
          <button className="primary" disabled={!names || working}>{working ? 'Making it…' : 'Make the PDF'}</button>
        </div>
      </form>
    </div>
  )
}

export function App() {
  const [files, setFiles] = useState<BucketFile[]>()
  const [open, setOpen] = useState<Open>()
  const [status, setStatus] = useState<{ text: string; bad?: boolean }>({ text: '' })
  const [pdf, setPdf] = useState(false)
  const say = (text: string) => setStatus({ text })
  const fail = (problem: unknown) => setStatus({ text: messageOf(problem), bad: true })

  const refresh = useCallback(() => listFiles().then(setFiles, fail), [])
  useEffect(() => {
    void refresh()
  }, [refresh])

  async function show(file: BucketFile) {
    try {
      // A PDF is for reading: the browser opens it from the bucket, with an address good for a few minutes.
      if (!isDocx(file.key)) return void window.open(await readUrl(file.key), '_blank', 'noopener')
      say(`Opening ${file.key}…`)
      setOpen({ key: file.key, docx: await readFile(file.key) })
      say('')
    } catch (problem) {
      fail(problem)
    }
  }

  function create() {
    const name = window.prompt('A name for the new document', 'untitled')?.trim()
    if (!name) return
    const key = isDocx(name) ? name : `${name}.docx`
    if (files?.some((file) => file.key === key) && !window.confirm(`${key} is in the bucket already. Saving will replace it.`)) return
    setOpen({ key })
    say(`${key} goes to the bucket when you save it.`)
  }

  // Each save keeps a version too, beside the document: the panel lists them, compares them and goes back to one.
  const versions = useMemo<Versions | undefined>(
    () =>
      open && {
        list: () => listVersions(open.key),
        load: (id) => readFile(id),
        save: (docx, meta) => saveVersion(open.key, docx, meta),
      },
    [open?.key],
  )

  async function save(docx: Uint8Array) {
    if (!open) return
    try {
      say(`Saving ${open.key}…`)
      await writeFile(open.key, docx)
      await saveVersion(open.key, docx)
      say(`${open.key} saved, ${sizeOf(docx.length)}, and kept as a version.`)
      void refresh()
    } catch (problem) {
      fail(problem)
    }
  }

  const stored = !!open && !!files?.some((file) => file.key === open.key)
  return (
    <div className="app">
      <aside className="files">
        <header>
          <strong>The bucket</strong>
          <button onClick={() => void refresh()} title="Read the list again">↻</button>
          <button className="primary" onClick={create}>New</button>
        </header>
        {!files && !status.bad && <p className="quiet">Reading the bucket…</p>}
        {files?.length === 0 && (
          <p className="quiet">
            It is empty. <code>npm run seed</code> puts a sample contract in it, or start a new document here.
          </p>
        )}
        <ul>
          {files?.map((file) => (
            <li key={file.key}>
              <button className={file.key === open?.key ? 'on' : ''} onClick={() => void show(file)}>
                <span className={`kind ${isDocx(file.key) ? 'docx' : 'pdf'}`}>{isDocx(file.key) ? 'DOCX' : 'PDF'}</span>
                <span className="name">{file.key}</span>
                <small>
                  {sizeOf(file.size)} · {new Date(file.modified).toLocaleString()}
                </small>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <main className="stage">
        <div className="bar">
          <span className={status.bad ? 'bad' : 'quiet'}>{status.text || (open ? open.key : 'Open a document of the bucket, or start a new one.')}</span>
          <button disabled={!stored} title={open && !stored ? 'Save it first: the server makes the PDF from what is in the bucket' : undefined} onClick={() => setPdf(true)}>
            PDF on the server…
          </button>
        </div>
        <div className="editor">
          {open ? (
            // Made again for another document: the key is its place in the bucket.
            <DocsEditor key={open.key} className="fill" docx={open.docx} name={open.key.split('/').pop()} locale="en" versions={versions} onSave={(docx) => save(docx)} onError={(message) => fail(new Error(message))} />
          ) : (
            <p className="empty">Nothing open.</p>
          )}
        </div>
      </main>
      {pdf && open && <PdfDialog file={open.key} onDone={() => void refresh()} onClose={() => setPdf(false)} />}
    </div>
  )
}
