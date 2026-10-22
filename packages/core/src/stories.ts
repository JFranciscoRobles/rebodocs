// The headers and footers of a document, by the name of the part each lives
// in: the ones every page shows, and the ones the first page has to itself
// when the document gives it its own. A section may have its own as well: the
// same names with '@' and the index of the section.

import type { Doc, Section, Story } from './model';
import type { BasePart, DocxSource, FootnotePart, StorySource, StoryPart, TextBoxPart } from './docx/source';
import { footnoteOf, withFootnote } from './footnotes';
import { textBoxIdOf, textBoxOf, textBoxPart, withTextBox } from './textboxes';

export type { BasePart, FootnotePart, StoryPart, TextBoxPart };

/** The id of the note a part is the text of, when it is one. */
export const footnoteIdOf = (part: StoryPart): string | undefined => (part.startsWith('footnote:') ? part.slice('footnote:'.length) : undefined);

/** The part the text of note `id` is. */
export const footnotePart = (id: string): FootnotePart => `footnote:${id}`;

export const STORY_PARTS: BasePart[] = ['header', 'footer', 'firstHeader', 'firstFooter'];

const KIND = { header: 'header', footer: 'footer', firstHeader: 'header', firstFooter: 'footer' } as const;

/** The part a part is of the document's, and the section it is of when it is one's own. */
export function splitPart(part: StoryPart): { base: BasePart; section?: number } {
  const at = part.indexOf('@');
  return at < 0 ? { base: part as BasePart } : { base: part.slice(0, at) as BasePart, section: Number(part.slice(at + 1)) };
}

/** The part of the section with index `section`; the document's when it has none. */
export const sectionPart = (base: BasePart, section?: number): StoryPart => (section === undefined ? base : `${base}@${section}`);

/** Whether a part is a header, a footer, or the text of a note. */
export function storyKind(part: BasePart | `${BasePart}@${number}`): 'header' | 'footer';
export function storyKind(part: StoryPart): 'header' | 'footer' | 'footnote' | 'textbox';
export function storyKind(part: StoryPart): 'header' | 'footer' | 'footnote' | 'textbox' {
  return footnoteIdOf(part) !== undefined ? 'footnote' : textBoxIdOf(part) !== undefined ? 'textbox' : KIND[splitPart(part).base];
}

const ofFirst = (base: BasePart) => base === 'firstHeader' || base === 'firstFooter';

type WithStories = Pick<Doc, 'header' | 'footer' | 'firstPage' | 'paragraphs' | 'footnotes' | 'textBoxes'>;

/** The paragraphs that end the sections before the last, in order: the k-th ends section k. */
export function sectionEnds(doc: Pick<Doc, 'paragraphs'>): number[] {
  const ends: number[] = [];
  for (let i = 0; i < doc.paragraphs.length - 1; i++) if (doc.paragraphs[i].section && !doc.paragraphs[i].cell) ends.push(i);
  return ends;
}

/** The section a part is the own of, when it is one before the last. */
function ownerOf(doc: Pick<Doc, 'paragraphs'>, section: number | undefined): { para: number; section: Section } | undefined {
  if (section === undefined) return undefined;
  const para = sectionEnds(doc)[section];
  return para === undefined ? undefined : { para, section: doc.paragraphs[para].section! };
}

/** The header or the footer of a part, when the document has it. */
export function storyOf(doc: WithStories, part: StoryPart): Story | undefined {
  const note = footnoteIdOf(part);
  if (note !== undefined) return footnoteOf(doc, note);
  const box = textBoxIdOf(part);
  if (box !== undefined) return textBoxOf(doc, box);
  const { base, section } = splitPart(part);
  const kind = KIND[base];
  const holder = section === undefined ? doc : ownerOf(doc, section)?.section;
  return ofFirst(base) ? holder?.firstPage?.[kind] : holder?.[kind];
}

/** `holder` with `story` as its header or footer of a part, or without one when it is undefined. */
function withOwn<T extends { header?: Story; footer?: Story; firstPage?: { header?: Story; footer?: Story } }>(holder: T, base: BasePart, story: Story | undefined): T {
  const kind = KIND[base];
  if (!ofFirst(base)) {
    const { [kind]: _, ...rest } = holder;
    return (story ? { ...rest, [kind]: story } : rest) as T;
  }
  // The first page keeps having a header and a footer of its own, though it may have neither.
  const { [kind]: _, ...rest } = holder.firstPage ?? {};
  return { ...holder, firstPage: story ? { ...rest, [kind]: story } : rest };
}

/** The document with `story` as the header or the footer of a part, or without one when it is undefined. */
export function withStory<T extends WithStories>(doc: T, part: StoryPart, story: Story | undefined): T {
  const note = footnoteIdOf(part);
  // Without a story, the note goes.
  if (note !== undefined) {
    if (story) return withFootnote(doc, note, story);
    const footnotes = (doc.footnotes ?? []).filter((other) => other.id !== note);
    const { footnotes: _, ...rest } = doc;
    return (footnotes.length ? { ...rest, footnotes } : rest) as T;
  }
  const box = textBoxIdOf(part);
  if (box !== undefined) return withTextBox(doc, box, story);
  const { base, section } = splitPart(part);
  if (section === undefined) return withOwn(doc, base, story);
  const owner = ownerOf(doc, section);
  if (!owner) return doc;
  const paragraphs = doc.paragraphs.slice();
  paragraphs[owner.para] = { ...paragraphs[owner.para], section: withOwn(owner.section, base, story) };
  return { ...doc, paragraphs };
}

/** Every part the document has a header or a footer in, the document's first and then those of its sections. */
export function storyParts(doc: WithStories): StoryPart[] {
  const parts: StoryPart[] = STORY_PARTS.filter((part) => storyOf(doc, part));
  sectionEnds(doc).forEach((_, k) => {
    for (const base of STORY_PARTS) if (storyOf(doc, sectionPart(base, k))) parts.push(sectionPart(base, k));
  });
  return parts;
}

/** Every part with text of its own: the headers and footers, then the notes at the foot of the page and the text boxes. */
export function textParts(doc: WithStories): StoryPart[] {
  return [...storyParts(doc), ...(doc.footnotes ?? []).map((note) => footnotePart(note.id)), ...(doc.textBoxes ?? []).map((box) => textBoxPart(box.id))];
}

/** The part the header or the footer of a page lives in: its section's own, or the first page's, when it has them. */
export function storyPart(layout: { pages: { parts?: { header?: StoryPart; footer?: StoryPart } }[] }, kind: 'header' | 'footer', pageIndex: number): StoryPart {
  return layout.pages[pageIndex]?.parts?.[kind] ?? kind;
}

/** What a part was read from, when the document came from a file that had it. */
export function storySource(doc: Pick<Doc, 'paragraphs'> & { source?: DocxSource }, part: StoryPart): StorySource | undefined {
  const { source } = doc;
  if (!source) return undefined;
  const note = footnoteIdOf(part);
  if (note !== undefined) return source.footnoteSources?.get(note);
  const box = textBoxIdOf(part);
  if (box !== undefined) return source.textBoxSources?.get(box);
  const { base, section } = splitPart(part);
  if (section === undefined) return source[`${base}Source`];
  const origin = ownerOf(doc, section) && doc.paragraphs[ownerOf(doc, section)!.para].origin;
  return origin === undefined ? undefined : source.sectionStories?.[origin]?.[base];
}

/** The path in the package of the part a header or a footer was read from. */
export function storyPath(doc: Pick<Doc, 'paragraphs'> & { source?: DocxSource }, part: StoryPart): string | undefined {
  if (footnoteIdOf(part) !== undefined) return doc.source?.footnotesPath;
  // A text box is in the part its drawing is in; one made here, in the document.
  if (textBoxIdOf(part) !== undefined) return storySource(doc, part)?.path ?? doc.source?.mainPath;
  const { base, section } = splitPart(part);
  return section === undefined ? doc.source?.[`${base}Path`] : storySource(doc, part)?.path;
}
