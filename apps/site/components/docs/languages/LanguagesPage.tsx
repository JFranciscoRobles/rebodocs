import { PLURALS, messages } from '@rebodocs/editor';
import zhHans from '@rebodocs/editor/locales/zh-Hans';
import { LocalLink } from '@/components/i18n';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import type { L } from '@/lib/i18n';
import { getT } from '@/lib/locale';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { FUNCTIONS, WHAT } from './data';
import { LazySwitcher } from './Lazy';
import { type TextRow, Texts } from './Texts';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

/** What `npm run locale` does to a file that is there, from tools/locale.ts. */
const UPDATE: [title: L, text: L][] = [
  [
    { en: 'Keeps', es: 'Conserva', zh: '保留' },
    { en: 'every text already in the file, translated or not.', es: 'cada texto que ya está en el archivo, traducido o no.', zh: '文件中已有的每段文本，无论是否已翻译。' },
  ],
  [
    { en: 'Adds', es: 'Añade', zh: '添加' },
    {
      en: 'the texts the interface gained since, in English (or in the language of --from).',
      es: 'los textos que ganó la interfaz desde entonces, en inglés (o en el idioma de --from).',
      zh: '界面此后新增的文本，以英语（或 --from 指定的语言）写入。',
    },
  ],
  [
    { en: 'Takes out', es: 'Quita', zh: '删除' },
    { en: 'the keys the interface no longer has.', es: 'las claves que la interfaz ya no tiene.', zh: '界面中已不存在的键。' },
  ],
  [
    { en: 'Says', es: 'Dice', zh: '报告' },
    {
      en: 'how many texts there are, how many are new, and how many still read as in English; up to 20, by key.',
      es: 'cuántos textos hay, cuántos son nuevos y cuántos se leen aún como en inglés; hasta 20, por clave.',
      zh: '共有多少段文本、新增多少段，以及还有多少段与英文相同；最多按键列出 20 个。',
    },
  ],
];

/**
 * "Languages": the editor switched between Spanish, English, Simplified
 * Chinese and a French started on the page, the Chinese of its modules, how to add a language and keep it up to date, and
 * every text of the interface, read from @rebodocs/editor when the site is built.
 */
export async function LanguagesPage() {
  const t = getT();
  const es = messages('es');
  const en = messages('en');
  const zh = zhHans as Record<string, string | undefined>;
  const rows: TextRow[] = Object.keys(en).map((key) => [key, es[key as keyof typeof es], en[key as keyof typeof en], zh[key] ?? en[key as keyof typeof en]]);
  const zhCount = Object.keys(zhHans).length;
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
  const [basic, chinese, start, json, give, alone, update, change, own, fromCode, russian] = await Promise.all([
    highlight(`<DocsEditor locale="en" />   // left out: the browser's language, or English`, 'tsx', LIGHT_THEME),
    highlight(
      `import zhHans from '@rebodocs/editor/locales/zh-Hans';   // Simplified
import zhHant from '@rebodocs/editor/locales/zh-Hant';   // Traditional

// A browser in Chinese shows the one it asks for; locale="zh-Hans" for everyone
<DocsEditor locales={{ 'zh-Hans': zhHans, 'zh-Hant': zhHant }} />

// …or for an interface of your own
addLocale('zh-Hans', zhHans);
addLocale('zh-Hant', zhHant);`,
      'tsx',
      LIGHT_THEME,
    ),
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
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">{t({ en: 'Languages', es: 'Idiomas', zh: '语言' })}</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        {t({
          en: `The interface comes in Spanish and English, and in Simplified and Traditional Chinese for the applications that add them. Every text a person reads is looked up by a key, ${rows.length} of them, so another language is a file of translations, added without touching the editor.`,
          es: `La interfaz viene en español e inglés, y en chino simplificado y tradicional para las aplicaciones que los añadan. Cada texto que lee una persona se busca por una clave, ${rows.length} en total, así que otro idioma es un archivo de traducciones, añadido sin tocar el editor.`,
          zh: `界面自带西班牙语和英语，并为需要的应用提供简体中文和繁体中文。用户看到的每段文字都通过键查找，共 ${rows.length} 个，因此添加一种语言只需一个翻译文件，无需改动编辑器。`,
        })}
      </p>
      <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: basic }} />
      <p className={prose}>
        {t({
          en: (
            <>
              <code className={mono}>locale</code> takes a code or a browser tag (<code className={mono}>&apos;en-US&apos;</code>, <code className={mono}>&apos;es_MX&apos;</code>,{' '}
              <code className={mono}>&apos;zh-TW&apos;</code>). A language the interface does not speak gives English.
            </>
          ),
          es: (
            <>
              <code className={mono}>locale</code> acepta un código o una etiqueta del navegador (<code className={mono}>&apos;en-US&apos;</code>, <code className={mono}>&apos;es_MX&apos;</code>,{' '}
              <code className={mono}>&apos;zh-TW&apos;</code>). Un idioma que la interfaz no habla da inglés.
            </>
          ),
          zh: (
            <>
              <code className={mono}>locale</code> 接受代码或浏览器标签（<code className={mono}>&apos;en-US&apos;</code>、<code className={mono}>&apos;es_MX&apos;</code>、
              <code className={mono}>&apos;zh-TW&apos;</code>）。界面不支持的语言会显示为英语。
            </>
          ),
        })}
      </p>
      <div className="mt-4">
        <HandTip>{t({ en: 'tip: switch the editor below to French', es: 'consejo: cambia el editor de abajo a francés', zh: '提示：把下面的编辑器切换为法语' })}</HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge={t({ en: 'Live', es: 'En vivo', zh: '实时' })} color="green" title={t({ en: 'Switch it', es: 'Cámbialo', zh: '切换语言' })}>
          {t({
            en: 'The editor in the two languages it comes with, in the Simplified Chinese of its module, and in a French started the way a translation starts: what shows in the status bar, the styles and the File menu, and nothing else yet.',
            es: 'El editor en los dos idiomas con que viene, en el chino simplificado de su módulo, y en un francés empezado como empieza una traducción: lo que se ve en la barra de estado, los estilos y el menú Archivo, y nada más todavía.',
            zh: '编辑器可以使用自带的两种语言、其模块中的简体中文，以及一种刚开始翻译的法语：只翻译了状态栏、样式和“文件”菜单中显示的内容，其他尚未翻译。',
          })}
        </SectionHead>
        <LazySwitcher />
        <p className={prose}>
          {t({
            en: (
              <>
                In French, open the menu (☰): <em>Fichier</em>, <em>Ouvrir un document…</em>, <em>Exporter</em>, and then <em>Print…</em> and <em>Page setup…</em>, in English, because the file does
                not say them. A partial translation works; what it leaves out reads in English. Changing the language builds the bars again; the document and its history stay as they were.
              </>
            ),
            es: (
              <>
                En francés, abre el menú (☰): <em>Fichier</em>, <em>Ouvrir un document…</em>, <em>Exporter</em>, y luego <em>Print…</em> y <em>Page setup…</em>, en inglés, porque el archivo no los
                dice. Una traducción parcial funciona; lo que deja fuera se lee en inglés. Cambiar el idioma vuelve a construir las barras; el documento y su historial quedan como estaban.
              </>
            ),
            zh: (
              <>
                切换到法语后打开菜单（☰）：<em>Fichier</em>、<em>Ouvrir un document…</em>、<em>Exporter</em>，然后是英文的 <em>Print…</em> 和 <em>Page setup…</em>
                ，因为翻译文件中没有它们。部分翻译也能使用；未翻译的部分以英语显示。切换语言会重新构建工具栏；文档及其历史记录保持不变。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="chinese" className="mt-24">
        <SectionHead id="chinese" badge="中文" color="pink" title={t({ en: 'Chinese', es: 'Chino', zh: '中文' })}>
          {t({
            en: (
              <>
                Simplified and Traditional Chinese are translated in full, as Word says each: Simplified as in mainland China, Traditional as in Taiwan. They come apart from the editor, so an
                application that does not want them does not carry their {zhCount} texts.
              </>
            ),
            es: (
              <>
                El chino simplificado y el tradicional están traducidos por completo, como los dice Word: el simplificado como en China continental, el tradicional como en Taiwán. Vienen aparte del
                editor, así que una aplicación que no los quiere no lleva sus {zhCount} textos.
              </>
            ),
            zh: <>简体中文和繁体中文均已完整翻译，用词与 Word 一致：简体中文按中国大陆的用法，繁体中文按台湾的用法。它们与编辑器分开提供，不需要的应用就不必携带这 {zhCount} 段文本。</>,
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: chinese }} />
        <ul className="m-0 mt-5 grid max-w-[760px] list-none gap-3 p-0">
          {[
            t({
              en: (
                <>
                  <code className={mono}>zh</code>, <code className={mono}>zh-CN</code> and <code className={mono}>zh-SG</code> find the Simplified one; <code className={mono}>zh-TW</code>,{' '}
                  <code className={mono}>zh-HK</code>, <code className={mono}>zh-MO</code> and <code className={mono}>zh-Hant</code> the Traditional one. A tag of the one not added gives English, as
                  any language not added does.
                </>
              ),
              es: (
                <>
                  <code className={mono}>zh</code>, <code className={mono}>zh-CN</code> y <code className={mono}>zh-SG</code> encuentran el simplificado; <code className={mono}>zh-TW</code>,{' '}
                  <code className={mono}>zh-HK</code>, <code className={mono}>zh-MO</code> y <code className={mono}>zh-Hant</code> el tradicional. Una etiqueta del que no se añadió da inglés, como
                  cualquier idioma no añadido.
                </>
              ),
              zh: (
                <>
                  <code className={mono}>zh</code>、<code className={mono}>zh-CN</code> 和 <code className={mono}>zh-SG</code> 对应简体中文；<code className={mono}>zh-TW</code>、
                  <code className={mono}>zh-HK</code>、<code className={mono}>zh-MO</code> 和 <code className={mono}>zh-Hant</code>{' '}
                  对应繁体中文。未添加的那一种的标签会显示为英语，与其他未添加的语言一样。
                </>
              ),
            }),
            t({
              en: (
                <>
                  A browser in Chinese gets Chinese by itself once it is added: until the application sets a language, <code className={mono}>addLocale</code> takes one the browser asks for before the
                  one shown. With <code className={mono}>locale</code>, or after <code className={mono}>setLocale</code>, the language is the application’s.
                </>
              ),
              es: (
                <>
                  Un navegador en chino recibe chino por sí solo una vez añadido: hasta que la aplicación fija un idioma, <code className={mono}>addLocale</code> toma uno que el navegador pide antes
                  que el que se muestra. Con <code className={mono}>locale</code>, o después de <code className={mono}>setLocale</code>, el idioma es el de la aplicación.
                </>
              ),
              zh: (
                <>
                  添加中文后，中文浏览器会自动显示中文：在应用设置语言之前，如果浏览器优先要求的语言排在当前显示的语言之前，<code className={mono}>addLocale</code> 会采用它。提供{' '}
                  <code className={mono}>locale</code> 或调用 <code className={mono}>setLocale</code> 之后，则以应用设置的语言为准。
                </>
              ),
            }),
            t({
              en: 'In Chinese, the toolbar’s font box offers the fonts for Chinese Word has: DengXian, SimSun, SimHei, Microsoft YaHei, KaiTi and FangSong, or PMingLiU, MingLiU, Microsoft JhengHei and DFKai-SB in Traditional. One of them chosen is written as the font of the Chinese text of the run, as Word writes it.',
              es: 'En chino, el cuadro de fuentes de la barra ofrece las fuentes para chino que tiene Word: DengXian, SimSun, SimHei, Microsoft YaHei, KaiTi y FangSong, o PMingLiU, MingLiU, Microsoft JhengHei y DFKai-SB en tradicional. Una de ellas elegida se escribe como la fuente del texto chino del run, como lo escribe Word.',
              zh: '在中文界面中，工具栏的字体框会提供 Word 自带的中文字体：等线、宋体、黑体、微软雅黑、楷体和仿宋；繁体中文则为新细明体、细明体、微软正黑体和标楷体。选择其中一种时，会像 Word 一样写为该 run 中文文字的字体。',
            }),
            t({
              en: 'Chinese text itself needs no setting: it breaks between any two characters and keeps “。” and “，” off the start of a line, as Word does, in any language of the interface.',
              es: 'El texto chino en sí no necesita ningún ajuste: se corta entre dos caracteres cualesquiera y no deja “。” ni “，” al principio de una línea, como Word, en cualquier idioma de la interfaz.',
              zh: '中文文字本身无需任何设置：无论界面是什么语言，都会像 Word 一样在任意两个字符之间换行，并且不会让“。”和“，”出现在行首。',
            }),
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[15px] leading-[1.6] text-ink-soft">
              <span aria-hidden="true" className="mt-2.5 size-1.5 flex-none rounded-full bg-[#c9c6bf]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="adding-a-language" className="mt-24">
        <SectionHead
          id="adding-a-language"
          badge={t({ en: 'Your language', es: 'Tu idioma', zh: '你的语言' })}
          color="blue"
          title={t({ en: 'Adding a language', es: 'Añadir un idioma', zh: '添加语言' })}
        >
          {t({
            en: 'A file of translations, started by a command of the repository, and given to the editor.',
            es: 'Un archivo de traducciones, empezado con un comando del repositorio, y dado al editor.',
            zh: '一个翻译文件：用仓库中的命令创建，然后交给编辑器。',
          })}
        </SectionHead>
        <ol className="m-0 mt-8 flex max-w-[860px] list-none flex-col gap-8 p-0">
          {step(
            1,
            t({ en: 'Start the file', es: 'Empieza el archivo', zh: '创建文件' }),
            <>
              <p className={prose}>
                {t({
                  en: 'It is written with every text in English, to translate. What the language calls itself goes in already: “Français” for fr.',
                  es: 'Se escribe con todos los textos en inglés, para traducir. Lo que el idioma se llama a sí mismo ya va: “Français” para fr.',
                  zh: '文件中会写入所有英文文本，供你翻译。语言的自称已经写好：fr 为“Français”。',
                })}
              </p>
              <div className={`mt-3 ${CODE}`} dangerouslySetInnerHTML={{ __html: start }} />
            </>,
          )}
          {step(
            2,
            t({ en: 'Translate it', es: 'Tradúcelo', zh: '翻译' }),
            <>
              <p className={prose}>
                {t({
                  en: (
                    <>
                      It is plain JSON, a key and a text. Leave what is in braces as it is: {placeholders} texts have a <code className={mono}>{'{name}'}</code> the editor fills in.
                    </>
                  ),
                  es: (
                    <>
                      Es JSON plano, una clave y un texto. Deja lo que está entre llaves como está: {placeholders} textos tienen un <code className={mono}>{'{name}'}</code> que llena el editor.
                    </>
                  ),
                  zh: (
                    <>
                      它是普通的 JSON，每项是一个键和一段文本。花括号中的内容保持不变：有 {placeholders} 段文本包含由编辑器填入的 <code className={mono}>{'{name}'}</code>。
                    </>
                  ),
                })}
              </p>
              <div className={`mt-3 ${CODE}`} dangerouslySetInnerHTML={{ __html: json }} />
            </>,
          )}
          {step(
            3,
            t({ en: 'Give it to the editor', es: 'Dáselo al editor', zh: '交给编辑器' }),
            <>
              <div className={`mt-3 ${CODE}`} dangerouslySetInnerHTML={{ __html: give }} />
              <div className={`mt-3 ${CODE}`} dangerouslySetInnerHTML={{ __html: alone }} />
              <p className={prose}>
                {t({
                  en: (
                    <>
                      With <code className={mono}>features.language</code>, the language is in the menu by itself, under its own name: <code className={mono}>locale.name</code>, or what the browser
                      calls the language if the file leaves it out.
                    </>
                  ),
                  es: (
                    <>
                      Con <code className={mono}>features.language</code>, el idioma aparece solo en el menú, con su propio nombre: <code className={mono}>locale.name</code>, o lo que el navegador
                      llama al idioma si el archivo lo omite.
                    </>
                  ),
                  zh: (
                    <>
                      启用 <code className={mono}>features.language</code> 后，该语言会自动出现在菜单中，使用它自己的名称：<code className={mono}>locale.name</code>
                      ；文件中没有时，使用浏览器对该语言的称呼。
                    </>
                  ),
                })}
              </p>
            </>,
          )}
        </ol>
        <h3 className="m-0 mt-12 font-display text-xl font-bold tracking-[-0.01em]">
          {t({ en: 'Languages with more plural forms', es: 'Idiomas con más formas de plural', zh: '复数形式更多的语言' })}
        </h3>
        <p className={prose}>
          {t({
            en: (
              <>
                Spanish and English say a number of things one way for one and another for the rest. Russian has four plural categories, Arabic six; Chinese, one. {counted.length} texts are said of a
                number, and for each a language gives a form per plural category of its own, as <code className={mono}>&lt;key&gt;.&lt;category&gt;</code>; the editor picks it with{' '}
                <code className={mono}>Intl.PluralRules</code>. What a form leaves out is the key&apos;s text.
              </>
            ),
            es: (
              <>
                El español y el inglés dicen una cantidad de cosas de una forma para una y de otra para el resto. El ruso tiene cuatro categorías de plural, el árabe seis; el chino, una.{' '}
                {counted.length} textos se dicen de un número, y para cada uno un idioma da una forma por cada categoría de plural propia, como{' '}
                <code className={mono}>&lt;key&gt;.&lt;category&gt;</code>; el editor la elige con <code className={mono}>Intl.PluralRules</code>. Lo que una forma omite es el texto de la clave.
              </>
            ),
            zh: (
              <>
                西班牙语和英语在表示数量时，单数一种说法，其余一种说法。俄语有四种复数类别，阿拉伯语有六种，中文只有一种。有 {counted.length}{' '}
                段文本与数字连用，每种语言可以为自己的每个复数类别提供一种形式，写作 <code className={mono}>&lt;key&gt;.&lt;category&gt;</code>；编辑器用 <code className={mono}>Intl.PluralRules</code>{' '}
                来选择。某个形式缺失时使用该键的文本。
              </>
            ),
          })}
        </p>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: russian }} />
        <p className={prose}>
          {t({
            en: (
              <>
                In Russian, “one” is 1, 21, 31…; “few” is 2 to 4, 22 to 24…; “many” is 5 to 20, 25 to 30…: 21 words is <em>21 слово</em>, said like one.
              </>
            ),
            es: (
              <>
                En ruso, “one” es 1, 21, 31…; “few” es de 2 a 4, de 22 a 24…; “many” es de 5 a 20, de 25 a 30…: 21 palabras es <em>21 слово</em>, dicho como uno.
              </>
            ),
            zh: (
              <>
                在俄语中，“one”是 1、21、31…；“few”是 2 到 4、22 到 24…；“many”是 5 到 20、25 到 30…：21 个词写作 <em>21 слово</em>，与单数说法相同。
              </>
            ),
          })}
        </p>
        <p className={prose}>
          {t({
            en: (
              <>
                <code className={mono}>npm run locale</code> puts the forms the language needs in its file, to translate with the rest: one, few and many for Russian, none for German or Chinese. The
                texts said of a number are{' '}
              </>
            ),
            es: (
              <>
                <code className={mono}>npm run locale</code> pone en su archivo las formas que necesita el idioma, para traducirlas con el resto: one, few y many para el ruso, ninguna para el alemán o
                el chino. Los textos que se dicen de un número son{' '}
              </>
            ),
            zh: (
              <>
                <code className={mono}>npm run locale</code> 会把该语言所需的形式写进文件，与其他文本一起翻译：俄语为 one、few 和 many，德语和中文则不需要。与数字连用的文本有{' '}
              </>
            ),
          })}
          {counted.map((key, i) => (
            <span key={key}>
              {i > 0 && (i === counted.length - 1 ? t({ en: ' and ', es: ' y ', zh: ' 和 ' }) : t({ en: ', ', es: ', ', zh: '、' }))}
              <code className="font-code text-[13.5px] text-ink">{key}</code>
            </span>
          ))}
          {t({ en: '.', es: '.', zh: '。' })}
        </p>
      </section>

      <section aria-labelledby="keeping-it-up-to-date" className="mt-24">
        <SectionHead
          id="keeping-it-up-to-date"
          badge={t({ en: 'New versions', es: 'Versiones nuevas', zh: '新版本' })}
          color="purple"
          title={t({ en: 'Keeping it up to date', es: 'Mantenerlo al día', zh: '保持更新' })}
        >
          {t({
            en: 'When the interface gains texts, run the same command on the same file.',
            es: 'Cuando la interfaz gana textos, ejecuta el mismo comando sobre el mismo archivo.',
            zh: '界面新增文本时，对同一个文件运行同样的命令。',
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: update }} />
        <div className="mt-6 grid max-w-[860px] grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] gap-4">
          {UPDATE.map(([title, text]) => (
            <div key={title.en} className="rounded-2xl border border-border p-5">
              <p className="m-0 font-display text-base font-bold tracking-[-0.01em]">{t(title)}</p>
              <p className="m-0 mt-1.5 text-[15px] leading-[1.6] text-ink-soft">{t(text)}</p>
            </div>
          ))}
        </div>
        <p className={prose}>
          {t({
            en: 'A text that reads as in English counts as one to translate, unless it is too short to tell (an “OK”, a “%”). A text left out of a language is shown in English.',
            es: 'Un texto que se lee como en inglés cuenta como uno por traducir, salvo que sea demasiado corto para saberlo (un “OK”, un “%”). Un texto que falta en un idioma se muestra en inglés.',
            zh: '与英文相同的文本会算作待翻译，除非它短到无法判断（如“OK”“%”）。某种语言缺少的文本以英语显示。',
          })}
        </p>
      </section>

      <section aria-labelledby="changing-words-of-a-language-there-is" className="mt-24">
        <SectionHead
          id="changing-words-of-a-language-there-is"
          badge={t({ en: 'Your words', es: 'Tus palabras', zh: '自定义用词' })}
          color="orange"
          title={t({ en: 'Changing words of a language there is', es: 'Cambiar palabras de un idioma que ya hay', zh: '修改已有语言的用词' })}
        >
          {t({
            en: 'The same way, with the texts to change: the rest of the language stays as it is. Try it in the demo above.',
            es: 'De la misma forma, con los textos que cambiar: el resto del idioma queda como está. Pruébalo en el demo de arriba.',
            zh: '方法相同，只提供要修改的文本：该语言的其他部分保持不变。可以在上面的演示中试试。',
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: change }} />
        <p className={prose}>
          {t({
            en: (
              <>
                Given later, to the <code className={mono}>locales</code> prop or to <code className={mono}>addLocale</code>, they take effect at once: when they are of the language shown, the bars
                are built again with them.
              </>
            ),
            es: (
              <>
                Dados después, a la prop <code className={mono}>locales</code> o a <code className={mono}>addLocale</code>, surten efecto en el acto: cuando son del idioma que se muestra, las barras
                se vuelven a construir con ellos.
              </>
            ),
            zh: (
              <>
                之后再传给 <code className={mono}>locales</code> 属性或 <code className={mono}>addLocale</code> 的文本会立即生效：如果属于当前显示的语言，工具栏会用它们重新构建。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="what-is-translated" className="mt-24">
        <SectionHead id="what-is-translated" badge={t({ en: 'Scope', es: 'Alcance', zh: '范围' })} color="pink" title={t({ en: 'What is translated', es: 'Qué se traduce', zh: '翻译的范围' })} />
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4">
          {WHAT.map((item) => (
            <div key={item.color} className="rounded-2xl border border-border p-5">
              <p className="m-0 font-display text-base font-bold tracking-[-0.01em]">{t(item.title)}</p>
              <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[item.color]}`}>{t(item.answer)}</span>
              <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{t(item.text)}</p>
            </div>
          ))}
        </div>
        <p className={prose}>
          {t({
            en: (
              <>
                <code className={mono}>useDocsStyles</code> gives the standard styles translated too, and again when the language changes.
              </>
            ),
            es: (
              <>
                <code className={mono}>useDocsStyles</code> también da los estilos estándar traducidos, y de nuevo cuando cambia el idioma.
              </>
            ),
            zh: (
              <>
                <code className={mono}>useDocsStyles</code> 也会给出翻译后的标准样式名，语言改变时会重新给出。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="your-own-interface" className="mt-24">
        <SectionHead id="your-own-interface" badge="Headless" color="purple" title={t({ en: 'Your own interface', es: 'Tu propia interfaz', zh: '自己的界面' })}>
          {t({
            en: (
              <>
                An interface built on the{' '}
                <LocalLink href="/docs/headless/" className={LINK}>
                  headless hooks
                </LocalLink>{' '}
                has labels of its own, which the library knows nothing of. To have them follow the same language, keep them in a table and read the language where they are drawn.
              </>
            ),
            es: (
              <>
                Una interfaz construida con los{' '}
                <LocalLink href="/docs/headless/" className={LINK}>
                  hooks headless
                </LocalLink>{' '}
                tiene etiquetas propias, de las que la biblioteca no sabe nada. Para que sigan el mismo idioma, guárdalas en una tabla y lee el idioma donde se dibujan.
              </>
            ),
            zh: (
              <>
                基于
                <LocalLink href="/docs/headless/" className={LINK}>
                  headless hooks
                </LocalLink>
                构建的界面有自己的标签，库对它们一无所知。要让它们跟随同一种语言，可以把它们放在一张表中，并在绘制的地方读取当前语言。
              </>
            ),
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: own }} />
        <p className={prose}>
          {t({
            en: (
              <>
                Where the library has the word, <code className={mono}>t(&apos;menu.save&apos;)</code> gives it, with the same hook around it to be drawn again. A selector of your own is{' '}
                <code className={mono}>setLocale(&apos;en&apos;)</code>. The{' '}
                <LocalLink href="/docs/demos/#the-react-package" className={LINK}>
                  React demo
                </LocalLink>{' '}
                does this for every label it has, in <code className={mono}>apps/demo/src/headless/texts.ts</code>.
              </>
            ),
            es: (
              <>
                Donde la biblioteca tiene la palabra, <code className={mono}>t(&apos;menu.save&apos;)</code> la da, con el mismo hook alrededor para volver a dibujarse. Un selector propio es{' '}
                <code className={mono}>setLocale(&apos;en&apos;)</code>. El{' '}
                <LocalLink href="/docs/demos/#the-react-package" className={LINK}>
                  demo de React
                </LocalLink>{' '}
                hace esto con todas sus etiquetas, en <code className={mono}>apps/demo/src/headless/texts.ts</code>.
              </>
            ),
            zh: (
              <>
                库中已有的词可以用 <code className={mono}>t(&apos;menu.save&apos;)</code> 获取，同样用这个 hook 包裹以便重新绘制。自己的语言选择器只需调用{' '}
                <code className={mono}>setLocale(&apos;en&apos;)</code>。
                <LocalLink href="/docs/demos/#the-react-package" className={LINK}>
                  React 演示
                </LocalLink>
                在 <code className={mono}>apps/demo/src/headless/texts.ts</code> 中对它的所有标签都这样做了。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="from-code" className="mt-24">
        <SectionHead id="from-code" badge={t({ en: 'Reference', es: 'Referencia', zh: '参考' })} color="blue" title={t({ en: 'From code', es: 'Desde código', zh: '在代码中' })}>
          {t({
            en: (
              <>
                Every function of the languages, from <code className={mono}>@rebodocs/react</code> (or <code className={mono}>@rebodocs/editor</code>), with the types{' '}
                <code className={mono}>MessageKey</code> and <code className={mono}>Messages</code>.
              </>
            ),
            es: (
              <>
                Todas las funciones de los idiomas, de <code className={mono}>@rebodocs/react</code> (o <code className={mono}>@rebodocs/editor</code>), con los tipos{' '}
                <code className={mono}>MessageKey</code> y <code className={mono}>Messages</code>.
              </>
            ),
            zh: (
              <>
                语言相关的所有函数，来自 <code className={mono}>@rebodocs/react</code>（或 <code className={mono}>@rebodocs/editor</code>），以及类型 <code className={mono}>MessageKey</code> 和{' '}
                <code className={mono}>Messages</code>。
              </>
            ),
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: fromCode }} />
        <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
          {FUNCTIONS.map((fn) => (
            <div key={fn.name} id={`fn-${fn.name}`} className="scroll-mt-24 border-t border-[#f0eee9] py-3.5 first:border-t-0">
              <dt className="font-code text-[13.5px] text-ink">
                <span className="font-semibold">{fn.signature}</span> <span className="text-muted">→ {fn.returns}</span>
              </dt>
              <dd className="m-0 mt-1 text-[15px] leading-normal text-ink-soft">{t(fn.text)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="texts" className="mt-24">
        <SectionHead
          id="texts"
          badge={t({ en: 'Every text', es: 'Todos los textos', zh: '全部文本' })}
          color="green"
          title={t({ en: 'The texts there are', es: 'Los textos que hay', zh: '现有的文本' })}
        >
          {t({
            en: (
              <>
                Each key with what it says in Spanish, English and Simplified Chinese, read from the editor when this page was built. A <code className={mono}>{'{name}'}</code> is filled in by the
                editor.
              </>
            ),
            es: (
              <>
                Cada clave con lo que dice en español, inglés y chino simplificado, leído del editor cuando se construyó esta página. Un <code className={mono}>{'{name}'}</code> lo llena el editor.
              </>
            ),
            zh: (
              <>
                每个键及其西班牙语、英语和简体中文文本，在构建本页时从编辑器读取。<code className={mono}>{'{name}'}</code> 由编辑器填入。
              </>
            ),
          })}
        </SectionHead>
        <Texts rows={rows} />
      </section>

      <section aria-labelledby="spelling" className="mt-24">
        <SectionHead id="spelling" badge={t({ en: 'The text', es: 'El texto', zh: '文字' })} color="green" title={t({ en: 'Spelling', es: 'Ortografía', zh: '拼写检查' })}>
          {t({
            en: 'A browser checks spelling only in text it edits, and the editor edits none of its own: it checks it itself. Words spelled wrong get a red wave, in the language the text is in, and their suggestions come in the bar beside the selection.',
            es: 'Un navegador revisa la ortografía solo en el texto que edita, y el editor no edita nada propio: la revisa él mismo. Las palabras mal escritas llevan una onda roja, en el idioma en que está el texto, y sus sugerencias aparecen en la barra junto a la selección.',
            zh: '浏览器只检查它自己编辑的文字的拼写，而编辑器的文字不由浏览器编辑：所以编辑器自己检查。拼错的词会按文字所用的语言加上红色波浪线，建议显示在选区旁的工具条中。',
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: spelling }} />
        <ul className="m-0 mt-5 grid max-w-[760px] list-none gap-3 p-0">
          {[
            t({
              en: (
                <>
                  <strong>The dictionaries are yours to give.</strong> Hunspell’s, as LibreOffice and Firefox use: an <code className={mono}>.aff</code> and a <code className={mono}>.dic</code> for
                  each language, by address or by a function that gives their text. Those of{' '}
                  <a href="https://github.com/wooorm/dictionaries" className={LINK}>
                    wooorm/dictionaries
                  </a>{' '}
                  on npm are one source, each under its own licence: the Spanish one GPL, LGPL or MPL, the English one MIT and BSD. Rebodocs carries none.
                </>
              ),
              es: (
                <>
                  <strong>Los diccionarios los das tú.</strong> Los de Hunspell, como usan LibreOffice y Firefox: un <code className={mono}>.aff</code> y un <code className={mono}>.dic</code> por
                  idioma, por dirección o por una función que da su texto. Los de{' '}
                  <a href="https://github.com/wooorm/dictionaries" className={LINK}>
                    wooorm/dictionaries
                  </a>{' '}
                  en npm son una fuente, cada uno con su licencia: el español GPL, LGPL o MPL, el inglés MIT y BSD. Rebodocs no lleva ninguno.
                </>
              ),
              zh: (
                <>
                  <strong>词典由你提供。</strong>使用 Hunspell 词典（LibreOffice 和 Firefox 也用它）：每种语言一个 <code className={mono}>.aff</code> 和一个 <code className={mono}>.dic</code>
                  ，可以给出地址，也可以给出返回其文本的函数。npm 上的{' '}
                  <a href="https://github.com/wooorm/dictionaries" className={LINK}>
                    wooorm/dictionaries
                  </a>{' '}
                  是一个来源，各有自己的许可证：西班牙语为 GPL、LGPL 或 MPL，英语为 MIT 和 BSD。Rebodocs 本身不带任何词典。
                </>
              ),
            }),
            t({
              en: (
                <>
                  <strong>Away from the page.</strong> nspell reads them in a worker the editor makes from a string, so no bundler has to find a file; a page with a Content Security Policy has to
                  allow <code className={mono}>worker-src blob:</code>. The Spanish dictionary takes about half a second to be ready, once.
                </>
              ),
              es: (
                <>
                  <strong>Fuera de la página.</strong> nspell los lee en un worker que el editor crea a partir de un string, así que ningún bundler tiene que encontrar un archivo; una página con
                  Content Security Policy tiene que permitir <code className={mono}>worker-src blob:</code>. El diccionario español tarda cerca de medio segundo en estar listo, una vez.
                </>
              ),
              zh: (
                <>
                  <strong>不占用页面线程。</strong>nspell 在编辑器用字符串创建的 worker 中读取词典，因此打包工具不需要查找文件；设置了内容安全策略的页面需要允许{' '}
                  <code className={mono}>worker-src blob:</code>。西班牙语词典大约需要半秒准备，只需一次。
                </>
              ),
            }),
            t({
              en: (
                <>
                  <strong>In the language of the text</strong>, the one of <code className={mono}>language</code>, of the file, or chosen at the foot of the editor: <code className={mono}>es</code>{' '}
                  serves <code className={mono}>es-MX</code> too. Changing it checks the words again; a language with no dictionary is not checked.
                </>
              ),
              es: (
                <>
                  <strong>En el idioma del texto</strong>, el de <code className={mono}>language</code>, el del archivo, o el elegido al pie del editor: <code className={mono}>es</code> sirve también
                  para <code className={mono}>es-MX</code>. Cambiarlo vuelve a revisar las palabras; un idioma sin diccionario no se revisa.
                </>
              ),
              zh: (
                <>
                  <strong>按文字的语言检查</strong>：取自 <code className={mono}>language</code>、文件，或编辑器底部选择的语言：<code className={mono}>es</code> 同样适用于{' '}
                  <code className={mono}>es-MX</code>。更改语言会重新检查；没有词典的语言不检查。
                </>
              ),
            }),
            t({
              en: (
                <>
                  <strong>What it checks:</strong> the words of the pages near the view, a quarter of a second after typing stops, and not the one being written until it is finished. Single letters,
                  words in capitals, words joined to digits, variables, addresses, emails, Chinese and Japanese characters and text taken out in tracked changes are left alone.
                </>
              ),
              es: (
                <>
                  <strong>Qué revisa:</strong> las palabras de las páginas cercanas a la vista, un cuarto de segundo después de dejar de escribir, y no la que se está escribiendo hasta que termina.
                  Letras sueltas, palabras en mayúsculas, palabras unidas a dígitos, variables, direcciones, correos, caracteres chinos y japoneses y texto quitado con control de cambios se dejan en
                  paz.
                </>
              ),
              zh: (
                <>
                  <strong>检查范围：</strong>
                  可视区域附近页面中的词，在停止输入四分之一秒后检查；正在输入的词要等输完才检查。单个字母、全大写的词、与数字相连的词、变量、网址、电子邮件、中日文字符以及修订中已删除的文字不检查。
                </>
              ),
            }),
            t({
              en: (
                <>
                  <strong>The suggestions:</strong> the other button on a word with the wave, a tap on it, or a tap of ⌘ (Ctrl) with the caret in it. A suggestion replaces the word as any edit does,
                  undone with ⌘Z and tracked when changes are. <em>Ignore</em> leaves the word alone in this document; <em>Add to dictionary</em> gives it to the dictionary, for as long as the page is
                  open.
                </>
              ),
              es: (
                <>
                  <strong>Las sugerencias:</strong> el otro botón sobre una palabra con la onda, un toque sobre ella, o un toque de ⌘ (Ctrl) con el cursor en ella. Una sugerencia reemplaza la palabra
                  como cualquier edición, se deshace con ⌘Z y se controla cuando hay control de cambios. <em>Ignorar</em> deja la palabra en paz en este documento; <em>Agregar al diccionario</em> se
                  la da al diccionario, mientras la página esté abierta.
                </>
              ),
              zh: (
                <>
                  <strong>建议：</strong>在带波浪线的词上点右键、轻点它，或在光标位于其中时轻按 ⌘（Ctrl）。选择建议会像任何编辑一样替换该词，可用 ⌘Z 撤销，开启修订时也会记录。
                  <em>忽略</em>会在本文档中不再标记该词；<em>添加到词典</em>会把它加入词典，直到页面关闭。
                </>
              ),
            }),
            t({
              en: (
                <>
                  <strong>A checker of your own</strong>, on your server for instance, is an object with <code className={mono}>check(words, language)</code> and{' '}
                  <code className={mono}>suggest(word, language)</code>, each answering at once or with a promise, and <code className={mono}>add</code> if it takes new words. Grammar is not checked.
                </>
              ),
              es: (
                <>
                  <strong>Un revisor propio</strong>, en tu servidor por ejemplo, es un objeto con <code className={mono}>check(words, language)</code> y{' '}
                  <code className={mono}>suggest(word, language)</code>, cada uno respondiendo en el acto o con una promesa, y <code className={mono}>add</code> si acepta palabras nuevas. La gramática
                  no se revisa.
                </>
              ),
              zh: (
                <>
                  <strong>自己的检查器</strong>（例如运行在你的服务器上）是一个带有 <code className={mono}>check(words, language)</code> 和 <code className={mono}>suggest(word, language)</code>{' '}
                  的对象，二者可以直接返回结果或返回 promise；如果支持添加新词，还可以有 <code className={mono}>add</code>。不检查语法。
                </>
              ),
            }),
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[15px] leading-[1.6] text-ink-soft">
              <span aria-hidden="true" className="mt-2.5 size-1.5 flex-none rounded-full bg-[#c9c6bf]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="know" className="mt-24">
        <SectionHead id="know" badge={t({ en: 'Limits', es: 'Límites', zh: '限制' })} color="yellow" title={t({ en: 'What to know', es: 'Qué saber', zh: '注意事项' })} />
        <ul className="m-0 mt-5 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-x-8 gap-y-3 p-0">
          {[
            t({
              en: 'Until locale says otherwise, the interface is in the first of the browser’s languages it speaks, or in English. It was written in Spanish first; the English texts were translated, and are waiting for a native review, as are the Chinese ones.',
              es: 'Hasta que locale diga otra cosa, la interfaz está en el primero de los idiomas del navegador que habla, o en inglés. Se escribió primero en español; los textos en inglés se tradujeron y esperan una revisión nativa, igual que los chinos.',
              zh: '在 locale 另行指定之前，界面使用浏览器语言中它支持的第一种，否则为英语。界面最初用西班牙语编写；英文文本是翻译的，正在等待母语人士审阅，中文文本也是如此。',
            }),
            t({
              en: 'The language is one for the whole page: two editors on a page are in the same one, and choosing it in the menu of either builds both again. The document and its history stay.',
              es: 'El idioma es uno para toda la página: dos editores en una página están en el mismo, y elegirlo en el menú de cualquiera vuelve a construir ambos. El documento y su historial se quedan.',
              zh: '整个页面只有一种界面语言：同一页面上的两个编辑器使用同一种语言，在任一编辑器的菜单中选择语言都会重新构建两者。文档及其历史记录保持不变。',
            }),
            t({
              en: 'A tag goes to the language it is of: en-US to English, fr-CA to French once French is added, zh-TW to Traditional Chinese once it is added. A language not added gives English.',
              es: 'Una etiqueta va al idioma del que es: en-US al inglés, fr-CA al francés una vez añadido el francés, zh-TW al chino tradicional una vez añadido. Un idioma no añadido da inglés.',
              zh: '标签会对应到它所属的语言：en-US 对应英语；添加法语后 fr-CA 对应法语；添加繁体中文后 zh-TW 对应繁体中文。未添加的语言显示为英语。',
            }),
            t({
              en: 'A {name} with no value given stays as it is written, braces and all.',
              es: 'Un {name} sin valor dado se queda como está escrito, con llaves y todo.',
              zh: '没有提供值的 {name} 会原样保留，包括花括号。',
            }),
            t({
              en: 'There is no removing a language once added; addLocale again changes its texts.',
              es: 'Un idioma añadido no se puede quitar; addLocale de nuevo cambia sus textos.',
              zh: '语言添加后无法移除；再次调用 addLocale 会修改它的文本。',
            }),
            t({
              en: 'Languages written right to left, such as Arabic and Hebrew, are not supported: the interface and the text of a document are laid out left to right. Chinese is laid out left to right, in lines, as Word does by default; vertical writing is not supported.',
              es: 'Los idiomas que se escriben de derecha a izquierda, como el árabe y el hebreo, no están soportados: la interfaz y el texto de un documento se componen de izquierda a derecha. El chino se compone de izquierda a derecha, en líneas, como hace Word por defecto; la escritura vertical no está soportada.',
              zh: '不支持从右向左书写的语言，如阿拉伯语和希伯来语：界面和文档文字都从左向右排版。中文按行从左向右排版，与 Word 的默认方式相同；不支持竖排。',
            }),
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
