import { PLURALS, messages } from '@rebodocs/editor';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { FUNCTIONS, WHAT } from './data';
import { LazySwitcher } from './Lazy';
import { type TextRow, Texts } from './Texts';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

/** What `npm run locale` does to a file that is there, from tools/locale.ts. */
const UPDATE: [title: string, text: string][] = [
  ['Keeps', 'every text already in the file, translated or not.'],
  ['Adds', 'the texts the interface gained since, in English (or in the language of --from).'],
  ['Takes out', 'the keys the interface no longer has.'],
  ['Says', 'how many texts there are, how many are new, and how many still read as in English; up to 20, by key.'],
];

/**
 * "Languages": the editor switched between Spanish, English and a French
 * started on the page, how to add a language and keep it up to date, and
 * every text of the interface, read from @rebodocs/editor when the site is built.
 */
export async function LanguagesPage() {
  const es = messages('es');
  const en = messages('en');
  const rows: TextRow[] = Object.keys(en).map((key) => [key, es[key as keyof typeof es], en[key as keyof typeof en]]);
  const placeholders = rows.filter(([, , text]) => /\{\w+\}/.test(text)).length;
  const counted = Object.keys(PLURALS);
  // The forms npm run locale adds for a language, as tools/locale.ts works them out: none for one and other alone.
  const formsOf = (code: string) => {
    const categories = new Intl.PluralRules(code).resolvedOptions().pluralCategories.filter((category) => category !== 'other');
    return categories.some((category) => category !== 'one') ? categories : [];
  };
  const inFrench = rows.length + counted.length * formsOf('fr').length;

  const spelling = await highlight(
    `import { DocsEditor, createSpellChecker } from '@rebodocs/react';

// Once for the page: each dictionary is loaded the first time a text in its language is checked.
const spellcheck = createSpellChecker({
  dictionaries: {
    es: { aff: '/dictionaries/es.aff', dic: '/dictionaries/es.dic' },
    en: { aff: '/dictionaries/en.aff', dic: '/dictionaries/en.dic' },
  },
});

<DocsEditor docx={file} language="es-MX" spellcheck={spellcheck} />`,
    'tsx',
    LIGHT_THEME,
  );
  const [basic, start, json, give, alone, update, change, own, fromCode, russian] = await Promise.all([
    highlight(`<DocsEditor locale="en" />   // 'es' when left out`, 'tsx', LIGHT_THEME),
    highlight(
      `npm run locale -- fr texts/fr.json              # every text in English, to translate
npm run locale -- fr texts/fr.json --from es    # or starting from the Spanish`,
      'bash',
      LIGHT_THEME,
    ),
    highlight(
      `{
  "locale.name": "Français",
  "menu.save": "Enregistrer",
  "status.page": "Page {page} sur {pages}"
}`,
      'json',
      LIGHT_THEME,
    ),
    highlight(
      `import fr from './texts/fr.json';

<DocsEditor locales={{ fr }} locale="fr" features={{ language: true }} />`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `import { addLocale, setLocale } from '@rebodocs/react';   // an interface of your own

addLocale('fr', fr);
setLocale('fr');`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `npm run locale -- fr texts/fr.json
# texts/fr.json: ${inFrench} texts, 6 new.
# To translate (same as English): 6.`,
      'bash',
      LIGHT_THEME,
    ),
    highlight(
      `<DocsEditor locale="en" locales={{ en: { 'menu.save': 'Save to cloud' } }} />

// …or from anywhere, before or after it is drawn
addLocale('en', { 'menu.save': 'Save to cloud' });`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `import { useSyncExternalStore } from 'react';
import { getLocale, onLocaleChange } from '@rebodocs/react';

const EN = { Guardar: 'Save', Imprimir: 'Print' } as const;

/** A component that calls this is drawn again when the language changes. */
export function useTexts() {
  const locale = useSyncExternalStore(onLocaleChange, getLocale);
  return (text: keyof typeof EN) => (locale === 'es' ? text : EN[text]);
}

function Save() {
  const tr = useTexts();
  return <button>{tr('Guardar')}</button>;
}`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `import { t, messages, locales } from '@rebodocs/react';

t('status.page', { page: 2, pages: 9 });   // "Page 2 of 9"
messages('en')['menu.save'];               // "Save"
locales();                                 // [{ code: 'es', name: 'Español' }, …]`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `{
  "status.words": "слов",
  "status.words.one": "слово",
  "status.words.few": "слова",
  "status.words.many": "слов"
}`,
      'json',
      LIGHT_THEME,
    ),
  ]);

  const step = (n: number, title: string, children: React.ReactNode) => (
    <li className="flex gap-4">
      <span className={`grid size-8 flex-none place-items-center rounded-full font-display text-sm font-bold ${PASTEL_CLASS.blue}`}>{n}</span>
      <div className="min-w-0 flex-1">
        <p className="m-0 mt-1 font-display text-lg font-bold tracking-[-0.01em]">{title}</p>
        {children}
      </div>
    </li>
  );

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">Languages</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        The interface comes in Spanish and English. Every text a person reads is looked up by a key, {rows.length} of them, so another language is a file of translations, added without touching the
        editor.
      </p>
      <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: basic }} />
      <p className={prose}>
        <code className={mono}>locale</code> takes a code or a browser tag (<code className={mono}>&apos;en-US&apos;</code>, <code className={mono}>&apos;es_MX&apos;</code>). A language the interface does
        not speak gives English.
      </p>
      <div className="mt-4">
        <HandTip>tip: switch the editor below to French</HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge="Live" color="green" title="Switch it">
          The editor in the two languages it comes with, and in a French started the way a translation starts: what shows in the status bar, the styles and the File menu, and nothing else yet.
        </SectionHead>
        <LazySwitcher />
        <p className={prose}>
          In French, open the menu (☰): <em>Fichier</em>, <em>Ouvrir un document…</em>, <em>Exporter</em>, and then <em>Print…</em> and <em>Page setup…</em>, in English, because the file does not say them. A partial translation works; what it leaves out
          reads in English. Changing the language builds the bars again; the document and its history stay as they were.
        </p>
      </section>

      <section aria-labelledby="adding-a-language" className="mt-24">
        <SectionHead id="adding-a-language" badge="Your language" color="blue" title="Adding a language">
          A file of translations, started by a command of the repository, and given to the editor.
        </SectionHead>
        <ol className="m-0 mt-8 flex max-w-[860px] list-none flex-col gap-8 p-0">
          {step(
            1,
            'Start the file',
            <>
              <p className={prose}>It is written with every text in English, to translate. What the language calls itself goes in already: “Français” for fr.</p>
              <div className={`mt-3 ${CODE}`} dangerouslySetInnerHTML={{ __html: start }} />
            </>,
          )}
          {step(
            2,
            'Translate it',
            <>
              <p className={prose}>
                It is plain JSON, a key and a text. Leave what is in braces as it is: {placeholders} texts have a <code className={mono}>{'{name}'}</code> the editor fills in.
              </p>
              <div className={`mt-3 ${CODE}`} dangerouslySetInnerHTML={{ __html: json }} />
            </>,
          )}
          {step(
            3,
            'Give it to the editor',
            <>
              <div className={`mt-3 ${CODE}`} dangerouslySetInnerHTML={{ __html: give }} />
              <div className={`mt-3 ${CODE}`} dangerouslySetInnerHTML={{ __html: alone }} />
              <p className={prose}>
                With <code className={mono}>features.language</code>, the language is in the menu by itself, under its own name: <code className={mono}>locale.name</code>, or what the browser calls the
                language if the file leaves it out.
              </p>
            </>,
          )}
        </ol>
        <h3 className="m-0 mt-12 font-display text-xl font-bold tracking-[-0.01em]">Languages with more plural forms</h3>
        <p className={prose}>
          Spanish and English say a number of things one way for one and another for the rest. Russian has four plural categories, Arabic six. {counted.length} texts are said of a number, and for each a language
          gives a form per plural category of its own, as <code className={mono}>&lt;key&gt;.&lt;category&gt;</code>; the editor picks it with <code className={mono}>Intl.PluralRules</code>. What a form
          leaves out is the key&apos;s text.
        </p>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: russian }} />
        <p className={prose}>
          In Russian, “one” is 1, 21, 31…; “few” is 2 to 4, 22 to 24…; “many” is 5 to 20, 25 to 30…: 21 words is <em>21 слово</em>, said like one.
        </p>
        <p className={prose}>
          <code className={mono}>npm run locale</code> puts the forms the language needs in its file, to translate with the rest: one, few and many for Russian, none for German. The texts said of a number
          are{' '}
          {counted.map((key, i) => (
            <span key={key}>
              {i > 0 && (i === counted.length - 1 ? ' and ' : ', ')}
              <code className="font-code text-[13.5px] text-ink">{key}</code>
            </span>
          ))}
          .
        </p>
      </section>

      <section aria-labelledby="keeping-it-up-to-date" className="mt-24">
        <SectionHead id="keeping-it-up-to-date" badge="New versions" color="purple" title="Keeping it up to date">
          When the interface gains texts, run the same command on the same file.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: update }} />
        <div className="mt-6 grid max-w-[860px] grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] gap-4">
          {UPDATE.map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-border p-5">
              <p className="m-0 font-display text-base font-bold tracking-[-0.01em]">{title}</p>
              <p className="m-0 mt-1.5 text-[15px] leading-[1.6] text-ink-soft">{text}</p>
            </div>
          ))}
        </div>
        <p className={prose}>A text that reads as in English counts as one to translate, unless it is too short to tell (an “OK”, a “%”). A text left out of a language is shown in English.</p>
      </section>

      <section aria-labelledby="changing-words-of-a-language-there-is" className="mt-24">
        <SectionHead id="changing-words-of-a-language-there-is" badge="Your words" color="orange" title="Changing words of a language there is">
          The same way, with the texts to change: the rest of the language stays as it is. Try it in the demo above.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: change }} />
        <p className={prose}>
          Given later, to the <code className={mono}>locales</code> prop or to <code className={mono}>addLocale</code>, they take effect at once: when they are of the language shown, the bars are built
          again with them.
        </p>
      </section>

      <section aria-labelledby="what-is-translated" className="mt-24">
        <SectionHead id="what-is-translated" badge="Scope" color="pink" title="What is translated" />
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4">
          {WHAT.map((item) => (
            <div key={item.title} className="rounded-2xl border border-border p-5">
              <p className="m-0 font-display text-base font-bold tracking-[-0.01em]">{item.title}</p>
              <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[item.color]}`}>{item.answer}</span>
              <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{item.text}</p>
            </div>
          ))}
        </div>
        <p className={prose}>
          <code className={mono}>useDocsStyles</code> gives the standard styles translated too, and again when the language changes.
        </p>
      </section>

      <section aria-labelledby="your-own-interface" className="mt-24">
        <SectionHead id="your-own-interface" badge="Headless" color="purple" title="Your own interface">
          An interface built on the{' '}
          <a href="/docs/headless/" className={LINK}>
            headless hooks
          </a>{' '}
          has labels of its own, which the library knows nothing of. To have them follow the same language, keep them in a table and read the language where they are drawn.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: own }} />
        <p className={prose}>
          Where the library has the word, <code className={mono}>t(&apos;menu.save&apos;)</code> gives it, with the same hook around it to be drawn again. A selector of your own is{' '}
          <code className={mono}>setLocale(&apos;en&apos;)</code>. The{' '}
          <a href="/docs/demos/#the-react-package" className={LINK}>
            React demo
          </a>{' '}
          does this for every label it has, in <code className={mono}>apps/demo/src/headless/texts.ts</code>.
        </p>
      </section>

      <section aria-labelledby="from-code" className="mt-24">
        <SectionHead id="from-code" badge="Reference" color="blue" title="From code">
          Every function of the languages, from <code className={mono}>@rebodocs/react</code> (or <code className={mono}>@rebodocs/editor</code>), with the types{' '}
          <code className={mono}>MessageKey</code> and <code className={mono}>Messages</code>.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: fromCode }} />
        <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
          {FUNCTIONS.map((fn) => (
            <div key={fn.name} id={`fn-${fn.name}`} className="scroll-mt-24 border-t border-[#f0eee9] py-3.5 first:border-t-0">
              <dt className="font-code text-[13.5px] text-ink">
                <span className="font-semibold">{fn.signature}</span> <span className="text-muted">→ {fn.returns}</span>
              </dt>
              <dd className="m-0 mt-1 text-[15px] leading-normal text-ink-soft">{fn.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="texts" className="mt-24">
        <SectionHead id="texts" badge="Every text" color="green" title="The texts there are">
          Each key with what it says in Spanish and English, read from the editor when this page was built. A <code className={mono}>{'{name}'}</code> is filled in by the editor.
        </SectionHead>
        <Texts rows={rows} />
      </section>

      <section aria-labelledby="spelling" className="mt-24">
        <SectionHead id="spelling" badge="The text" color="green" title="Spelling">
          A browser checks spelling only in text it edits, and the editor edits none of its own: it checks it itself. Words spelled wrong get a red wave, in the language the text is in,
          and their suggestions come in the bar beside the selection.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: spelling }} />
        <ul className="m-0 mt-5 grid max-w-[760px] list-none gap-3 p-0">
          {[
            <>
              <strong>The dictionaries are yours to give.</strong> Hunspell’s, as LibreOffice and Firefox use: an <code className={mono}>.aff</code> and a <code className={mono}>.dic</code> for each
              language, by address or by a function that gives their text. Those of <a href="https://github.com/wooorm/dictionaries" className={LINK}>wooorm/dictionaries</a> on npm are one source,
              each under its own licence: the Spanish one GPL, LGPL or MPL, the English one MIT and BSD. Rebodocs carries none.
            </>,
            <>
              <strong>Away from the page.</strong> nspell reads them in a worker the editor makes from a string, so no bundler has to find a file; a page with a Content Security Policy has to allow{' '}
              <code className={mono}>worker-src blob:</code>. The Spanish dictionary takes about half a second to be ready, once.
            </>,
            <>
              <strong>In the language of the text</strong>, the one of <code className={mono}>language</code>, of the file, or chosen at the foot of the editor: <code className={mono}>es</code> serves{' '}
              <code className={mono}>es-MX</code> too. Changing it checks the words again; a language with no dictionary is not checked.
            </>,
            <>
              <strong>What it checks:</strong> the words of the pages near the view, a quarter of a second after typing stops, and not the one being written until it is finished. Single letters,
              words in capitals, words joined to digits, variables, addresses, emails and text taken out in tracked changes are left alone.
            </>,
            <>
              <strong>The suggestions:</strong> the other button on a word with the wave, a tap on it, or a tap of ⌘ (Ctrl) with the caret in it. A suggestion replaces the word as any edit does,
              undone with ⌘Z and tracked when changes are. <em>Ignore</em> leaves the word alone in this document; <em>Add to dictionary</em> gives it to the dictionary, for as long as the page is
              open.
            </>,
            <>
              <strong>A checker of your own</strong>, on your server for instance, is an object with <code className={mono}>check(words, language)</code> and{' '}
              <code className={mono}>suggest(word, language)</code>, each answering at once or with a promise, and <code className={mono}>add</code> if it takes new words. Grammar is not checked.
            </>,
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[15px] leading-[1.6] text-ink-soft">
              <span aria-hidden="true" className="mt-2.5 size-1.5 flex-none rounded-full bg-[#c9c6bf]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="know" className="mt-24">
        <SectionHead id="know" badge="Limits" color="yellow" title="What to know" />
        <ul className="m-0 mt-5 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-x-8 gap-y-3 p-0">
          {[
            'Until locale says otherwise, the interface is in the first of the browser’s languages it speaks, or in English. It was written in Spanish first; the English texts were translated, and are waiting for a native review.',
            'The language is one for the whole page: two editors on a page are in the same one, and choosing it in the menu of either builds both again. The document and its history stay.',
            'A tag goes to the language it is of: en-US to English, fr-CA to French once French is added. A language not added gives English.',
            'A {name} with no value given stays as it is written, braces and all.',
            'There is no removing a language once added; addLocale again changes its texts.',
            'Languages written right to left, such as Arabic and Hebrew, are not supported: the interface and the text of a document are laid out left to right.',
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
