'use client';

// The fourth tab of the demo: the document only to read, as `@rebodocs/viewer`
// gives it, with its bar and nothing to edit.
import zhHans from '@rebodocs/editor/locales/zh-Hans';
import { addLocale, getLocale, setLocale } from '@rebodocs/viewer';
import { DocsViewer } from '@rebodocs/viewer/react';

// The viewer is a package of its own, with the editor's words in it: Chinese is
// given to it here, keeping the language there was, as the site chooses it by the page.
const was = getLocale();
addLocale('zh-Hans', zhHans);
setLocale(was);

export function DemoViewer({ docx, locale }: { docx: Uint8Array; locale: string }) {
  return <DocsViewer docx={docx} locale={locale} className="bg-surface" />;
}
