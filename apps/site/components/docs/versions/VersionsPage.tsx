import { compareDocs } from '@rebodocs/core';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import CompareDemo from './CompareDemo';
import { Compared } from './Compared';
import { COMPARISON, CURRENT, FUNCTIONS, INFO, KEPT, MEMBERS } from './data';
import { LazyHistoryDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

/** What changed from the last version of the demo to the document as it is now, worked out by compareDocs when the site is built. */
const EXAMPLE = compareDocs(KEPT[KEPT.length - 1].doc, CURRENT).doc;

function Fields({ rows }: { rows: { name: string; type: string; text: string }[] }) {
  return (
    <dl className="m-0 mt-4 max-w-[920px] rounded-2xl border border-border px-5">
      {rows.map((field) => (
        <div key={field.name} className="border-t border-[#f0eee9] py-3 first:border-t-0">
          <dt className="font-code text-[13.5px] text-ink">
            <span className="font-semibold">{field.name}</span>: <span className="text-muted">{field.type}</span>
          </dt>
          <dd className="m-0 mt-1 text-[15px] leading-normal text-ink-soft">{field.text}</dd>
        </div>
      ))}
    </dl>
  );
}

function Signatures({ rows }: { rows: { sig: string; text: string }[] }) {
  return (
    <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
      {rows.map((m) => (
        <div key={m.sig} className="border-t border-[#f0eee9] py-3 first:border-t-0">
          <dt className="font-code text-[13.5px] font-semibold text-ink">{m.sig}</dt>
          <dd className="m-0 mt-1 text-[15px] leading-normal text-ink-soft">{m.text}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * "Versions": the versions an application keeps, given to a real editor on the
 * page, compareDocs on texts typed here, what a shared room does, the tool of
 * an assistant and what a comparison leaves out.
 */
export async function VersionsPage() {
  const [prop, core, mcp] = await Promise.all([
    highlight(
      `<DocsEditor
  docx={file}
  onSave={(docx) => upload(docx)}
  versions={{
    list: () => api.versions(documentId),
    load: (id) => api.version(documentId, id),
    save: (docx, { label, author }) => api.keepVersion(documentId, docx, label, author),
  }}
/>`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `import { compareDocs, describeChange, importDocx, restoreVersion } from '@rebodocs/core';

const before = importDocx(earlierBytes);
const after = importDocx(laterBytes);
const { changes, notes, doc, marks } = compareDocs(before, after);

for (const change of changes) console.log(change.kind, change.part ?? 'text', describeChange(change));
// changed text   Payment is due within [-15-]{+30+} days of this receipt.

const back = restoreVersion(after, before);   // the document to put in place of after`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `5 changes from the file to the document; the numbers in brackets are those of this document's paragraphs:
[1] changed: Reservation receipt{+ for room 12+}
[3] same text, another look: Late payments add a fee of 2% a month.
[4] changed: Either party may cancel [-by phone or -]in writing.
(only in the file, its paragraph 5) taken out: [-Prices include taxes.-]
[5] put in: {+Keys are returned at the front desk.+}`,
      'bash',
      LIGHT_THEME,
    ),
  ]);

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">Versions</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        A version is a copy of the document as it was at some moment, kept as a DOCX. Rebodocs does not store versions: your application keeps them wherever it keeps its documents. Rebodocs lists
        them, compares any two, and takes the document back to one.
      </p>
      <Compared paragraphs={EXAMPLE.paragraphs} className="mt-6 max-w-[760px] rounded-[10px] bg-surface px-5 py-4 text-[17px] leading-[1.6] text-ink" />
      <div className="mt-4">
        <HandTip>tip: what changed since “Sent to the client”, compared below</HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge="Live" color="green" title="Your versions">
          A real editor, given two versions this page keeps in memory as your server would keep them. Open <strong>See changes</strong> on one, go from change to change, look at it unmarked, or{' '}
          <strong>Restore</strong> it; keep a version of your own with a name.
        </SectionHead>
        <LazyHistoryDemo />
        <p className={prose}>
          Compare with “First draft” and pick the other version under <em>To</em>: two versions compare as well as a version and the document. A line made bold is a change of look: listed, but the
          line is not marked.
        </p>
      </section>

      <section aria-labelledby="in-the-editor" className="mt-24">
        <SectionHead id="in-the-editor" badge="The interface" color="blue" title="In the editor">
          Give the component your versions, and the side panel gets a <strong>Versions</strong> tab, the newest first.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: prop }} />
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4">
          {[
            {
              title: 'See changes',
              color: 'blue' as const,
              text: 'Over the pages, what changed from that version to the document as it is now, or to another version. Taken out struck through in red where it was, put in underlined in green. The document under it is not touched.',
            },
            {
              title: 'Restore',
              color: 'purple' as const,
              text: 'The version in place of the document, as one change: undo leaves it as it was. From the list, or from the comparison.',
            },
            {
              title: 'Save version',
              color: 'pink' as const,
              text: 'With save, keeps the document as it is now, with an optional name, signed with the author of the editor. Enter in the name saves it too.',
            },
          ].map((card) => (
            <div key={card.title} className="rounded-2xl border border-border p-5">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[card.color]}`}>{card.title}</span>
              <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{card.text}</p>
            </div>
          ))}
        </div>
        <h3 id="versions-prop" className="m-0 mt-12 scroll-mt-24 font-display text-xl font-bold tracking-[-0.01em]">
          The versions prop
        </h3>
        <Signatures rows={MEMBERS} />
        <h3 className="m-0 mt-10 font-display text-xl font-bold tracking-[-0.01em]">VersionInfo</h3>
        <Fields rows={INFO} />
        <h3 id="comparison-keys" className="m-0 mt-10 scroll-mt-24 font-display text-xl font-bold tracking-[-0.01em]">
          In the comparison
        </h3>
        <dl className="m-0 mt-4 max-w-[920px] rounded-2xl border border-border px-5">
          {[
            ['‹ ›, Alt+↑ Alt+↓', 'From one change to the next, as in Word’s comparison.'],
            ['With the changes marked · Unmarked', 'The later version marked, or the earlier one as it was.'],
            ['From · To', 'The two versions compared; To is the current document unless another is picked.'],
            ['Esc', 'Closes it, and gives the keyboard back to where it was.'],
          ].map(([key, text]) => (
            <div key={key} className="grid gap-x-6 border-t border-[#f0eee9] py-3 first:border-t-0 sm:grid-cols-[260px_1fr]">
              <dt className="text-[15px] font-semibold text-ink">{key}</dt>
              <dd className="m-0 text-[15px] leading-normal text-ink-soft">{text}</dd>
            </div>
          ))}
        </dl>
        <p className={prose}>
          The count says how many changes there are in the text, how many in headers, footers, notes at the foot of the page and text boxes, and how many notes on the text were written, taken out or
          changed. The document compared is the one a save would write: what a DOCX cannot hold is no change.
        </p>
      </section>

      <section aria-labelledby="in-code" className="mt-24">
        <SectionHead id="in-code" badge="@rebodocs/core" color="orange" title="In code">
          Any two versions, on a server or in the browser: paragraph by paragraph, and word by word inside one that changed. Change either text below.
        </SectionHead>
        <CompareDemo />
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: core }} />
        <h3 className="m-0 mt-10 font-display text-xl font-bold tracking-[-0.01em]">Comparison</h3>
        <Fields rows={COMPARISON} />
        <h3 className="m-0 mt-10 font-display text-xl font-bold tracking-[-0.01em]">The functions</h3>
        <Signatures rows={FUNCTIONS} />
        <p className={prose}>
          A version with tracked changes is compared as if they were all accepted, as Word compares: what someone took out and nobody decided on is not counted as there.{' '}
          <code className={mono}>editor.readOnly = true</code> makes an editor for reading only, which is how the comparison is shown.
        </p>
      </section>

      <section aria-labelledby="in-a-real-time-document" className="mt-24">
        <SectionHead id="in-a-real-time-document" badge="Collaboration" color="purple" title="In a real-time document" />
        <p className={prose}>
          Restoring a version in a shared room sends the others only what changed, as any other edit does: paragraphs that are the same in both stay as they are, and the pictures of the version travel
          with it.
        </p>
        <p className={prose}>
          The collaboration server keeps no versions. With <code className={mono}>--backend</code>, your system receives each save (<code className={mono}>PUT url/&lt;id&gt;</code>), and the last one
          of a session of work, when everybody has left, says so with <code className={mono}>X-Rebodocs-Session-End: 1</code> and names who changed the document in{' '}
          <code className={mono}>X-Rebodocs-Authors</code>: the moment to keep a version, signed by them. See{' '}
          <a href="/docs/collaboration/#a-version-for-each-session" className={LINK}>
            a version for each session
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="for-an-assistant" className="mt-24">
        <SectionHead id="for-an-assistant" badge="MCP" color="pink" title="For an assistant">
          The{' '}
          <a href="/docs/assistants/" className={LINK}>
            MCP server
          </a>{' '}
          has <code className={mono}>compare_documents</code>: what changed between the open document and another version of it in a file, by the numbers of the document&apos;s paragraphs, and the
          notes on the text written, taken out or changed.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: mcp }} />
        <p className={prose}>
          The file is the earlier version unless <code className={mono}>file_is</code> is <code className={mono}>&quot;later&quot;</code>. It lists at most 200 changes; the tool changes nothing.
        </p>
      </section>

      <section aria-labelledby="the-storage-demo" className="mt-24">
        <SectionHead id="the-storage-demo" badge="Demo" color="green" title="The storage demo" />
        <p className={prose}>
          <a href="/docs/storage/" className={LINK}>
            The storage demo
          </a>{' '}
          keeps a version each time a document is saved, as a file beside it under <code className={mono}>versions/&lt;document&gt;/</code>. Its key holds when it was kept, who kept it and its name,
          so one listing request gives them all.
        </p>
      </section>

      <section aria-labelledby="know" className="mt-24">
        <SectionHead id="know" badge="Limits" color="yellow" title="What it does not do" />
        <ul className="m-0 mt-5 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-x-8 gap-y-3 p-0">
          {[
            'A comparison is of what the document reads and how its text looks. It leaves out the page, the sections, the definitions of the styles and the size of a picture. Rows and columns of a table show only through the paragraphs of their cells.',
            'A change of look, and a note on the text written, taken out or changed, is listed, but not marked in the comparison.',
            'Paragraphs of a table that is gone are shown, struck through, where the table was, not inside a table.',
            'A paragraph that changed is written back as an edit would write it; one that did not change keeps its own XML.',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-[15px] leading-[1.55] text-ink-soft">
              <span aria-hidden="true" className="mt-2 size-1.5 flex-none rounded-full bg-[#c9c6bf]" />
              {item}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
