// The pages of the documentation: Markdown files in `content/docs`, turned
// into HTML when the site is built. Nothing of this runs in the browser.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import { type Highlighter, createHighlighter } from 'shiki';

const THEME = 'github-dark-dimmed';
const LANGS = ['ts', 'tsx', 'js', 'json', 'bash', 'html', 'css'];

let highlighter: Promise<Highlighter> | undefined;
const shiki = () => (highlighter ??= createHighlighter({ themes: [THEME], langs: LANGS }));

/** Code as HTML, coloured; as plain text when its language is not one of the few the site writes in. */
export async function highlight(code: string, lang: string): Promise<string> {
  const lit = await shiki();
  return lit.codeToHtml(code.replace(/\n$/, ''), { lang: LANGS.includes(lang) ? lang : 'text', theme: THEME });
}

export interface DocPage {
  title: string;
  description: string;
  html: string;
  /** Its sections, for the list beside it. */
  headings: { id: string; text: string }[];
}

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[`@]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export async function loadDoc(slug: string): Promise<DocPage> {
  const source = readFileSync(path.join(process.cwd(), 'content/docs', `${slug}.md`), 'utf8');
  const lit = await shiki();
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    highlight: (code, lang) => lit.codeToHtml(code.replace(/\n$/, ''), { lang: LANGS.includes(lang) ? lang : 'text', theme: THEME }),
  }).use(anchor, { slugify, level: [2, 3], permalink: anchor.permalink.headerLink() });
  // A table wider than a phone scrolls by itself, and not the page with it.
  md.renderer.rules.table_open = () => '<div class="table"><table>';
  md.renderer.rules.table_close = () => '</table></div>';

  const title = /^# (.+)$/m.exec(source)?.[1] ?? slug;
  const body = source.replace(/^# .+\n+/, '');
  // What the page is about: its first paragraph, as plain text.
  const description = (body.split(/\n\s*\n/)[0] ?? '').replace(/[`*_\[\]]/g, '').replace(/\(([^)]*)\)/g, '').replace(/\s+/g, ' ').trim();
  const headings = [...body.matchAll(/^## (.+)$/gm)].map((match) => ({ id: slugify(match[1]), text: match[1].replace(/`/g, '') }));
  return { title, description, html: md.render(body), headings };
}
