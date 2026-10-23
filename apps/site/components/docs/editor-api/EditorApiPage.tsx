import { LIGHT_THEME, highlight } from '@/lib/docs';
import { REPO } from '@/lib/site';
import { CODE, LINK } from '../styles';
import { Callout, HandTip, SectionHead } from '../ui';
import { GROUPS, TYPES } from './data';
import { Points } from './Points';
import { LazyConsole, Reference } from './Reference';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

/** The three ways to the Editor, one for each way of using Rebodocs. */
const WAYS: [title: string, when: string, lang: string, code: string][] = [
  [
    'Without React',
    'The editor alone, in an element of yours.',
    'ts',
    `import { Editor } from '@rebodocs/editor';

const editor = new Editor(element);
editor.loadDocx(bytes);`,
  ],
  [
    'Your own interface',
    'Inside a DocsProvider, from the hook.',
    'tsx',
    `const { editor } = useDocs();

editor?.toggleMark('bold');`,
  ],
  [
    'The whole editor',
    'From the handle of DocsEditor.',
    'tsx',
    `const docs = useRef<DocsHandle>(null);
<DocsEditor ref={docs} docx={file} />

docs.current?.editor.find('deposit');`,
  ],
];

/**
 * "Editor API": the methods of the Editor, run on a real one at the top of
 * the page, and every member below by what it is for.
 */
export async function EditorApiPage() {
  const ways = await Promise.all(WAYS.map(([, , lang, code]) => highlight(code, lang, LIGHT_THEME)));
  const editCode = await highlight(
    `import { fillVariables } from '@rebodocs/core';

// A function of core, on the editor's document, as one step to undo.
editor.edit((doc) => fillVariables(doc, { client: 'Ana López' }));`,
    'ts',
    LIGHT_THEME,
  );
  const listenCode = await highlight(
    `let last = editor.doc;
let timer: ReturnType<typeof setTimeout>;

const stop = editor.onChange(() => {
  if (editor.doc === last) return;     // only the selection or the view moved
  last = editor.doc;                   // a new object: the document changed
  clearTimeout(timer);
  timer = setTimeout(() => save(editor.exportDocx()), 1000);
});

// later, when the editor goes away
stop();`,
    'ts',
    LIGHT_THEME,
  );
  const members = GROUPS.reduce((n, group) => n + group.members.reduce((m, member) => m + member.sigs.length, 0), 0);

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">Editor API</h1>
      <p className="m-0 mt-3.5 max-w-[680px] text-lg leading-[1.6] text-muted">
        The <code className="rounded-[5px] bg-hover px-1.5 py-0.5 font-code text-[15px] text-ink">Editor</code> is what everything else talks to: the toolbar, the hooks, an assistant. Here it is,
        running, with {members} of its members described below.
      </p>
      <div className="mt-4">
        <HandTip>tip: press ⌘K and type a method</HandTip>
      </div>

      <section aria-labelledby="get" className="mt-16">
        <SectionHead id="get" badge="Start here" color="blue" title="Getting the editor">
          The same object, whichever way you use Rebodocs.
        </SectionHead>
        <div className="mt-7 flex flex-col gap-3">
          {WAYS.map(([title, when], i) => (
            <div key={title} className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-border p-5">
              <div className="flex-[1_1_200px]">
                <p className="m-0 font-display text-base font-bold tracking-[-0.01em]">{title}</p>
                <p className="m-0 mt-1 text-[15px] text-ink-soft">{when}</p>
              </div>
              <div className={`min-w-0 flex-[3_1_420px] ${CODE}`} dangerouslySetInnerHTML={{ __html: ways[i] }} />
            </div>
          ))}
        </div>
        <Callout title="Each call is one step to undo.">
          Methods change the document the way a person would, and ⌘Z takes each back. To change it with the functions of <code className={mono}>@rebodocs/core</code>, which take a{' '}
          <code className={mono}>Doc</code> and give another, hand them to <code className={mono}>edit</code>:
        </Callout>
        <div className={`mt-3 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: editCode }} />
      </section>

      <section aria-labelledby="try" className="mt-24">
        <SectionHead id="try" badge="Live" color="green" title="Try it on a real editor">
          The sample document in the editor itself, with no toolbar: each button runs the method it shows, and the values under it are read from the editor after each change. Click and type in the
          page too.
        </SectionHead>
        <LazyConsole />
        <p className={prose}>
          Positions are <code className={mono}>{'{ para, offset }'}</code>: the index of a paragraph, and of a character in it. Click in the page and watch <code className={mono}>selection</code>: the
          anchor is where the selection started, the focus where it ends, so dragging backwards puts the focus first; <code className={mono}>range</code> gives them in order.
        </p>
      </section>

      <section aria-labelledby="changes" className="mt-24">
        <SectionHead id="changes" badge="Listening" color="yellow" title="Knowing when it changes">
          One listener for everything: <code className={mono}>onChange</code> is called when the document changes, when the selection moves and when the view does.
        </SectionHead>
        <p className={prose}>
          To tell them apart, compare <code className={mono}>editor.doc</code> with the one you had. The document is never changed in place: each change makes a new one, so{' '}
          <code className={mono}>!==</code> is enough, and costs nothing. The editor above counts both kinds as you use it.
        </p>
        <div className={`mt-5 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: listenCode }} />
        <p className={prose}>
          In React, <code className={mono}>useDocs().state</code> already does this for what a toolbar shows, with <code className={mono}>state.dirty</code> for “not saved yet”; see{' '}
          <a href="/docs/components/#hooks" className={LINK}>
            hooks
          </a>
          . Why a new object each time is cheap is told in{' '}
          <a href="/docs/architecture/#value" className={LINK}>
            how it works
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="reference" className="mt-24">
        <SectionHead id="reference" badge="Reference" color="purple" title="Every member, by what it is for">
          The ones marked “Run it” run on the editor above. The class has a few more, for the collaboration session; its source,{' '}
          <a href={`${REPO}/blob/main/packages/editor/src/editor.ts`} className={LINK}>
            packages/editor/src/editor.ts
          </a>
          , documents every public member.
        </SectionHead>
        <Reference />
      </section>

      <section aria-labelledby="types" className="mt-24">
        <SectionHead id="types" badge="Reference" color="blue" title="Types">
          What the methods take, as <code className={mono}>@rebodocs/core</code> defines them; <code className={mono}>@rebodocs/react</code> exports them as types too. A field whose name ends in ? may
          be left out.
        </SectionHead>
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] gap-4">
          {TYPES.map((type) => (
            <div key={type.name} id={`type-${type.name}`} className="scroll-mt-24 rounded-2xl border border-border p-5 target:border-brand">
              <p className="m-0 flex items-baseline justify-between gap-3">
                <a href={`#type-${type.name}`} className="font-code text-[15px] font-semibold text-ink hover:text-brand">
                  {type.name}
                </a>
                <a href={`${REPO}/blob/main/packages/core/src/${type.from}`} className="font-code text-xs text-muted hover:text-brand">
                  core/src/{type.from}
                </a>
              </p>
              <p className="m-0 mt-1 text-[15px] leading-[1.55] text-ink-soft">{type.text}</p>
              <dl className="m-0 mt-3">
                {type.fields.map(([name, kind, text]) => (
                  <div key={name} className="border-t border-[#f0eee9] py-2">
                    <dt className="flex flex-wrap items-baseline gap-x-2 font-code text-[13px]">
                      <span className="font-semibold text-ink">{name}</span>
                      <span className="text-pastel-purple-fg">{kind}</span>
                    </dt>
                    {text && <dd className="m-0 mt-0.5 text-sm leading-normal text-muted">{text}</dd>}
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="points" className="mt-24">
        <SectionHead id="points" badge="Good to know" color="orange" title="Points">
          Every length is in points, 1/72 of an inch, as in Word: page sizes, margins, indents, font sizes, row heights. Type a length in what you have, and set a page on the editor above.
        </SectionHead>
        <Points />
        <p className={prose}>
          On screen at zoom 1, a point is 4/3 of a CSS pixel, so a picture put in from a file comes in at its size at 96 pixels to the inch: 800 pixels wide is 600 points, made smaller when it does
          not fit the page.
        </p>
      </section>
    </>
  );
}
