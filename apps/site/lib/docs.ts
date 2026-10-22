// The pages of the documentation: Markdown files in `content/docs`, turned
// into HTML when the site is built. Nothing of this runs in the browser.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import { type Highlighter, createHighlighter } from 'shiki';

const THEME = 'github-dark-dimmed';
/** The landing page shows its code on white. */
export const LIGHT_THEME = 'github-light';
const LANGS = ['ts', 'tsx', 'js', 'json', 'bash', 'html', 'css'];

let highlighter: Promise<Highlighter> | undefined;
const shiki = () => (highlighter ??= createHighlighter({ themes: [THEME, LIGHT_THEME], langs: LANGS }));

/** Colours of the light theme too pale on the background of the code blocks, each with one that reads at 4.5:1 or more. */
const DARKER: Record<string, string> = { '#6A737D': '#57606A', '#D73A49': '#CF222E', '#E36209': '#A04100', '#22863A': '#1A7F37' };
/** And the one of the dark theme: the grey of its comments. */
const LIGHTER: Record<string, string> = { '#768390': '#909DAA' };
/** The language of the code said on its block, for the Markdown made for language models (scripts/llms.ts). */
const tagged = (html: string, lang: string) => html.replace('<pre ', `<pre data-lang="${lang}" `);
const readable = (html: string, theme: string) =>
  theme === LIGHT_THEME ? html.replace(/#(6A737D|D73A49|E36209|22863A)\b/gi, (hex) => DARKER[hex.toUpperCase()]) : html.replace(/#768390\b/gi, (hex) => LIGHTER[hex.toUpperCase()]);

/** Code as HTML, coloured; as plain text when its language is not one of the few the site writes in. */
export async function highlight(code: string, lang: string, theme = THEME): Promise<string> {
  const lit = await shiki();
  return tagged(readable(lit.codeToHtml(code.replace(/\n$/, ''), { lang: LANGS.includes(lang) ? lang : 'text', theme }), theme), lang);
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

const sourceOf = (slug: string) => readFileSync(path.join(process.cwd(), 'content/docs', `${slug}.md`), 'utf8');
const headingsOf = (body: string) => [...body.matchAll(/^## (.+)$/gm)].map((match) => ({ id: slugify(match[1]), text: match[1].replace(/`/g, '') }));

/** The sections of a page, without making its HTML: what the search box finds. */
export function outlineOf(slug: string): { id: string; text: string }[] {
  return headingsOf(sourceOf(slug));
}

async function renderer(theme = THEME): Promise<InstanceType<typeof MarkdownIt>> {
  const lit = await shiki();
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    highlight: (code, lang) => tagged(readable(lit.codeToHtml(code.replace(/\n$/, ''), { lang: LANGS.includes(lang) ? lang : 'text', theme }), theme), lang),
  }).use(anchor, { slugify, level: [2, 3], permalink: anchor.permalink.headerLink() });
  // A table wider than a phone scrolls by itself, and not the page with it.
  md.renderer.rules.table_open = () => '<div class="table"><table>';
  md.renderer.rules.table_close = () => '</table></div>';
  return md;
}

/**
 * A part of a page written in React that is better as Markdown — long
 * reference, tables — from `content/parts/<name>.md`, as HTML in the styles
 * of the Markdown pages, its code on white as the React pages have it.
 */
export async function loadPart(name: string): Promise<string> {
  const md = await renderer(LIGHT_THEME);
  return md.render(readFileSync(path.join(process.cwd(), 'content/parts', `${name}.md`), 'utf8'));
}

export async function loadDoc(slug: string): Promise<DocPage> {
  const source = sourceOf(slug);
  const md = await renderer();

  const title = /^# (.+)$/m.exec(source)?.[1] ?? slug;
  const body = source.replace(/^# .+\n+/, '');
  // What the page is about: its first paragraph, as plain text.
  const description = (body.split(/\n\s*\n/)[0] ?? '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim();
  return { title, description, html: md.render(body), headings: headingsOf(body) };
}
