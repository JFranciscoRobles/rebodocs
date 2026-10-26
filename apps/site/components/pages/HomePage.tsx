import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CodeTabs } from '@/components/CodeTabs';
import { LiveDemo } from '@/components/LiveDemo';
import { AGAINST_WORD, TESTS, linesLikeWord } from '@/components/docs/status/data';
import { FeatureGrid } from '@/components/home/FeatureGrid';
import { HeroEditor } from '@/components/home/HeroEditor';
import { InstallPicker } from '@/components/home/InstallPicker';
import { Metrics } from '@/components/home/Metrics';
import { primary } from '@/components/home/buttons';
import { SiteFooter, SiteHeader } from '@/components/home/SiteChrome';
import { LocalLink as Link } from '@/components/i18n';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PACKAGES, PASTEL_CLASS, type Pastel, TAGS, VERSION, npmOf, pastelAt } from '@/lib/home';
import { type L, LANGUAGES, type Locale, formatNumber, localize, translator } from '@/lib/i18n';
import { setPageLocale } from '@/lib/locale';
import { pageMetadata } from '@/lib/seo';
import { NPM_ORG, REPO, SITE } from '@/lib/site';

/** The examples beside "For developers": a name for the tab, the language of the code, and the code, its comments in the language of the page. */
const SAMPLES: [L, string, L][] = [
  [
    { en: 'React', es: 'React', zh: 'React' },
    'tsx',
    {
      en: `'use client';
import { DocsEditor } from '@rebodocs/react';

export default function Contract({ file }: { file: Uint8Array }) {
  return (
    <DocsEditor
      docx={file}
      name="contract.docx"
      locale="en"
      onSave={(docx) => upload(docx)}
    />
  );
}`,
      es: `'use client';
import { DocsEditor } from '@rebodocs/react';

export default function Contrato({ file }: { file: Uint8Array }) {
  return (
    <DocsEditor
      docx={file}
      name="contrato.docx"
      locale="es"
      onSave={(docx) => subir(docx)}
    />
  );
}`,
      zh: `'use client';
import { DocsEditor } from '@rebodocs/react';
import zhHans from '@rebodocs/editor/locales/zh-Hans';
import { addLocale } from '@rebodocs/react';

addLocale('zh-Hans', zhHans); // 中文界面

export default function Contract({ file }: { file: Uint8Array }) {
  return (
    <DocsEditor
      docx={file}
      name="合同.docx"
      locale="zh-Hans"
      onSave={(docx) => upload(docx)}
    />
  );
}`,
    },
  ],
  [
    { en: 'Your UI', es: 'Tu interfaz', zh: '你的界面' },
    'tsx',
    {
      en: `import { DocsProvider, DocsSurface, useDocs } from '@rebodocs/react';

function Bold() {
  const { state, commands } = useDocs();
  return (
    <button
      className={state.bold ? 'bg-blue-100' : ''}
      onClick={() => commands.toggleMark('bold')}
    >
      B
    </button>
  );
}

<DocsProvider docx={file}>
  <Bold />
  <DocsSurface className="h-full" />
</DocsProvider>`,
      es: `import { DocsProvider, DocsSurface, useDocs } from '@rebodocs/react';

function Negrita() {
  const { state, commands } = useDocs();
  return (
    <button
      className={state.bold ? 'bg-blue-100' : ''}
      onClick={() => commands.toggleMark('bold')}
    >
      N
    </button>
  );
}

<DocsProvider docx={file}>
  <Negrita />
  <DocsSurface className="h-full" />
</DocsProvider>`,
      zh: `import { DocsProvider, DocsSurface, useDocs } from '@rebodocs/react';

function Bold() {
  const { state, commands } = useDocs();
  return (
    <button
      className={state.bold ? 'bg-blue-100' : ''}
      onClick={() => commands.toggleMark('bold')}
    >
      加粗
    </button>
  );
}

<DocsProvider docx={file}>
  <Bold />
  <DocsSurface className="h-full" />
</DocsProvider>`,
    },
  ],
  [
    { en: 'Server', es: 'Servidor', zh: '服务器' },
    'ts',
    {
      en: `import { importDocx, fillVariables, exportDocx } from '@rebodocs/core';

const doc = fillVariables(importDocx(template), {
  client: 'Ana Pérez',
  amount: '2500',
});

await storage.put('receipt.docx', exportDocx(doc));`,
      es: `import { importDocx, fillVariables, exportDocx } from '@rebodocs/core';

const doc = fillVariables(importDocx(plantilla), {
  cliente: 'Ana Pérez',
  importe: '2500',
});

await storage.put('recibo.docx', exportDocx(doc));`,
      zh: `import { importDocx, fillVariables, exportDocx } from '@rebodocs/core';

const doc = fillVariables(importDocx(template), {
  客户: '王芳',
  金额: '2500',
});

await storage.put('收据.docx', exportDocx(doc));`,
    },
  ],
  [
    { en: 'Versions', es: 'Versiones', zh: '版本' },
    'tsx',
    {
      en: `// Where versions are kept is yours: the editor lists,
// compares and restores them from its side panel.
<DocsEditor
  docx={file}
  versions={{
    list: () => api.versions(documentId),
    load: (id) => api.version(documentId, id),
    save: (docx, info) => api.keepVersion(documentId, docx, info),
  }}
/>`,
      es: `// Dónde se guardan las versiones lo decides tú: el editor
// las lista, las compara y las restaura desde su panel lateral.
<DocsEditor
  docx={file}
  versions={{
    list: () => api.versions(documentId),
    load: (id) => api.version(documentId, id),
    save: (docx, info) => api.keepVersion(documentId, docx, info),
  }}
/>`,
      zh: `// 版本存放在哪里由你决定：编辑器会在侧边栏中
// 列出、对比和还原它们。
<DocsEditor
  docx={file}
  versions={{
    list: () => api.versions(documentId),
    load: (id) => api.version(documentId, id),
    save: (docx, info) => api.keepVersion(documentId, docx, info),
  }}
/>`,
    },
  ],
  [
    { en: 'Together', es: 'En equipo', zh: '协作' },
    'tsx',
    {
      en: `// Your backend decides who gets in, and keeps the file.
<DocsEditor
  collab={{
    url: 'https://collab.example.com',
    room: documentId,
    ticket,
  }}
/>`,
      es: `// Tu backend decide quién entra, y guarda el archivo.
<DocsEditor
  collab={{
    url: 'https://collab.example.com',
    room: documentId,
    ticket,
  }}
/>`,
      zh: `// 由你的后端决定谁能进入，并负责保存文件。
<DocsEditor
  collab={{
    url: 'https://collab.example.com',
    room: documentId,
    ticket,
  }}
/>`,
    },
  ],
];

const TITLE: L = {
  en: 'Rebodocs: the document editor you build into your app',
  es: 'Rebodocs: el editor de documentos que integras en tu aplicación',
  zh: 'Rebodocs：嵌入你的应用的文档编辑器',
};
const DESCRIPTION: L = {
  en: 'A word processor for the browser, compatible with Word files. Open, edit and save .docx with tracked changes, versions, collaboration, templates and PDF — in packages you take one at a time.',
  es: 'Un procesador de textos para el navegador, compatible con archivos de Word. Abre, edita y guarda .docx con control de cambios, versiones, colaboración, plantillas y PDF, en paquetes que tomas de uno en uno.',
  zh: '浏览器中的文字处理器，兼容 Word 文件。打开、编辑和保存 .docx，支持修订、版本、协作、模板和 PDF，按需逐个选用软件包。',
};

export function homeMetadata(locale: Locale): Metadata {
  const t = translator(locale);
  return pageMetadata({ locale, path: '/', title: t(TITLE), description: t(DESCRIPTION), absoluteTitle: true });
}

/** What the page is, for search engines: the project as a piece of software, free, in the language of the page. */
function StructuredData({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Rebodocs',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web, Node.js',
    description: t(DESCRIPTION),
    url: `${SITE}${localize('/', locale)}`,
    inLanguage: LANGUAGES[locale].tag,
    softwareVersion: VERSION,
    license: 'https://opensource.org/licenses/MIT',
    codeRepository: REPO,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON written here, with no "<" in it to close the script.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

const secondary = 'rounded-xl border border-border-strong bg-white font-semibold text-ink transition-colors hover:bg-hover';

const Pill = ({ color, children }: { color: Pastel; children: ReactNode }) => <span className={`rounded-full px-3 py-[5px] text-[13px] font-semibold ${PASTEL_CLASS[color]}`}>{children}</span>;
const Title = ({ children, small }: { children: ReactNode; small?: boolean }) => (
  <h2 className={`mt-4.5 font-display font-extrabold leading-[1.08] tracking-[-0.03em] ${small ? 'text-[clamp(34px,4.2vw,52px)]' : 'text-[clamp(36px,4.6vw,56px)]'}`}>{children}</h2>
);

const doodle = 'absolute hidden md:block';
/** A stroke drawn by hand, that draws itself in after `delay`. */
const drawn = (delay: string) => ({ className: 'draw animate-draw', style: { animationDelay: delay } });

/** The words the hand-drawn stroke underlines, and what comes before and after them. */
const HEADLINE: L<[string, string, string]> = {
  en: ['The document editor you ', 'build into', ' your app.'],
  es: ['El editor de documentos que ', 'integras', ' en tu aplicación.'],
  zh: ['可以', '嵌入', '你的应用的文档编辑器。'],
};

function Hero({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const [before, underlined, after] = t(HEADLINE);
  return (
    <section id="top" className="relative mx-auto max-w-[1180px] px-6 pb-10 pt-18 text-center">
      <svg width="70" height="70" viewBox="0 0 70 70" aria-hidden="true" className={`${doodle} left-[6%] top-[90px] animate-float`}>
        <path {...drawn('1.2s')} d="M35 8l6 18 18 6-18 6-6 18-6-18-18-6 18-6z" fill="none" stroke="#E0A526" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
      <svg width="90" height="60" viewBox="0 0 90 60" aria-hidden="true" className={`${doodle} right-[7%] top-[120px] animate-float-slow`}>
        <path {...drawn('1.8s')} d="M6 40c12-28 24 18 36-6s22-20 42-6" fill="none" stroke="#E86A8C" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      {/* Dotted, so it comes in instead of being drawn. */}
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" className={`${doodle} right-[13%] top-[330px] animate-float`}>
        <circle className="animate-pop-in opacity-0" style={{ animationDelay: '0.6s' }} cx="28" cy="28" r="20" fill="none" stroke="#6BAF7B" strokeWidth="2.5" strokeDasharray="4 7" />
      </svg>

      <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface py-1.5 pl-2 pr-3.5 text-sm text-muted">
        <span className="rounded-full border border-border bg-white px-2 py-0.5 text-xs font-semibold text-ink">{t({ en: 'New', es: 'Nuevo', zh: '新' })}</span>
        {t({ en: 'Chinese text, and an interface in Chinese', es: 'Texto en chino, y una interfaz en chino', zh: '支持中文排版和中文界面' })}
      </p>
      <h1 className="mx-auto mt-7 max-w-[900px] text-balance font-display text-[clamp(44px,6.6vw,84px)] font-extrabold leading-[1.04] tracking-[-0.03em]">
        {before}
        <span className="relative whitespace-nowrap text-brand">
          {underlined}
          <svg viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true" className="absolute -bottom-2.5 left-0 h-[18px] w-full">
            <path {...drawn('0s')} d="M4 14C70 4 160 4 296 10" fill="none" stroke="#F5C443" strokeWidth="7" strokeLinecap="round" />
          </svg>
        </span>
        {after}
      </h1>
      <p className="mx-auto mt-7 max-w-[640px] text-[19px] leading-[1.6] text-muted">{t(DESCRIPTION)}</p>
      <p className="mt-8 flex flex-wrap justify-center gap-2.5 text-base">
        <Link href="/docs/getting-started/" className={`rounded-xl px-5.5 py-3.5 ${primary}`}>
          {t({ en: 'Get started', es: 'Empezar', zh: '开始使用' })}
        </Link>
        <a href="#demo" className={`px-5.5 py-3.5 ${secondary}`}>
          {t({ en: 'Try it below', es: 'Pruébalo abajo', zh: '在下方试用' })}
        </a>
      </p>
      <InstallPicker />
      <HeroEditor />
    </section>
  );
}

export async function HomePage({ locale }: { locale: Locale }) {
  setPageLocale(locale);
  const t = translator(locale);
  const samples = await Promise.all(SAMPLES.map(async ([name, lang, code]) => ({ name: t(name), html: await highlight(t(code), lang, LIGHT_THEME) })));
  const tests = formatNumber(
    TESTS.reduce((sum, row) => sum + row.count, 0),
    locale,
  );
  return (
    <div className="home overflow-x-clip text-ink">
      <StructuredData locale={locale} />
      <SiteHeader />
      <main>
        <Hero locale={locale} />

        <ul className="reveal mx-auto flex max-w-[1180px] flex-wrap justify-center gap-2.5 px-6 pb-6 pt-14" aria-label={t({ en: 'What it does', es: 'Qué hace', zh: '功能概览' })}>
          {TAGS.map((tag, i) => (
            <li key={tag.en} className={`rounded-full px-3.5 py-[7px] text-sm font-medium transition duration-250 hover:-translate-y-1 hover:shadow-lift ${PASTEL_CLASS[pastelAt(i)]}`}>
              {t(tag)}
            </li>
          ))}
        </ul>

        <Metrics />

        <section id="demo" className="mx-auto max-w-[1180px] px-6 pb-15 pt-25">
          <div className="reveal mx-auto max-w-[720px] text-center">
            <Pill color="blue">{t({ en: 'Live demo', es: 'Demo en vivo', zh: '在线演示' })}</Pill>
            <Title>{t({ en: 'This is the editor. Type in it.', es: 'Este es el editor. Escribe en él.', zh: '这就是编辑器，直接输入试试。' })}</Title>
            <p className="mt-4.5 text-lg leading-[1.6] text-muted">
              {t({
                en: 'Open your own .docx from the menu, type “/” for commands and “{{” for variables, fill the template from the side panel, track changes or restrict editing from Review, save a version and compare it, export to PDF. Nothing leaves the browser.',
                es: 'Abre tu propio .docx desde el menú, escribe “/” para los comandos y “{{” para las variables, llena la plantilla desde el panel lateral, registra cambios o restringe la edición desde Revisar, guarda una versión y compárala, exporta a PDF. Nada sale del navegador.',
                zh: '从菜单打开你自己的 .docx，输入 “/” 调出命令、输入 “{{” 插入变量，在侧边栏填写模板，在“审阅”中开启修订或限制编辑，保存版本并对比，导出 PDF。所有内容都不会离开浏览器。',
              })}
            </p>
          </div>
          <div className="reveal mt-11 rounded-3xl border border-border bg-surface p-3.5">
            <LiveDemo />
          </div>
          <p className="mt-4.5 text-center text-[15px] text-muted">
            {t({ en: 'Same document, your own UI →', es: 'El mismo documento, tu propia interfaz →', zh: '同一份文档，你自己的界面 →' })}{' '}
            <Link href="/demo/" className="font-medium text-brand hover:text-brand-hover">
              {t({ en: 'see it built with headless hooks', es: 'mírala hecha con hooks headless', zh: '看看用 headless hooks 构建的版本' })}
            </Link>
          </p>
        </section>

        <section className="mx-auto max-w-[1180px] px-6 py-20">
          <div className="reveal mx-auto mb-12 max-w-[720px] text-center">
            <Pill color="green">{t({ en: 'Features', es: 'Funciones', zh: '功能' })}</Pill>
            <Title>{t({ en: 'An editor you can trust with real documents.', es: 'Un editor al que puedes confiarle documentos reales.', zh: '一个可以放心交给真实文档的编辑器。' })}</Title>
          </div>
          <FeatureGrid />
        </section>

        <section id="docs" className="mx-auto max-w-[1180px] px-6 py-20">
          <div className="flex flex-wrap items-center gap-12 rounded-[28px] bg-surface p-[clamp(28px,5vw,64px)]">
            <div className="reveal min-w-0 flex-[1_1_360px]">
              <Pill color="purple">{t({ en: 'For developers', es: 'Para desarrolladores', zh: '面向开发者' })}</Pill>
              <Title small>{t({ en: 'It feels like part of your app — because it is.', es: 'Se siente parte de tu aplicación, porque lo es.', zh: '它就像你应用的一部分，因为它本来就是。' })}</Title>
              <p className="mt-4.5 text-[17px] leading-[1.65] text-muted">
                {t({
                  en: 'It mounts in your page, uses your fonts and your language, and hands you the file when someone saves. Where documents live and who can open them stays your app’s business.',
                  es: 'Se monta en tu página, usa tus fuentes y tu idioma, y te entrega el archivo cuando alguien guarda. Dónde viven los documentos y quién puede abrirlos sigue siendo asunto de tu aplicación.',
                  zh: '它挂载在你的页面里，使用你的字体和语言，有人保存时把文件交给你。文档存放在哪里、谁能打开，仍然由你的应用决定。',
                })}
              </p>
              <Link href="/docs/react/" className="mt-5 inline-flex items-center gap-1.5 font-semibold text-brand hover:text-brand-hover">
                {t({ en: 'Read the guide', es: 'Lee la guía', zh: '阅读指南' })} <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="reveal min-w-0 flex-[1.2_1_480px]">
              <CodeTabs samples={samples} />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1180px] px-6 py-20">
          <div className="reveal mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Pill color="orange">{t({ en: 'Packages', es: 'Paquetes', zh: '软件包' })}</Pill>
              <Title small>{t({ en: 'Take what you need.', es: 'Toma lo que necesites.', zh: '按需选用。' })}</Title>
            </div>
            <p className="max-w-[380px] text-base leading-[1.6] text-muted">
              {t({
                en: 'Six packages on npm. The engine has no DOM, so the same core renders PDFs in Node.',
                es: 'Seis paquetes en npm. El motor no usa el DOM, así que el mismo núcleo genera PDF en Node.',
                zh: 'npm 上的六个软件包。引擎不依赖 DOM，因此同一个核心可以在 Node 中生成 PDF。',
              })}{' '}
              <a href={NPM_ORG} className="font-medium text-brand hover:text-brand-hover">
                {t({ en: 'See them on npm →', es: 'Míralos en npm →', zh: '在 npm 上查看 →' })}
              </a>
            </p>
          </div>
          <div className="reveal overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[680px] border-collapse text-left text-[15px]">
              <colgroup>
                <col className="w-[27%]" />
                <col className="w-[49%]" />
                <col />
              </colgroup>
              <thead className="bg-surface text-[13px] font-medium text-muted">
                <tr>
                  <th className="px-4.5 py-[11px] font-medium">{t({ en: 'Package', es: 'Paquete', zh: '软件包' })}</th>
                  <th className="border-l border-border px-4.5 py-[11px] font-medium">{t({ en: 'What it does', es: 'Qué hace', zh: '用途' })}</th>
                  <th className="border-l border-border px-4.5 py-[11px] font-medium">{t({ en: 'Runs in', es: 'Corre en', zh: '运行环境' })}</th>
                </tr>
              </thead>
              <tbody>
                {PACKAGES.map((pkg) => (
                  <tr key={pkg.name} className="border-t border-border align-top transition-colors hover:bg-surface">
                    <td className="px-4.5 py-3.5">
                      <a href={npmOf(pkg.name)} className="font-code text-sm font-medium text-ink underline decoration-border-strong underline-offset-4 hover:decoration-current">
                        {pkg.name}
                      </a>
                      <div className="mt-1 text-xs text-muted">v{VERSION}</div>
                    </td>
                    <td className="border-l border-border px-4.5 py-3.5 text-ink-soft">{t(pkg.what)}</td>
                    <td className="border-l border-border px-4.5 py-3">
                      <span className={`rounded-md px-[9px] py-[3px] text-[13px] font-medium ${PASTEL_CLASS[pkg.color]}`}>{t(pkg.tag)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="status" className="mx-auto max-w-[1180px] px-6 pb-25 pt-15">
          <div className="reveal flex flex-wrap items-center gap-10 rounded-[28px] bg-pastel-yellow p-[clamp(28px,5vw,64px)]">
            <div className="min-w-0 flex-[1_1_340px]">
              <span className="rounded-full bg-white px-3 py-[5px] text-[13px] font-semibold text-pastel-yellow-fg">{t({ en: 'Where it stands', es: 'Dónde está', zh: '当前进展' })}</span>
              <p className="mt-4.5 font-display text-[clamp(80px,11vw,140px)] font-extrabold leading-[0.9] tracking-[-0.03em]">{tests}</p>
              <p className="mt-2 text-lg text-[#5c4a1e]">{t({ en: 'automated tests passing', es: 'pruebas automatizadas pasando', zh: '项自动化测试全部通过' })}</p>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-white" aria-hidden="true">
                <div className="h-full w-0 animate-grow rounded-full bg-brand" />
              </div>
              <p className="mt-2.5 font-hand text-2xl font-semibold text-pastel-yellow-fg">
                {t({ en: 'measured against Word, line by line', es: 'medido contra Word, línea por línea', zh: '与 Word 逐行比对' })}
              </p>
            </div>
            <div className="min-w-0 flex-[1_1_380px]">
              <p className="font-display text-[clamp(24px,2.6vw,32px)] font-bold leading-[1.3] tracking-[-0.03em]">
                {t({ en: 'Tested, measured, and published on npm.', es: 'Probado, medido y publicado en npm.', zh: '经过测试和测量，已发布到 npm。' })}
              </p>
              <p className="mt-4 text-[17px] leading-[1.6] text-[#5c4a1e]">
                {t({
                  en: `Its own word processor, with its own engine, that opens and saves .docx files. In the ${AGAINST_WORD.length} documents measured against Word, ${linesLikeWord()}% of the lines fall where Word puts them, and the work goes on to reach all of them. Open source under MIT.`,
                  es: `Un procesador de textos propio, con su propio motor, que abre y guarda archivos .docx. En los ${AGAINST_WORD.length} documentos medidos contra Word, el ${linesLikeWord()}% de las líneas caen donde Word las pone, y el trabajo sigue hasta llegar a todas. Código abierto con licencia MIT.`,
                  zh: `一个拥有自己引擎的文字处理器，可以打开和保存 .docx 文件。在与 Word 对照测量的 ${AGAINST_WORD.length} 份文档中，${linesLikeWord()}% 的行与 Word 的位置一致，我们还在继续努力，直到全部一致。基于 MIT 许可证开源。`,
                })}
              </p>
              <p className="mt-6.5 flex flex-wrap gap-2.5">
                <Link href="/docs/getting-started/" className={`rounded-xl px-5 py-[13px] ${primary}`}>
                  {t({ en: 'Get started', es: 'Empezar', zh: '开始使用' })}
                </Link>
                <Link href="/docs/status/" className="rounded-xl bg-white px-5 py-[13px] font-semibold text-ink transition-colors hover:bg-hover">
                  {t({ en: 'What’s checked, what’s missing →', es: 'Qué está comprobado y qué falta →', zh: '已验证的和尚缺的 →' })}
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
