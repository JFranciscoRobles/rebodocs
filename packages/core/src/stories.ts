// The headers and footers of a document, by the name of the part each lives
// in: the ones every page shows, and the ones the first page has to itself
// when the document gives it its own.

import type { Doc, Story } from './model';
import type { StoryPart } from './docx/source';

export type { StoryPart };

export const STORY_PARTS: StoryPart[] = ['header', 'footer', 'firstHeader', 'firstFooter'];

const KIND = { header: 'header', footer: 'footer', firstHeader: 'header', firstFooter: 'footer' } as const;

/** Whether a part is a header or a footer. */
export const storyKind = (part: StoryPart): 'header' | 'footer' => KIND[part];

const ofFirst = (part: StoryPart) => part === 'firstHeader' || part === 'firstFooter';

/** The header or the footer of a part, when the document has it. */
export function storyOf(doc: Pick<Doc, 'header' | 'footer' | 'firstPage'>, part: StoryPart): Story | undefined {
  return ofFirst(part) ? doc.firstPage?.[KIND[part]] : doc[KIND[part]];
}

/** The document with `story` as the header or the footer of a part, or without one when it is undefined. */
export function withStory(doc: Doc, part: StoryPart, story: Story | undefined): Doc {
  const kind = KIND[part];
  if (!ofFirst(part)) {
    const { [kind]: _, ...rest } = doc;
    return story ? { ...rest, [kind]: story } : rest;
  }
  // The first page keeps having a header and a footer of its own, though it may have neither.
  const { [kind]: _, ...rest } = doc.firstPage ?? {};
  return { ...doc, firstPage: story ? { ...rest, [kind]: story } : rest };
}

/** The part the header or the footer of a page lives in: the first page's own, when it has its own. */
export function storyPart(doc: Pick<Doc, 'firstPage'>, kind: 'header' | 'footer', pageIndex: number): StoryPart {
  return pageIndex === 0 && doc.firstPage ? (kind === 'header' ? 'firstHeader' : 'firstFooter') : kind;
}
