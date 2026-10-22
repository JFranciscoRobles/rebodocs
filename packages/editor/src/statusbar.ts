// The bar under an Editor: where the caret is, how long the document is, and
// how the pages are shown. Like the toolbar, it only uses the public methods
// of the editor.

import { type Doc, docText } from '@rebodocs/core';
import { type Editor, type ViewMode, type ZoomFit, MAX_ZOOM, MIN_ZOOM } from './editor';
import { getLocale, plural, t, withRegion } from './i18n';

/** The languages offered for the text, by their tags: the ones the editor speaks first, then others of Europe and the Americas. */
const TEXT_LANGUAGES = ['es-MX', 'es-ES', 'es-AR', 'es-CO', 'en-US', 'en-GB', 'pt-BR', 'pt-PT', 'fr-FR', 'de-DE', 'it-IT', 'nl-NL', 'ca-ES'];
import { installRegionKeys, markRegion } from './a11y';
import { IS_MAC } from './platform';
import { applyTheme, inkOn } from './theme';

export interface StatusBar {
  /** Brings the bar in step with what is not the editor's to tell: whether an assistant is connected. */
  refresh(): void;
  /** Opens what the "Share" button opens: the link that invites, and who is on the document. */
  showCollab(): void;
  destroy(): void;
}

export interface StatusBarOptions {
  /**
   * How its parts are set out: in one bar ('bar', as it comes), each group a
   * chip of its own ('chips'), or as pills that float over the pages
   * ('floating'), for an application that lays them over its canvas.
   */
  layout?: 'bar' | 'chips' | 'floating';
  /**
   * Shown as an "AI" button when given: whether an assistant can reach the
   * document, and what switches that on and off. Connecting is the
   * application's business.
   */
  assistant?: { state: () => 'off' | 'connecting' | 'on'; toggle: () => void };
  /**
   * Shown as a "Share" button when given: whether the document is being
   * worked on with other people, who they are, and the link that brings one
   * more in. Reaching the server is the application's business.
   */
  collab?: {
    state: () => 'off' | 'connecting' | 'on' | 'offline';
    /** The others on the document. */
    peers: () => { name: string; color: string }[];
    /** This person's colour and name among them. */
    color: () => string;
    name: () => string;
    /** What gives this person another name; without it, the name is not theirs to change. */
    rename?: (name: string) => void;
    /** The address that opens the document for someone else, once it is shared; without one, none is shown. */
    link?: () => string | undefined;
    /** What starts sharing the document; without it, the button only shows once it is shared. */
    start?: () => void;
    /** What stops sharing it here; without it, there is no leaving: the document is a shared one. */
    leave?: () => void;
  };
  /** Shown as a button at the end when given: whether the pages are on their own, and what puts them so (`createFocusMode`). */
  focus?: { on: () => boolean; toggle: () => void };
}

/** The ends of the slider, in percent; the buttons and the wheel reach the editor's own limits. */
const SLIDER_MIN = MIN_ZOOM * 100;
const SLIDER_MAX = 200;
/** What one press of the − and + buttons moves the zoom by, in percent. */
const ZOOM_STEP = 10;
/** The zoom the grid of pages opens at, small enough to see several across. */
const GRID_ZOOM = 0.3;
const STYLE_ID = 'dx-statusbar-style';
/** What goes before the page while the header or the footer is being edited. */
const areaPrefix = (area: 'body' | 'header' | 'footer' | 'footnote' | 'textbox') =>
  area === 'body' ? '' : `${t(area === 'header' ? 'area.header' : area === 'footer' ? 'area.footer' : area === 'textbox' ? 'area.textbox' : 'area.footnote')} · `;

const CSS = `
.dx-sb-chips,.dx-sb-floating{gap:6px;padding:0;background:none;border:0}
.dx-sb-part{display:flex;align-items:center;gap:2px;min-height:34px;padding:2px 6px;box-sizing:border-box;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:12px;background:var(--dx-ui-bar,#fbfaf8);box-shadow:0 1px 2px rgba(47,46,43,.05),0 10px 30px -18px rgba(47,46,43,.28)}
.dx-sb-part:not(:has(> :not([data-fit=off]):not([hidden]))){display:none}
.dx-sb-floating{pointer-events:none}
.dx-sb-floating .dx-sb-part{pointer-events:auto;min-height:38px;padding:3px 8px;border-radius:999px;background:var(--dx-ui-bg,#fff);box-shadow:0 10px 28px -10px rgba(47,46,43,.35),0 1px 3px rgba(47,46,43,.08)}
.dx-sb{display:flex;align-items:center;gap:4px;min-height:34px;padding:0 10px;background:var(--dx-ui-bar,#fbfaf8);border-top:1px solid var(--dx-ui-line,#e6e3dc);font:12px system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--dx-ui-muted,#5f5d58);user-select:none;white-space:nowrap;overflow:hidden}
.dx-sb-info{padding:0 8px;font-variant-numeric:tabular-nums}
.dx-sb-info+.dx-sb-info{border-left:1px solid var(--dx-ui-line,#e6e3dc)}
.dx-sb-space{flex:1}
.dx-sb-sep{flex:none;width:1px;height:16px;margin:0 6px;background:var(--dx-ui-line,#e6e3dc)}
.dx-sb-btn{display:inline-flex;align-items:center;justify-content:center;height:28px;min-width:28px;padding:0 5px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;font-variant-numeric:tabular-nums;cursor:pointer}
.dx-sb-btn:hover:not(:disabled){background:var(--dx-ui-hover,#f3f1ec)}
.dx-sb-btn.dx-on{background:var(--dx-ui-active,#e8f0fd);color:var(--dx-ui-accent,#0b57d0)}
.dx-sb-btn:disabled{opacity:.35;cursor:default}
.dx-sb-btn:focus-visible,.dx-sb-range:focus-visible{outline:2px solid var(--dx-ui-accent,#0b57d0);outline-offset:-2px}
.dx-sb-range{width:120px;margin:0 2px;accent-color:var(--dx-ui-accent,#0b57d0);cursor:pointer}
.dx-sb-percent{min-width:46px}
.dx-sb-lang{height:28px;max-width:150px;padding:0 6px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;cursor:pointer}
.dx-sb-lang:hover{background:var(--dx-ui-hover,#f3f1ec)}
.dx-sb-lang:focus-visible{outline:2px solid var(--dx-ui-accent,#0b57d0);outline-offset:-2px}
.dx-sb-ai{gap:5px;padding:0 7px;font-weight:600}
.dx-sb-ai::before{content:"";width:7px;height:7px;border-radius:50%;background:#9aa0a6}
.dx-sb-ai[data-state=connecting]::before{background:#f4b400;animation:dx-sb-pulse 1s ease-in-out infinite}
.dx-sb-ai[data-state=on]::before{background:#34a853}
.dx-sb-ai[data-state=offline]::before{background:#ea4335}
.dx-sb-who{display:inline-flex;align-items:center;padding-left:2px}
.dx-sb-dot{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;margin-left:-4px;border:1.5px solid var(--dx-ui-bar,#fbfaf8);border-radius:50%;font-size:10px;font-weight:700;text-transform:uppercase}
.dx-sb-pop{position:fixed;z-index:40;width:300px;padding:14px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:16px;background:var(--dx-ui-bg,#fff);box-shadow:0 8px 28px rgba(47,46,43,.18);font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--dx-ui-ink,#2f2e2b);user-select:none;white-space:normal}
.dx-sb-pop label{display:block;margin:0 0 3px;color:var(--dx-ui-muted,#5f5d58);font-size:11px;font-weight:600}
.dx-sb-pop input{width:100%;box-sizing:border-box;height:32px;margin-bottom:10px;padding:0 8px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:9px;font:inherit;color:inherit;background:var(--dx-ui-bg,#fff)}
.dx-sb-pop input[readonly]{background:var(--dx-ui-bar,#fbfaf8);color:var(--dx-ui-muted,#5f5d58)}
.dx-sb-pop input:focus{outline:2px solid var(--dx-ui-accent,#0b57d0);outline-offset:-1px}
.dx-sb-row{display:flex;gap:6px}
.dx-sb-row input{flex:1;min-width:0}
.dx-sb-pop button{height:32px;padding:0 12px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:9px;background:var(--dx-ui-bg,#fff);color:inherit;font:inherit;white-space:nowrap;cursor:pointer}
.dx-sb-pop button:hover{background:var(--dx-ui-hover,#f3f1ec)}
.dx-sb-pop button.dx-sb-main{border-color:var(--dx-ui-accent,#0b57d0);background:var(--dx-ui-accent,#0b57d0);color:var(--dx-ui-on-accent,#fff)}
.dx-sb-pop button.dx-sb-main:hover{background:var(--dx-ui-accent-hover,#08398a)}
.dx-sb-people{margin:0 0 10px;padding:0;list-style:none}
.dx-sb-people li{display:flex;align-items:center;gap:8px;padding:3px 0}
.dx-sb-people .dx-sb-dot{margin:0;border-color:var(--dx-ui-bg,#fff)}
.dx-sb-none{color:var(--dx-ui-muted,#5f5d58)}
@keyframes dx-sb-pulse{50%{opacity:.3}}
@media (pointer:coarse){
.dx-sb{min-height:40px}
.dx-sb-btn{height:34px;min-width:36px}
.dx-sb-pop{max-width:calc(100vw - 16px);box-sizing:border-box}
.dx-sb-pop button,.dx-sb-pop input{height:38px}
}
.dx-sb>:not(.dx-sb-space){flex:none}
.dx-sb [hidden],.dx-sb [data-fit=off]{display:none!important}
`;

const svg = (body: string) =>
  `<svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const ICONS = {
  flow: svg('<path d="M3 4.5h12M3 7.5h12M3 10.5h12M3 13.5h7"/>'),
  column: svg('<rect x="5" y="2.5" width="8" height="13" rx="1"/><path d="M7.5 6h3M7.5 9h3M7.5 12h3"/>'),
  spread: svg('<rect x="2" y="3.5" width="6.2" height="11" rx="1"/><rect x="9.8" y="3.5" width="6.2" height="11" rx="1"/>'),
  grid: svg('<rect x="2.5" y="2.5" width="5.2" height="5.2" rx=".8"/><rect x="10.3" y="2.5" width="5.2" height="5.2" rx=".8"/><rect x="2.5" y="10.3" width="5.2" height="5.2" rx=".8"/><rect x="10.3" y="10.3" width="5.2" height="5.2" rx=".8"/>'),
  width: svg('<rect x="4.5" y="2.5" width="9" height="13" rx="1"/><path d="M6.5 9h5M8 7.4 6.5 9 8 10.6M10 7.4 11.5 9 10 10.6"/>'),
  page: svg('<rect x="4.5" y="2.5" width="9" height="13" rx="1"/><path d="M9 5.5v7M7.4 7 9 5.5 10.6 7M7.4 11 9 12.5 10.6 11"/>'),
  notes: svg('<rect x="2.5" y="2.5" width="8" height="13" rx="1"/><path d="M12.5 4.5h3M12.5 8h3M12.5 11.5h3"/>'),
  minus: svg('<path d="M5 9h8"/>'),
  plus: svg('<path d="M5 9h8M9 5v8"/>'),
  focus: svg('<path d="M3 6.5V3h3.5M11.5 3H15v3.5M15 11.5V15h-3.5M6.5 15H3v-3.5"/>'),
};

/** Its numbers are written as the language of the bar writes them, whatever the browser is set to. */
const number = (n: number) => n.toLocaleString(getLocale(), { useGrouping: 'always' } as unknown as Intl.NumberFormatOptions);
const count = (n: number, key: 'status.words' | 'status.chars') => `${number(n)} ${plural(key, n)}`;
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
/** Characters as a person counts them: spaces are, the ends of paragraphs and the marks of objects are not. */
const characters = (text: string) => text.replace(/[\n\r\f￼]/g, '').length;

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function createStatusBar(container: HTMLElement, editor: Editor, options: StatusBarOptions = {}): StatusBar {
  injectStyle();
  const bar = document.createElement('div');
  bar.className = 'dx-sb';
  // A region, not a live one: the count of words would be read out at every letter typed.
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', t('a11y.statusBar'));
  markRegion(bar, 'status', () => bar.querySelector<HTMLElement>('button, select, input'));
  installRegionKeys();
  const updates: (() => void)[] = [];

  const info = (name: string, text: () => string) => {
    const node = document.createElement('span');
    node.className = `dx-sb-info dx-sb-${name}`;
    node.dataset.name = name;
    updates.push(() => {
      const next = text();
      if (node.textContent !== next) node.textContent = next;
    });
    return node;
  };

  const button = (name: string, label: string, html: string, onClick: () => void, state?: () => { on?: boolean; disabled?: boolean }) => {
    const node = document.createElement('button');
    node.className = 'dx-sb-btn';
    node.type = 'button';
    node.innerHTML = html;
    node.title = label;
    node.dataset.name = name;
    node.setAttribute('aria-label', label);
    node.addEventListener('click', () => {
      onClick();
      editor.focus();
    });
    if (state) {
      updates.push(() => {
        const { on = false, disabled = false } = state();
        node.classList.toggle('dx-on', on);
        node.setAttribute('aria-pressed', String(on));
        node.disabled = disabled;
      });
    }
    return node;
  };

  const sep = () => {
    const node = document.createElement('span');
    node.className = 'dx-sb-sep';
    return node;
  };

  // --- The document -------------------------------------------------------------

  // Counting the whole document on every move of the caret would be wasted work.
  let counted: { doc: Doc; words: number; characters: number } | undefined;
  const totals = () => {
    if (counted?.doc !== editor.doc) {
      const text = docText(editor.doc);
      counted = { doc: editor.doc, words: words(text), characters: characters(text) };
    }
    return counted;
  };
  const selected = () => (editor.collapsed ? undefined : editor.selectedText);

  bar.append(
    // In the header or the footer, the page is the one whose header shows the caret.
    info('page', () => {
      const section = editor.sectionCount > 1 ? `${t('area.section', { n: editor.sectionIndex + 1 })} · ` : '';
      return `${section}${areaPrefix(editor.area)}${t('status.page', { page: editor.currentPage, pages: editor.pageCount })}`;
    }),
    // With text selected, how much of the document it is.
    info('words', () => {
      const text = selected();
      const total = count(totals().words, 'status.words');
      return text === undefined ? total : t('status.of', { n: number(words(text)), total });
    }),
    info('chars', () => {
      const text = selected();
      const total = count(totals().characters, 'status.chars');
      return text === undefined ? total : t('status.of', { n: number(characters(text)), total });
    }),
  );

  // The language the text is in: for spelling in Word, for the voice of a screen reader, for dates and numbers.
  const language = document.createElement('select');
  language.className = 'dx-sb-lang';
  language.dataset.name = 'language';
  let offered = '';
  updates.push(() => {
    const now = withRegion(editor.textLanguage);
    const key = `${getLocale()}|${now}`;
    if (key !== offered) {
      offered = key;
      // Each named in the language of the interface; the one the document has, though it is not among them.
      const names = new Intl.DisplayNames([getLocale()], { type: 'language' });
      const tags = TEXT_LANGUAGES.includes(now) ? TEXT_LANGUAGES : [now, ...TEXT_LANGUAGES];
      language.replaceChildren(...tags.map((tag) => new Option(names.of(tag) ?? tag, tag)));
      language.title = t('status.language');
      language.setAttribute('aria-label', t('status.language'));
    }
    if (document.activeElement !== language) language.value = now;
  });
  language.addEventListener('change', () => {
    editor.setTextLanguage(language.value);
    editor.focus();
  });
  bar.append(sep(), language);

  const space = document.createElement('span');
  space.className = 'dx-sb-space';
  bar.appendChild(space);

  // --- The view -----------------------------------------------------------------

  /** The pages as they were set out before the text was set to the window. */
  let pagesView: ViewMode = 'column';
  const setView = (view: ViewMode) => () => {
    const from = editor.view;
    if (view === 'flow' && from === 'flow') {
      // Pressed again, it goes back to the pages: in a narrow window it is the only button of the views left.
      editor.setView(pagesView);
      // A page wider than the window is shown whole across it, to begin with.
      if (editor.pageBounds().width > editor.element.clientWidth) editor.setFit('width');
      return;
    }
    if (view === 'flow') pagesView = from;
    editor.setView(view);
    // The grid is for seeing many pages at once; coming back from it, for reading again.
    if (view === 'grid' && from !== 'grid') editor.setZoom(GRID_ZOOM);
    else if (view !== 'grid' && from === 'grid') editor.setZoom(1);
  };
  const views: [ViewMode, string][] = [
    ['flow', t('view.flow')],
    ['column', t('view.column')],
    ['spread', t('view.spread')],
    ['grid', t('view.grid')],
  ];
  const fits: [ZoomFit, string][] = [
    ['width', t('view.fitWidth')],
    ['page', t('view.fitPage')],
  ];
  if (options.assistant) {
    // Letting an assistant in is for the person to do, and to see: the dot says whether one can reach the document.
    const { state, toggle } = options.assistant;
    const ai = button('assistant', '', t('assistant.word'), toggle, () => ({ on: state() === 'on' }));
    ai.classList.add('dx-sb-ai');
    updates.push(() => {
      const now = state();
      const label = t(now === 'on' ? 'assistant.on' : now === 'connecting' ? 'assistant.connecting' : 'assistant.off');
      ai.dataset.state = now;
      ai.title = label;
      ai.setAttribute('aria-label', label);
    });
    bar.append(ai, sep());
  }
  let closePop = () => {};
  let showCollab = () => {};
  if (options.collab) {
    const collab = options.collab;
    let pop: HTMLElement | undefined;
    const initial = (name: string) => (name.trim()[0] ?? '?');
    const dot = (name: string, color: string) => {
      const node = document.createElement('span');
      node.className = 'dx-sb-dot';
      node.style.background = `#${color || '80868b'}`;
      node.style.color = inkOn(color || '80868b');
      node.textContent = initial(name);
      node.title = name;
      return node;
    };
    const fill = () => {
      if (!pop) return;
      const people = pop.querySelector('.dx-sb-people')!;
      const others = collab.peers();
      people.replaceChildren(
        ...[{ name: `${collab.name() || t('collab.someone')} (${t('collab.you')})`, color: collab.color() }, ...others.map((p) => ({ name: p.name || t('collab.someone'), color: p.color }))].map((person) => {
          const item = document.createElement('li');
          const label = document.createElement('span');
          label.textContent = person.name;
          item.append(dot(person.name, person.color), label);
          return item;
        }),
      );
      if (!others.length) {
        const none = document.createElement('li');
        none.className = 'dx-sb-none';
        none.textContent = t('collab.alone');
        people.appendChild(none);
      }
      const link = pop.querySelector<HTMLInputElement>('[data-name=link]');
      if (link && link.value !== (collab.link?.() ?? '')) link.value = collab.link?.() ?? '';
    };
    const outside = (e: MouseEvent) => {
      if (pop && !pop.contains(e.target as Node) && e.target !== share && !share.contains(e.target as Node)) closePop();
    };
    closePop = () => {
      pop?.remove();
      pop = undefined;
      document.removeEventListener('mousedown', outside, true);
    };
    const openPop = () => {
      closePop();
      pop = document.createElement('div');
      pop.className = 'dx-sb-pop';
      pop.dataset.name = 'collab-pop';
      const field = (label: string, input: HTMLInputElement) => {
        const node = document.createElement('label');
        node.textContent = label;
        return [node, input];
      };
      const name = document.createElement('input');
      name.dataset.name = 'name';
      name.value = collab.name();
      name.maxLength = 60;
      name.readOnly = !collab.rename;
      name.addEventListener('change', () => collab.rename?.(name.value));
      name.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') name.blur();
        e.stopPropagation();
      });
      const link = document.createElement('input');
      link.dataset.name = 'link';
      link.readOnly = true;
      link.addEventListener('focus', () => link.select());
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'dx-sb-main';
      copy.dataset.name = 'copy';
      copy.textContent = t('collab.copy');
      copy.addEventListener('click', () => {
        link.select();
        void navigator.clipboard?.writeText(link.value).catch(() => document.execCommand('copy'));
        copy.textContent = t('collab.copied');
        setTimeout(() => (copy.textContent = t('collab.copy')), 1500);
      });
      const row = document.createElement('div');
      row.className = 'dx-sb-row';
      row.append(link, copy);
      const linkLabel = document.createElement('label');
      linkLabel.textContent = t('collab.link');
      const peopleLabel = document.createElement('label');
      peopleLabel.textContent = t('collab.people');
      const people = document.createElement('ul');
      people.className = 'dx-sb-people';
      const leave = document.createElement('button');
      leave.type = 'button';
      leave.dataset.name = 'leave';
      leave.textContent = t('collab.leave');
      leave.addEventListener('click', () => {
        closePop();
        collab.leave?.();
        editor.focus();
      });
      pop.append(...field(t('collab.name'), name));
      if (collab.link) pop.append(linkLabel, row, document.createElement('br'));
      pop.append(peopleLabel, people);
      if (collab.leave) pop.append(leave);
      else people.style.marginBottom = '0';
      link.style.marginBottom = '0';
      applyTheme(pop, editor.theme);
      document.body.appendChild(pop);
      const at = share.getBoundingClientRect();
      pop.style.left = `${Math.max(8, Math.min(at.left, window.innerWidth - 316))}px`;
      pop.style.bottom = `${window.innerHeight - at.top + 6}px`;
      fill();
      document.addEventListener('mousedown', outside, true);
    };
    showCollab = openPop;
    const share = document.createElement('button');
    share.className = 'dx-sb-btn dx-sb-ai';
    share.type = 'button';
    share.dataset.name = 'collab';
    share.textContent = t('collab.word');
    share.addEventListener('click', () => {
      if (collab.state() === 'off') collab.start?.();
      else if (pop) closePop();
      else openPop();
    });
    const who = document.createElement('span');
    who.className = 'dx-sb-who';
    let shown = '';
    updates.push(() => {
      const now = collab.state();
      const label = t(now === 'on' ? 'collab.on' : now === 'connecting' ? 'collab.connecting' : now === 'offline' ? 'collab.offline' : 'collab.off');
      share.dataset.state = now;
      share.title = label;
      share.setAttribute('aria-label', label);
      share.classList.toggle('dx-on', now === 'on');
      share.hidden = now === 'off' && !collab.start;
      const others = now === 'off' ? [] : collab.peers();
      const key = JSON.stringify(others);
      if (key !== shown) {
        shown = key;
        who.replaceChildren(...others.slice(0, 5).map((p) => dot(p.name || t('collab.someone'), p.color)));
      }
      if (now === 'off') closePop();
      else fill();
    });
    bar.append(share, who, sep());
  }
  bar.append(
    ...views.map(([view, label]) => button(view, label, ICONS[view], setView(view), () => ({ on: editor.view === view }))),
    // The notes beside the pages, as Word shows its comments; a grid of pages has no room for them.
    button('notes', t('view.notes'), ICONS.notes, () => editor.setShowNotes(!editor.showNotes), () => ({ on: editor.showNotes, disabled: editor.view === 'grid' || editor.view === 'flow' })),
    sep(),
    ...fits.map(([fit, label]) =>
      button(`fit-${fit}`, label, ICONS[fit], () => editor.setFit(fit), () => ({ on: editor.fit === fit, disabled: editor.view === 'grid' || editor.view === 'flow' })),
    ),
    sep(),
  );

  // --- The zoom -----------------------------------------------------------------

  const percent = () => Math.round(editor.zoom * 100);
  /** The next multiple of the step below or above the zoom. */
  const stepZoom = (dir: -1 | 1) => () => {
    const next = dir < 0 ? Math.ceil(percent() / ZOOM_STEP) - 1 : Math.floor(percent() / ZOOM_STEP) + 1;
    editor.setZoom((next * ZOOM_STEP) / 100);
  };
  const range = document.createElement('input');
  range.className = 'dx-sb-range';
  range.type = 'range';
  range.min = String(SLIDER_MIN);
  range.max = String(SLIDER_MAX);
  range.step = '5';
  range.title = 'Zoom';
  range.dataset.name = 'zoom';
  range.setAttribute('aria-label', 'Zoom');
  range.addEventListener('input', () => editor.setZoom(Number(range.value) / 100));
  range.addEventListener('change', () => editor.focus());
  updates.push(() => {
    // While it is being dragged the slider is the one that knows where it is.
    if (document.activeElement !== range) range.value = String(percent());
  });

  const reset = button('zoom-reset', t('zoom.reset'), '', () => editor.setZoom(1));
  reset.classList.add('dx-sb-percent');
  updates.push(() => (reset.textContent = `${percent()} %`));

  bar.append(
    button('zoom-out', t('zoom.out'), ICONS.minus, stepZoom(-1), () => ({ disabled: editor.zoom <= MIN_ZOOM })),
    range,
    button('zoom-in', t('zoom.in'), ICONS.plus, stepZoom(1), () => ({ disabled: editor.zoom >= MAX_ZOOM })),
    reset,
  );
  if (options.focus) {
    const { on, toggle } = options.focus;
    bar.append(sep(), button('focus', t('focus.enter', { keys: IS_MAC ? '⌘⇧.' : 'Ctrl+Shift+.' }), ICONS.focus, toggle, () => ({ on: on() })));
  }

  // Clicks on the bar must not take the keyboard away from the document; the slider needs it to be dragged.
  bar.addEventListener('mousedown', (e) => {
    // Except on what needs the mouse to work: the zoom slider, and the list of languages, which would not open.
    if (e.target !== range && e.target !== language) e.preventDefault();
  });

  // In less room than it needs, what matters least goes first: the slider, the counts, the ways to fit the page,
  // the views. Where the caret is, who is on the document and the zoom stay.
  const DROP = [['zoom'], ['chars'], ['fit-width', 'fit-page'], ['words'], ['language'], ['notes'], ['column', 'spread', 'grid'], ['zoom-out', 'zoom-in']];
  const named = (name: string) => bar.querySelector<HTMLElement>(`[data-name="${name}"]`);
  /** A line between two groups has no business where one of them is gone. */
  const tidy = () => {
    let last: Element | undefined;
    for (const node of bar.children) {
      const line = node.classList.contains('dx-sb-sep');
      const shown = node instanceof HTMLElement && !node.hidden && node.dataset.fit !== 'off' && !line && node.getBoundingClientRect().width > 0;
      if (line) (node as HTMLElement).dataset.fit = !last || last.classList.contains('dx-sb-sep') || last.classList.contains('dx-sb-space') ? 'off' : '';
      if (line ? (node as HTMLElement).dataset.fit !== 'off' : shown || node.classList.contains('dx-sb-space')) last = node;
    }
    if (last?.classList.contains('dx-sb-sep')) (last as HTMLElement).dataset.fit = 'off';
  };
  let fitted = 0;
  const fit = () => {
    for (const names of DROP) for (const name of names) named(name)?.removeAttribute('data-fit');
    tidy();
    for (const names of DROP) {
      if (bar.scrollWidth <= bar.clientWidth) break;
      for (const name of names) named(name)?.setAttribute('data-fit', 'off');
      tidy();
    }
    fitted = bar.clientWidth;
  };
  const resize = new ResizeObserver(() => bar.clientWidth !== fitted && fit());
  resize.observe(bar);

  const refresh = () => {
    for (const update of updates) update();
    // A longer count, or one more person on the document, may be what no longer fits.
    if (bar.scrollWidth > bar.clientWidth) fit();
  };
  // In chips, or floating: each group between two lines a part of its own.
  if (options.layout && options.layout !== 'bar') {
    bar.classList.add(`dx-sb-${options.layout}`);
    let part: HTMLElement | undefined;
    for (const node of [...bar.children]) {
      if (node.classList.contains('dx-sb-sep')) {
        node.remove();
        part = undefined;
      } else if (node.classList.contains('dx-sb-space')) part = undefined;
      else {
        if (!part) {
          part = document.createElement('div');
          part.className = 'dx-sb-part';
          bar.insertBefore(part, node);
        }
        part.appendChild(node);
      }
    }
  }
  const unsubscribe = editor.onChange(refresh);
  container.appendChild(bar);
  refresh();
  fit();

  return {
    refresh,
    showCollab: () => showCollab(),
    destroy() {
      unsubscribe();
      resize.disconnect();
      closePop();
      bar.remove();
    },
  };
}
