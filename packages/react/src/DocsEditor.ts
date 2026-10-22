// The editor as a component of React: it draws an element, mounts the whole
// editor in it once the page is in the browser, and takes it away with the
// component. On the server it draws the empty element and nothing else.

import { type CSSProperties, type ForwardedRef, createElement, forwardRef, useEffect, useRef } from 'react';
import { type Doc, exportDocx } from '@rebodocs/core';
import { addFonts, addLocale } from '@rebodocs/editor';
import { fontsKey } from './docs';
import { type DocsHandle, type DocsOptions, mountDocs } from './mount';

export interface DocsEditorProps extends DocsOptions {
  className?: string;
  /** The element takes the height of what it is in: something must give it one. */
  style?: CSSProperties;
  /** Called with the editor once it is there, and with nothing when it is gone. */
  onReady?: (handle: DocsHandle | undefined) => void;
}

/**
 * The editor is mounted after React has handed out the refs of a render, and
 * mounted again when the document changes: the ref is given each one then.
 */
function give(ref: ForwardedRef<DocsHandle | undefined>, handle: DocsHandle | undefined) {
  if (typeof ref === 'function') ref(handle);
  else if (ref) ref.current = handle;
}

/**
 * A document changes for another when what it is changes: the file given,
 * the room, or what lets the person in. What is switched on is read when it
 * is mounted; the name, the author, the language and its texts, and the fonts follow their props.
 */
export const DocsEditor = forwardRef<DocsHandle | undefined, DocsEditorProps>(function DocsEditor(props, ref) {
  const element = useRef<HTMLDivElement>(null);
  const handle = useRef<DocsHandle | undefined>(undefined);
  // The functions given are the ones of the last render, without mounting the editor again for them.
  const latest = useRef(props);
  latest.current = props;
  const latestRef = useRef(ref);
  latestRef.current = ref;
  const { docx, collab, name, author, locale, letterhead } = props;
  const featureKey = JSON.stringify(props.features ?? {}, (_key, value: unknown) => (typeof value === 'function' ? 'f' : value));
  const saves = !!props.onSave;
  const versioned = props.versions ? (props.versions.save ? 2 : 1) : 0;
  // What the person did to the document, when the editor goes for another reason than another document.
  const carried = useRef<{ from: DocsEditorProps['docx']; doc: Doc; language: string; name: string; unsaved: boolean } | undefined>(undefined);

  useEffect(() => {
    const { className: _c, style: _s, onReady: _r, ...options } = latest.current;
    const carry = carried.current?.from === options.docx && !options.collab ? carried.current : undefined;
    carried.current = undefined;
    const mounted = mountDocs(element.current!, {
      ...options,
      ...(carry && {
        docx: exportDocx(carry.doc, { language: carry.language, replaceLanguage: true }),
        name: carry.name,
        unsaved: carry.unsaved || options.unsaved,
      }),
      onSave: options.onSave && ((file, called) => latest.current.onSave?.(file, called)),
      versions: options.versions && {
        list: () => latest.current.versions!.list(),
        load: (id) => latest.current.versions!.load(id),
        save: options.versions.save && ((file, info) => latest.current.versions!.save!(file, info)),
      },
      onChange: (editor) => latest.current.onChange?.(editor),
      onCollab: (state, peers) => latest.current.onCollab?.(state, peers),
      onError: (message) => (latest.current.onError ?? ((text: string) => alert(text)))(message),
    });
    handle.current = mounted;
    give(latestRef.current, mounted);
    latest.current.onReady?.(mounted);
    const from = options.docx;
    const opened = mounted.editor.doc;
    return () => {
      if (!options.collab && (carry || mounted.dirty || mounted.editor.doc !== opened)) carried.current = { from, doc: mounted.editor.doc, language: mounted.editor.textLanguage, name: mounted.name, unsaved: mounted.dirty };
      handle.current = undefined;
      give(latestRef.current, undefined);
      latest.current.onReady?.(undefined);
      mounted.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docx, collab?.url, collab?.room, collab?.ticket, featureKey, saves, versioned]);

  useEffect(() => {
    if (name !== undefined) handle.current?.setName(name);
  }, [name]);
  useEffect(() => {
    if (author !== undefined) handle.current?.setAuthor(author);
  }, [author]);
  useEffect(() => {
    if (locale !== undefined) handle.current?.setLocale(locale);
  }, [locale]);
  // Texts given later are added as the first were: the interface is built again when they are of the language shown.
  const localesKey = JSON.stringify(props.locales ?? {});
  const givenLocales = useRef(localesKey);
  useEffect(() => {
    if (givenLocales.current === localesKey) return;
    givenLocales.current = localesKey;
    for (const [code, texts] of Object.entries(latest.current.locales ?? {})) addLocale(code, texts);
  }, [localesKey]);

  // Fonts given later are added as the first were; the same ones in a new array are not read again.
  const givenFonts = fontsKey(props.fonts);
  const firstFonts = useRef(givenFonts);
  useEffect(() => {
    if (firstFonts.current === givenFonts) return;
    firstFonts.current = givenFonts;
    if (latest.current.fonts?.length) void addFonts(latest.current.fonts);
  }, [givenFonts]);
  const { embedFonts, language, spellcheck, theme } = props;
  useEffect(() => {
    if (handle.current) handle.current.editor.language = language;
  }, [language]);
  useEffect(() => {
    if (handle.current) handle.current.editor.spellChecker = spellcheck;
  }, [spellcheck]);
  useEffect(() => {
    if (handle.current) handle.current.setTheme(theme ?? 'light');
  }, [theme]);
  useEffect(() => {
    if (handle.current) handle.current.editor.embedFonts = embedFonts ?? true;
  }, [embedFonts]);

  // The one it was mounted with is already on its way; another one given later takes its place.
  const given = useRef<{ handle: DocsHandle | undefined; letterhead: typeof letterhead }>({ handle: undefined, letterhead });
  useEffect(() => {
    const was = given.current;
    given.current = { handle: handle.current, letterhead };
    if (handle.current && was.handle === handle.current && was.letterhead !== letterhead && letterhead !== undefined) void handle.current.setLetterhead(letterhead);
  });

  // A ref given later, or another in its place, is given the editor that is there.
  useEffect(() => {
    give(ref, handle.current);
    return () => give(ref, undefined);
  }, [ref]);

  return createElement('div', { ref: element, className: props.className, style: { height: '100%', minHeight: 0, ...props.style } });
});
