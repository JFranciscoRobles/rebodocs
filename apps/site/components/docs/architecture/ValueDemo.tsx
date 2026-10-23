'use client';

import { useState } from 'react';
import { DemoBox, Readout } from '../ui';

/** A paragraph, with the number of the object it is: the same number is the same object. */
interface Para {
  object: number;
  text: string;
}

const START: Para[] = [
  { object: 1, text: 'Receipt' },
  { object: 2, text: 'Payment is due within 15 days.' },
  { object: 3, text: 'Late payments add a fee.' },
  { object: 4, text: 'Signed, Ana' },
];
const WORDS = ['Hello', 'Now', 'Note:', 'Also'];
const MAX = 8;

function Column({ title, doc, other, onEdit }: { title: string; doc: Para[]; other?: Para[]; onEdit?: (i: number) => void }) {
  return (
    <div className="min-w-0 flex-[1_1_220px]">
      <p className="m-0 font-code text-[13px] font-medium text-muted">{title}</p>
      <ol className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
        {doc.map((para, i) => {
          const shared = other ? other[i]?.object === para.object : undefined;
          const look = shared === undefined ? 'border-border bg-white' : shared ? 'border-[#b7dcc0] bg-pastel-green' : 'border-[#e8c66a] bg-pastel-yellow';
          const body = (
            <>
              <span className="min-w-0 flex-1 truncate text-sm text-[#37352f]">{para.text}</span>
              <span className="flex-none font-code text-[11px] text-muted">#{para.object}</span>
            </>
          );
          return (
            <li key={i}>
              {onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(i)}
                  aria-label={`Type in paragraph ${i}: ${para.text}`}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors duration-300 hover:border-brand ${look}`}
                >
                  {body}
                </button>
              ) : (
                <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors duration-300 ${look}`}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Typing makes a new document that shares every paragraph it did not touch; undo is going back to the one before. */
export function ValueDemo() {
  const [versions, setVersions] = useState<Para[][]>([START]);
  const [made, setMade] = useState(START.length);
  const [last, setLast] = useState<number>();

  const doc = versions[versions.length - 1];
  const before = versions[versions.length - 2];
  const shared = before ? doc.filter((para, i) => before[i].object === para.object).length : doc.length;

  const edit = (i: number) => {
    const word = WORDS[(versions.length - 1) % WORDS.length];
    const next = doc.map((para, j) => (j === i ? { object: made + 1, text: `${word} ${para.text}` } : para));
    setVersions([...versions, next].slice(-MAX));
    setMade(made + 1);
    setLast(i);
  };

  return (
    <DemoBox
      aside={
        <>
          <Readout
            label="What the engine sees"
            lines={[
              ['versions kept', String(versions.length), 'good'],
              ['shared with the last one', before ? `${shared} of ${doc.length} paragraphs` : '—', before ? 'good' : 'dim'],
              ['made again', before ? `${doc.length - shared} (paragraph ${last})` : '—', before ? 'warn' : 'dim'],
              ['laid out again', before ? `${doc.length - shared} of ${doc.length}: the rest keep their lines` : '—', before ? 'warn' : 'dim'],
              ['sent to the others', before ? `one change, naming paragraph ${last}` : '—', before ? 'warn' : 'dim'],
              ['how it is found', before ? 'doc.paragraphs[i] !== before.paragraphs[i]' : '—', 'dim'],
            ]}
          />
          <p className="m-0 text-[15px] leading-[1.6] text-ink-soft">
            Green is the very same object in both documents: nothing to copy, nothing to lay out again, nothing to send. Yellow is the one paragraph made again — the only one the layout below breaks
            into lines again, and the only one the change sent to the others is about.
          </p>
        </>
      }
    >
      <p className="m-0 text-sm text-muted">Click a paragraph to type in it. The number is which object it is.</p>
      <div className="mt-4 flex flex-wrap gap-5">
        {before && <Column title="before" doc={before} />}
        <Column title={before ? 'next' : 'doc'} doc={doc} other={before} onEdit={edit} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!before}
          onClick={() => setVersions(versions.slice(0, -1))}
          className="h-9 cursor-pointer rounded-lg border border-border-strong bg-white px-3 text-sm text-ink hover:bg-hover disabled:cursor-default disabled:opacity-40"
        >
          Undo: go back to the one before
        </button>
        <button type="button" onClick={() => setVersions([START])} className="cursor-pointer border-0 bg-transparent text-[13px] text-muted underline">
          Start again
        </button>
      </div>
    </DemoBox>
  );
}
