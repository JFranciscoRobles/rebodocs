// A document to read, as a component of React: an element, and the viewer
// mounted in it once the page is in the browser, again for
// another file, and taken away with the component. On the server it draws
// the empty element and nothing else.

import { type CSSProperties, type ReactNode, createElement, useEffect, useRef } from 'react';
import { setLocale } from '@rebodocs/editor';
import { type Viewer, type ViewerLayout, type ViewerSource, createViewer } from './viewer';

export interface DocsViewerProps {
  /** The file: the bytes of a .docx, or a Doc already read. */
  docx: ViewerSource;
  /** How the pages are set out: one under another, each whole on the screen ('pages', as it comes), or all at once ('all'). */
  layout?: ViewerLayout;
  /** False to leave out the bar floating over the pages. */
  bar?: boolean;
  /** The language of its words: 'en', 'es'… As the rest of Rebodocs in the page, unless given. */
  locale?: string;
  className?: string;
  /** The element takes the height of what it is in: something must give it one. */
  style?: CSSProperties;
  /** Called with the viewer once it is there, to print or to set the pages out, and with nothing when it is gone. */
  onReady?: (viewer: Viewer | undefined) => void;
}

export function DocsViewer({ docx, layout, bar, locale, className, style, onReady }: DocsViewerProps): ReactNode {
  const element = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | undefined>(undefined);
  const ready = useRef(onReady);
  ready.current = onReady;

  // biome-ignore lint/correctness/useExhaustiveDependencies: mounted again for another file or another bar; the layout follows below
  useEffect(() => {
    if (!element.current) return;
    if (locale) setLocale(locale);
    const mounted = createViewer(element.current, docx, { layout, bar });
    viewer.current = mounted;
    ready.current?.(mounted);
    return () => {
      ready.current?.(undefined);
      viewer.current = undefined;
      mounted.destroy();
    };
  }, [docx, bar]);

  useEffect(() => {
    if (layout && viewer.current && viewer.current.layout !== layout) viewer.current.setLayout(layout);
  }, [layout]);
  useEffect(() => {
    if (locale) setLocale(locale);
  }, [locale]);

  return createElement('div', { ref: element, className, style: { height: '100%', overflow: 'auto', ...style } });
}
