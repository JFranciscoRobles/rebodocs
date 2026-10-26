'use client';

// A real editor coloured by nothing but the CSS variables, set on the element
// it is in: the themes of the reference, and the CSS that gives each.

import { exportDocx } from '@rebodocs/core';
import { DocsEditor } from '@rebodocs/react';
import { type CSSProperties, useEffect, useState } from 'react';
import { useEditorLocale } from '@/components/editorLocale';
import { useT } from '@/components/i18n';
import { PASTEL_CLASS } from '@/lib/home';
import { CAPTION } from '../styles';
import { lease } from '../accessibility/sample';
import { THEMES } from '../reference';

export default function ThemeDemo() {
  const [file, setFile] = useState<Uint8Array>();
  const [theme, setTheme] = useState(1);
  const t = useT();
  const editorLocale = useEditorLocale();

  useEffect(() => {
    void lease().then((doc) => setFile(exportDocx(doc)));
  }, []);

  const { vars, scheme } = THEMES[theme];
  const css = `.my-editor {\n${scheme ? `  color-scheme: ${scheme};\n` : ''}${Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n')}\n}`;
  const pill = (on: boolean) =>
    `cursor-pointer rounded-full border px-3 py-1 text-[13px] font-semibold ${on ? `border-transparent ${PASTEL_CLASS.green}` : 'border-border bg-white text-ink-soft hover:bg-hover'}`;

  return (
    <div className="mt-7 overflow-hidden rounded-[18px] border border-border">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border bg-surface px-6 py-4">
        <p className={CAPTION}>{t({ en: 'Theme', es: 'Tema', zh: '主题' })}</p>
        <div className="flex flex-wrap gap-1.5">
          {THEMES.map((one, i) => (
            <button key={one.label.en} type="button" aria-pressed={theme === i} className={pill(theme === i)} onClick={() => setTheme(i)}>
              {t(one.label)}
            </button>
          ))}
        </div>
        <p className="m-0 text-[13.5px] text-ink-soft">
          {t({
            en: 'Open a menu, the side panel or the one at the left: the whole interface takes the theme. The page stays white, as paper does.',
            es: 'Abre un menú, el panel lateral o el de la izquierda: toda la interfaz toma el tema. La página sigue blanca, como el papel.',
            zh: '打开某个菜单、侧边栏或左侧的菜单：整个界面都会应用该主题。页面像纸一样保持白色。',
          })}
        </p>
      </div>
      <div className="h-[560px]" style={{ ...vars, colorScheme: scheme ?? 'light' } as CSSProperties}>
        {file ? (
          <DocsEditor docx={file} name="lease.docx" locale={editorLocale} author="Ana" />
        ) : (
          <p className="m-0 grid h-full place-items-center text-sm text-muted">{t({ en: 'Opening the editor…', es: 'Abriendo el editor…', zh: '正在打开编辑器…' })}</p>
        )}
      </div>
      <div className="border-t border-border bg-surface px-6 py-5">
        <p className={CAPTION}>{t({ en: 'The CSS', es: 'El CSS', zh: 'CSS' })}</p>
        <pre
          tabIndex={0}
          aria-label={t({ en: 'The CSS of the theme', es: 'El CSS del tema', zh: '主题的 CSS' })}
          className="m-0 mt-2.5 overflow-x-auto rounded-xl bg-[#2f2e2b] px-4 py-3.5 font-code text-[12.5px] leading-[1.65] text-[#edece8] sm:columns-2"
        >
          {css}
        </pre>
      </div>
    </div>
  );
}
