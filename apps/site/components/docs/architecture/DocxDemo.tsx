'use client';

import { useState } from 'react';
import { DemoBox, Readout } from '../ui';

/** The paragraphs of a file as it came, each with a property the model does not know, and what it says once changed. */
const PARAGRAPHS = [
  { text: 'Receipt', edited: 'Receipt No. 1024', pPr: '<w:pStyle w:val="Title"/><w:suppressLineNumbers/>', unknown: 'w:suppressLineNumbers' },
  { text: 'Payment is due within 15 days.', edited: 'Payment is due within 30 days.', pPr: '<w:snapToGrid w:val="0"/>', unknown: 'w:snapToGrid' },
  { text: 'Late payments add a fee.', edited: 'Late payments add a fee each month.', pPr: '<w:kinsoku w:val="0"/>', unknown: 'w:kinsoku' },
  { text: 'Signed, Ana', edited: 'Signed, Ana López', pPr: '<w:textAlignment w:val="top"/>', unknown: 'w:textAlignment' },
];
/** A paragraph's XML, simplified: its properties as they came, and a run with the text. */
const xmlOf = (pPr: string, text: string) => `<w:p><w:pPr>${pPr}</w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;

/** The XML, with the property the model does not know in purple and the new text in yellow. */
function Xml({ xml, unknown, text }: { xml: string; unknown: string; text?: string }) {
  const pieces = xml.split(new RegExp(`(${unknown}|${text ? text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '$^'})`));
  return (
    <code className="block whitespace-pre-wrap break-all rounded-lg bg-surface px-3 py-2.5 font-code text-[12px] leading-[1.6] text-ink-soft">
      {pieces.map((piece, i) =>
        piece === unknown ? (
          <mark key={i} className="rounded-[3px] bg-pastel-purple px-0.5 text-pastel-purple-fg">
            {piece}
          </mark>
        ) : piece === text ? (
          <mark key={i} className="rounded-[3px] bg-pastel-yellow px-0.5 text-pastel-yellow-fg">
            {piece}
          </mark>
        ) : (
          piece
        ),
      )}
    </code>
  );
}

const paragraphs = (n: number) => `${n} ${n === 1 ? 'paragraph' : 'paragraphs'}`;
/** Parts of the file the editor never reads. */
const UNREAD = ['word/theme/theme1.xml', 'word/settings.xml', 'customXml/item1.xml'];

/** Open, change some paragraphs, save: what is written back as it was, what is written again, what is carried through. */
export function DocxDemo() {
  const [changed, setChanged] = useState<Set<number>>(new Set([1]));
  const [saved, setSaved] = useState(false);
  const [look, setLook] = useState(1);

  const flip = (i: number) => {
    setLook(i);
    const next = new Set(changed);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setChanged(next);
    setSaved(false);
  };

  return (
    <DemoBox
      aside={
        <>
          <Readout
            label={saved ? 'What was written' : 'Not saved yet'}
            lines={
              saved
                ? [
                    ['byte for byte', paragraphs(PARAGRAPHS.length - changed.size), 'good'],
                    ['written again', paragraphs(changed.size), changed.size ? 'warn' : 'dim'],
                    ['unknown properties', 'all kept', 'good'],
                    ['copied through', `${UNREAD.length} parts never read`, 'good'],
                  ]
                : [['save', 'press “Save” to see', 'dim']]
            }
          />
          <p className="m-0 text-[15px] leading-[1.6] text-ink-soft">
            Each paragraph remembers the XML it came from. Change none and save: the file comes out the same — that is tested on a set of real documents.
          </p>
        </>
      }
    >
      <p className="m-0 text-sm text-muted">Mark the paragraphs you changed, then save.</p>
      <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
        {PARAGRAPHS.map((para, i) => {
          const edited = changed.has(i);
          const state = !saved ? '' : edited ? 'border-[#e8c66a] bg-pastel-yellow' : 'border-[#b7dcc0] bg-pastel-green';
          return (
            <li key={para.text} className={`rounded-lg border px-3 py-2 transition-colors duration-300 ${state || 'border-border bg-white'}`}>
              <label className="flex cursor-pointer items-center gap-2.5">
                <input type="checkbox" checked={edited} onChange={() => flip(i)} className="size-4 accent-brand" />
                <span className="min-w-0 flex-1 text-sm text-[#37352f]">{edited ? para.edited : para.text}</span>
                {saved && <span className={`flex-none text-xs font-semibold ${edited ? 'text-pastel-yellow-fg' : 'text-pastel-green-fg'}`}>{edited ? 'written again' : 'byte for byte'}</span>}
              </label>
              <code className="mt-1 block truncate pl-6.5 font-code text-[11.5px] text-muted">
                {'<w:pPr>'}
                <mark className="rounded-[3px] bg-pastel-purple px-0.5 text-pastel-purple-fg">{para.unknown}</mark>
                {'…'}
              </code>
            </li>
          );
        })}
      </ul>
      <p className="m-0 mt-4 text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">Parts it never reads</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {UNREAD.map((part) => (
          <code key={part} className={`rounded-md border px-2 py-0.75 font-code text-[12px] transition-colors duration-300 ${saved ? 'border-[#b7dcc0] bg-pastel-green text-pastel-green-fg' : 'border-border bg-surface text-muted'}`}>
            {part}
            {saved && ' ✓'}
          </code>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={() => setSaved(true)} className="h-9 cursor-pointer rounded-lg border-0 bg-brand px-3.5 text-sm font-semibold text-white hover:bg-brand-hover">
          Save
        </button>
        <span className="text-[13px] text-muted">
          <mark className="rounded-[3px] bg-pastel-purple px-1 text-pastel-purple-fg">purple</mark> is what the model does not know, and keeps.
        </span>
      </div>
      {saved && <Written para={PARAGRAPHS[look]} edited={changed.has(look)} onPick={setLook} />}
    </DemoBox>
  );
}

/** One paragraph's XML as it came and as it was written, side by side. */
function Written({ para, edited, onPick }: { para: (typeof PARAGRAPHS)[number]; edited: boolean; onPick: (i: number) => void }) {
  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="docx-look" className="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">
          The XML of
        </label>
        <select
          id="docx-look"
          value={PARAGRAPHS.indexOf(para)}
          onChange={(event) => onPick(Number(event.target.value))}
          className="h-8 rounded-lg border border-border-strong bg-white px-2 text-[13px] text-ink"
        >
          {PARAGRAPHS.map((p, i) => (
            <option key={p.text} value={i}>
              {p.text}
            </option>
          ))}
        </select>
        <span className="text-[12px] text-muted">simplified</span>
      </div>
      <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3">
        <div>
          <p className="m-0 mb-1.5 text-[13px] text-muted">As it came</p>
          <Xml xml={xmlOf(para.pPr, para.text)} unknown={para.unknown} />
        </div>
        <div>
          <p className="m-0 mb-1.5 text-[13px] text-muted">{edited ? 'Written again: the properties patched, not rebuilt' : 'Written: the very same bytes'}</p>
          <Xml xml={xmlOf(para.pPr, edited ? para.edited : para.text)} unknown={para.unknown} text={edited ? para.edited : undefined} />
        </div>
      </div>
    </div>
  );
}
