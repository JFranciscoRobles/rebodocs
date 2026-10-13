// The editor as a component of React: it draws an element, mounts the whole
// editor in it once the page is in the browser, and takes it away with the
// component. On the server it draws the empty element and nothing else.

import { type CSSProperties, createElement, forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { type DocsHandle, type DocsOptions, mountDocs } from './mount';

export interface DocsEditorProps extends DocsOptions {
  className?: string;
  /** The element takes the height of what it is in: something must give it one. */
  style?: CSSProperties;
  /** Called with the editor once it is there, and with nothing when it is gone. */
  onReady?: (handle: DocsHandle | undefined) => void;
}

/**
 * A document changes for another when what it is changes: the file given,
 * the room, or what lets the person in. What is switched on is read when it
 * is mounted; the name, the author and the language follow their props.
 */
export const DocsEditor = forwardRef<DocsHandle | undefined, DocsEditorProps>(function DocsEditor(props, ref) {
  const element = useRef<HTMLDivElement>(null);
  const handle = useRef<DocsHandle | undefined>(undefined);
  // The functions given are the ones of the last render, without mounting the editor again for them.
  const latest = useRef(props);
  latest.current = props;
  const { docx, collab, name, author, locale, letterhead } = props;
  const featureKey = JSON.stringify(props.features ?? {}, (_key, value: unknown) => (typeof value === 'function' ? 'f' : value));
  const saves = !!props.onSave;

  useEffect(() => {
    const { className: _c, style: _s, onReady: _r, ...options } = latest.current;
    const mounted = mountDocs(element.current!, {
      ...options,
      onSave: options.onSave && ((file, called) => latest.current.onSave?.(file, called)),
      onChange: (editor) => latest.current.onChange?.(editor),
      onCollab: (state, peers) => latest.current.onCollab?.(state, peers),
      onError: (message) => (latest.current.onError ?? ((text: string) => alert(text)))(message),
    });
    handle.current = mounted;
    latest.current.onReady?.(mounted);
    return () => {
      handle.current = undefined;
      latest.current.onReady?.(undefined);
      mounted.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docx, collab?.url, collab?.room, collab?.ticket, featureKey, saves]);

  useEffect(() => {
    if (name !== undefined) handle.current?.setName(name);
  }, [name]);
  useEffect(() => {
    if (author !== undefined) handle.current?.setAuthor(author);
  }, [author]);
  useEffect(() => {
    if (locale !== undefined) handle.current?.setLocale(locale);
  }, [locale]);

  // The one it was mounted with is already on its way; another one given later takes its place.
  const given = useRef<{ handle: DocsHandle | undefined; letterhead: typeof letterhead }>({ handle: undefined, letterhead });
  useEffect(() => {
    const was = given.current;
    given.current = { handle: handle.current, letterhead };
    if (handle.current && was.handle === handle.current && was.letterhead !== letterhead && letterhead !== undefined) void handle.current.setLetterhead(letterhead);
  });

  useImperativeHandle(ref, () => handle.current, []);

  return createElement('div', { ref: element, className: props.className, style: { height: '100%', minHeight: 0, ...props.style } });
});
