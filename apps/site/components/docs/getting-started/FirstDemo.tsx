'use client';

// The component of the first example, as it is written there: an empty
// document, or the agreement of the demo given as docx. What onSave is given
// is printed below it, as console.log would.

import { DocsEditor, getLocale, setLocale } from '@rebodocs/react';
import { useEffect, useState } from 'react';
import { useEditorLocale } from '@/components/editorLocale';
import { useT } from '@/components/i18n';
import { PASTEL_CLASS } from '@/lib/home';
import { CAPTION } from '../styles';

export default function FirstDemo() {
  const [file, setFile] = useState<Uint8Array>();
  const [given, setGiven] = useState(false);
  const [logged, setLogged] = useState<string[]>([]);
  const t = useT();
  const editorLocale = useEditorLocale();

  useEffect(() => {
    const was = getLocale();
    void fetch('/sample.docx')
      .then((response) => response.arrayBuffer())
      .then((bytes) => setFile(new Uint8Array(bytes)));
    return () => setLocale(was);
  }, []);

  const pill = (active: boolean) =>
    `cursor-pointer rounded-full border px-3 py-1 text-[13px] font-semibold disabled:cursor-default disabled:opacity-50 ${active ? `border-transparent ${PASTEL_CLASS.blue}` : 'border-border bg-white text-ink-soft hover:bg-hover'}`;
  const name = given ? 'agreement.docx' : 'untitled.docx';

  return (
    <div className="mt-7 overflow-hidden rounded-[18px] border border-border">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-border bg-surface px-6 py-4">
        <p className={CAPTION} id="gs-docx">
          docx
        </p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="gs-docx">
          <button type="button" aria-pressed={!given} className={pill(!given)} onClick={() => setGiven(false)}>
            {t({ en: 'Left out: an empty document', es: 'Sin pasarlo: un documento vacío', zh: '不传入：空白文档' })}
          </button>
          <button type="button" aria-pressed={given} disabled={!file} className={pill(given)} onClick={() => setGiven(true)}>
            {t({ en: 'The bytes of a file', es: 'Los bytes de un archivo', zh: '文件的字节' })}
          </button>
        </div>
      </div>
      <div className="h-[520px] bg-white">
        <DocsEditor docx={given ? file : undefined} name={name} locale={editorLocale} onSave={(docx, saved) => setLogged((was) => [...was.slice(-3), `${saved} ${docx.byteLength}`])} />
      </div>
      <div className="border-t border-border bg-surface px-6 py-5">
        <p className={CAPTION}>{t({ en: 'Console', es: 'Consola', zh: '控制台' })}</p>
        <pre
          tabIndex={0}
          aria-label={t({ en: 'Console', es: 'Consola', zh: '控制台' })}
          aria-live="polite"
          className="m-0 mt-2.5 min-h-[3.4em] overflow-x-auto rounded-xl bg-[#2f2e2b] px-4 py-3.5 font-code text-[12.5px] leading-[1.65] text-[#edece8]"
        >
          {logged.length ? (
            logged.join('\n')
          ) : (
            <span className="text-[#a8a49a]">
              {t({
                en: 'Save from the menu, or with ⌘S (Ctrl+S): onSave logs the name and the size.',
                es: 'Guarda desde el menú, o con ⌘S (Ctrl+S): onSave muestra el nombre y el tamaño.',
                zh: '从菜单保存，或按 ⌘S（Ctrl+S）：onSave 会打印文件名和大小。',
              })}
            </span>
          )}
        </pre>
      </div>
    </div>
  );
}
