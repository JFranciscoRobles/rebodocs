// The documentation for language models, made from the site once it is built:
// /llms.txt, the list of the pages with what each one is about; a Markdown file
// beside each page (/docs/react.md); and /llms-full.txt, all of them in one.
// Read from the pages as built, so what a model reads is what a person reads:
// the demos, which only run in a browser, are left out, and so is what is only
// there to be clicked.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseHTML } from 'linkedom';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { NAV, SITE, hrefOf, markdownOf } from '../lib/site';

const OUT = join(import.meta.dirname, '../out');

/** What is on a page only to be looked at or clicked: gone before it is turned into Markdown. */
const NOISE = [
  'script',
  'style',
  'template',
  'svg',
  'button',
  'nav',
  'footer',
  'iframe',
  'canvas',
  'select',
  'input',
  'textarea',
  '[aria-hidden="true"]',
  '[role="tablist"]',
  // The notes in handwriting.
  '.font-hand',
];

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
turndown.use(gfm);
// The code as highlighted: one span per line, inside a pre. Fenced, in the language it says it is.
turndown.addRule('code', {
  filter: (node) => node.nodeName === 'PRE',
  replacement: (_content, node) => {
    const pre = node as HTMLElement;
    const lang = pre.closest('[data-lang]')?.getAttribute('data-lang') ?? pre.querySelector('code')?.className.match(/language-(\w+)/)?.[1] ?? '';
    const text = (pre.textContent ?? '').replace(/\n+$/, '');
    return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
  },
});

// A list of names, each with what it is: the props, the features, the members. One line each, the name first,
// then what is short about it (its type, on or off), then what is said of it.
/**
 * Turns each list of names, each with what it is (the props, the features, the members), into a list of
 * one line each: the name first, then what is short about it (its type, on or off), then what is said of it.
 */
function flattenDefinitions(main: Element): void {
  for (const dl of [...main.querySelectorAll('dl')]) {
    const rows = [...dl.children].map((row) => (row.nodeName === 'DIV' ? [...row.children] : [row]));
    // A dl without rows of its own: each dt with the dd after it.
    const items = rows.every((row) => row.length === 1) ? pairs(rows.flat()) : rows;
    const list = dl.ownerDocument.createElement('ul');
    list.innerHTML = items.map(line).filter(Boolean).join('');
    dl.replaceWith(list);
  }
}
function pairs(nodes: Element[]): Element[][] {
  const out: Element[][] = [];
  for (const node of nodes) node.nodeName === 'DT' || !out.length ? out.push([node]) : out[out.length - 1].push(node);
  return out;
}
const text = (node: Element) => node.textContent?.trim() ?? '';
const isShort = (node: Element) => /\bfont-code\b/.test(node.className) && text(node).length < 60;
const code = (words: string) => `<code>${words.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code>`;
function line(row: Element[]): string {
  const dt = row.find((node) => node.nodeName === 'DT');
  if (!dt) return '';
  const [name, ...about] = (dt.children.length > 1 ? [...dt.children].map(text) : [text(dt)]).filter(Boolean);
  const dds = row.filter((node) => node.nodeName === 'DD');
  about.push(...dds.filter(isShort).map(text));
  // The pills inside what is said of it are words of it: in italics, before the rest.
  const said = dds
    .filter((dd) => !isShort(dd))
    .map((dd) => {
      for (const pill of [...dd.querySelectorAll('span.rounded-full')]) pill.outerHTML = `<em>${text(pill)}.</em> `;
      return dd.innerHTML;
    })
    .join(' ');
  return `<li>${code(name)}${about.length ? ` (${about.map(code).join(', ')})` : ''}${said ? `: ${said}` : ''}</li>`;
}

// One space after the dash, as Markdown is written by hand.
turndown.addRule('listItem', {
  filter: 'li',
  replacement: (content, node) => {
    const parent = node.parentNode as HTMLElement;
    const marker = parent.nodeName === 'OL' ? `${Array.prototype.indexOf.call(parent.children, node) + 1}. ` : '- ';
    const body = content
      .replace(/^\n+/, '')
      .replace(/\n+$/, '\n')
      .replace(/\n/gm, `\n${' '.repeat(marker.length)}`);
    return marker + body + (node.nextSibling && !/\n$/.test(body) ? '\n' : '');
  },
});

/** A bar inside a cell, kept apart from the ones that make the table until it is Markdown, and written then as \\|. */
const BAR = '\uE000';
const barsIn = (node: Element) => {
  const walker = node.ownerDocument.createTreeWalker(node, 4);
  for (let at = walker.nextNode(); at; at = walker.nextNode()) at.textContent = (at.textContent ?? '').replaceAll('|', BAR);
};

const INLINE = new Set(['SPAN', 'A', 'CODE', 'STRONG', 'EM', 'B', 'I', 'SMALL', 'KBD', 'LABEL']);
const LAYOUT = /(^|\s)(flex|inline-flex|grid|block|inline-block)(\s|$)/;

/** Tables made of elements with roles, as the reference draws them: real tables, which Markdown has. */
function realTables(main: Element): void {
  for (const grid of [...main.querySelectorAll('[role="table"]')]) {
    const rows = [...grid.querySelectorAll('[role="row"]')].map((row) => [...row.querySelectorAll('[role="cell"],[role="columnheader"],[role="rowheader"]')]);
    if (!rows.length) continue;
    const cell = (node: Element, tag: string) => {
      for (const pill of [...node.querySelectorAll('span.rounded-full')]) pill.outerHTML = ` <em>${text(pill)}</em>`;
      return `<${tag}>${node.innerHTML}</${tag}>`;
    };
    const [head, ...body] = rows;
    const table = grid.ownerDocument.createElement('table');
    table.innerHTML = `<thead><tr>${head.map((one) => cell(one, 'th')).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((one) => cell(one, 'td')).join('')}</tr>`).join('')}</tbody>`;
    grid.replaceWith(table);
  }
}

/** What the page lays out side by side or one under another with CSS, which as text would run together. */
function separate(main: Element): void {
  // A drawing made of boxes says what it shows in its label: that, in its place.
  for (const drawing of [...main.querySelectorAll('[role="img"]')]) {
    const label = drawing.getAttribute('aria-label');
    if (label) drawing.outerHTML = `<p>${label}</p>`;
    else drawing.remove();
  }
  for (const box of [...main.querySelectorAll('*')]) {
    const kids = [...box.children].filter((kid) => text(kid));
    const loose = [...box.childNodes].some((node) => node.nodeType === 3 && node.textContent?.trim());
    if (kids.length < 2 || loose || !kids.every((kid) => INLINE.has(kid.nodeName))) continue;
    // Pieces in a row or a column: a dot between them, as words of one line.
    const laidOut = LAYOUT.test(box.className) || kids.some((kid) => LAYOUT.test(kid.className));
    if (laidOut) for (const kid of kids.slice(0, -1)) kid.after(' · ');
  }
  // A word set on a line of its own, before what it is about: a label, as "Before".
  for (const piece of [...main.querySelectorAll('*')]) {
    if (!LAYOUT.test(piece.className) || !text(piece)) continue;
    const next = piece.nextSibling;
    const runsOn = next && (next.nodeType === 3 ? /^\S/.test(next.textContent ?? '') : next.nodeType === 1 && text(next as Element) && !/^(DIV|P|UL|OL|PRE|TABLE|H\d|SECTION|DL)$/.test(next.nodeName));
    if (runsOn && INLINE.has(piece.nodeName) === INLINE.has((next as Element).nodeName ?? 'SPAN')) piece.after(INLINE.has(piece.nodeName) ? ' · ' : ' ');
  }
}

interface Page {
  title: string;
  slug: string;
  group: string;
  description: string;
  markdown: string;
}

function read(slug: string, title: string, group: string): Page {
  const html = readFileSync(join(OUT, hrefOf(slug), 'index.html'), 'utf8');
  const { document } = parseHTML(html);
  const description = document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';
  const main = document.querySelector('main');
  if (!main) throw new Error(`${slug}: no <main> in the page as built`);
  // The fields of a demo, with the words over them: they are there to be typed in.
  for (const field of [...main.querySelectorAll('input,textarea,select')]) (field.closest('label') ?? field).remove();
  for (const node of main.querySelectorAll(NOISE.join(','))) node.remove();
  // The pills over the headings, that say what kind of section it is.
  for (const pill of main.querySelectorAll('span.rounded-full')) if (/^H[1-4]$/.test(pill.nextElementSibling?.nodeName ?? '')) pill.remove();
  // A heading that links to itself, as the Markdown pages make them: the heading alone.
  for (const link of [...main.querySelectorAll('h2 > a[href^="#"], h3 > a[href^="#"]')]) link.replaceWith(...link.childNodes);
  realTables(main);
  for (const table of [...main.querySelectorAll('table')]) barsIn(table);
  separate(main);
  flattenDefinitions(main);
  // The line above the title, with the group of the page: it is said once, in the list.
  main.querySelector(':scope > p')?.remove();
  // Where a demo would be: the line that says it is opening.
  for (const node of main.querySelectorAll('p')) if (/^(Opening|Loading|Starting) [^.]*…$/.test(node.textContent?.trim() ?? '')) node.remove();
  // Links to the site's own pages: whole addresses, a model reads them away from it.
  for (const link of main.querySelectorAll('a[href^="/"]')) link.setAttribute('href', SITE + link.getAttribute('href'));
  const markdown = turndown
    .turndown(main.innerHTML)
    .replaceAll(BAR, '\\|')
    .replace(/^[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { title, slug, group, description, markdown };
}

const pages = NAV.flatMap((group) => group.items.map((item) => read(item.slug, item.title, group.title)));

for (const page of pages) writeFileSync(join(OUT, markdownOf(page.slug)), `${page.markdown}\n`);

const intro = [
  '# Rebodocs',
  '',
  '> A word processor for the browser, compatible with Word files: open, edit and save .docx with tracked changes, versions, real-time collaboration, templates with variables and PDF export, in packages taken one at a time (@rebodocs/core, @rebodocs/editor, @rebodocs/react, @rebodocs/collab, @rebodocs/mcp). MIT.',
  '',
  'Each page below is also a Markdown file, at the address given. All of them together, in one file: ' + `${SITE}/llms-full.txt`,
];
const list = NAV.flatMap((group) => [
  '',
  `## ${group.title}`,
  '',
  ...pages.filter((page) => page.group === group.title).map((page) => `- [${page.title}](${SITE}${markdownOf(page.slug)}): ${page.description}`),
]);
writeFileSync(join(OUT, 'llms.txt'), `${[...intro, ...list].join('\n')}\n`);

const full = pages.map((page) => `<!-- ${SITE}${hrefOf(page.slug)} -->\n\n${page.markdown}`);
writeFileSync(join(OUT, 'llms-full.txt'), `${[intro.slice(0, 3).join('\n'), ...full].join('\n\n---\n\n')}\n`);

console.log(`llms.txt, llms-full.txt and ${pages.length} Markdown pages in out/`);
