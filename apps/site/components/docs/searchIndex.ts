// What ⌘K finds: every page, its sections, and the props, components, hooks and functions
// of the reference, and the members of the Editor. Made when the site is built; the browser only filters it.

import { outlineOf } from '@/lib/docs';
import { type Locale, localize, translator } from '@/lib/i18n';
import { PAGES, groupOf, hrefOf } from '@/lib/site';
import { FILE_TOOLS } from './assistants/data';
import { toolDocs } from './assistants/tools';
import { MEMBER_NAMES } from './editor-api/data';
import { say } from './editor-api/texts';
import { HOOKS, hookHash } from './hooks/hooks';
import { PACKAGE_DOCS, short } from './packages/data';
import { CUSTOM } from './pages';
import { COMPONENTS, LANG_FNS, PROPS, VERSION_FNS } from './reference';

export interface SearchEntry {
  kind: 'Page' | 'Section' | 'Package' | 'Component' | 'Prop' | 'Hook' | 'Function' | 'Member' | 'Tool';
  title: string;
  /** The page it is on, what it is about, or, for a page, the group of the menu it is in. */
  detail: string;
  href: string;
}

/** What ⌘K finds on the pages of a language: their titles and sections in it, and the addresses of its pages. */
export function searchIndex(locale: Locale): SearchEntry[] {
  const t = translator(locale);
  const entries: SearchEntry[] = [];
  for (const page of PAGES) {
    const href = hrefOf(page.slug);
    const group = groupOf(page.slug);
    entries.push({ kind: 'Page', title: t(page.title), detail: group ? t(group.title) : '', href });
    const custom = CUSTOM[page.slug];
    const headings = custom ? custom.headings.map((heading) => ({ id: heading.id, text: t(heading.text) })) : outlineOf(page.slug, locale);
    for (const heading of headings) entries.push({ kind: 'Section', title: heading.text, detail: t(page.title), href: `${href}#${heading.id}` });
  }
  for (const pkg of PACKAGE_DOCS) {
    const href = `${hrefOf('packages')}#package-${short(pkg.name)}`;
    entries.push({ kind: 'Package', title: pkg.name, detail: t(pkg.what), href });
    for (const [path, what] of pkg.entries ?? []) if (path !== pkg.name) entries.push({ kind: 'Package', title: path, detail: t(what), href });
  }
  const reference = hrefOf('components');
  for (const component of COMPONENTS) entries.push({ kind: 'Component', title: `<${component.name} />`, detail: t(component.summary), href: `${reference}#component-${component.name}` });
  for (const prop of PROPS) entries.push({ kind: 'Prop', title: prop.name, detail: `DocsProvider · ${prop.type}`, href: `${reference}#prop-${prop.name}` });
  for (const hook of HOOKS) entries.push({ kind: 'Hook', title: hook.name, detail: t(hook.short), href: `${reference}#${hookHash(hook.name)}` });
  for (const fn of LANG_FNS) entries.push({ kind: 'Function', title: fn, detail: t({ en: 'Languages and fonts', es: 'Idiomas y fuentes', zh: '语言与字体' }), href: `${reference}#languages` });
  for (const fn of VERSION_FNS)
    entries.push({ kind: 'Function', title: fn, detail: t({ en: 'Versions and assistants', es: 'Versiones y asistentes', zh: '版本与助手' }), href: `${reference}#versions` });
  const api = hrefOf('editor-api');
  for (const member of MEMBER_NAMES) entries.push({ kind: 'Member', title: `editor.${member.name}`, detail: `Editor · ${say(member.group, locale)}`, href: `${api}#${member.row}` });
  const assistants = hrefOf('assistants');
  for (const tool of [...FILE_TOOLS, ...toolDocs()])
    entries.push({ kind: 'Tool', title: tool.name, detail: `MCP · ${tool.description.split(/(?<=[.:])\s/)[0]}`, href: `${assistants}#tool-${tool.name}` });
  return entries.map((entry) => ({ ...entry, href: localize(entry.href, locale) }));
}
