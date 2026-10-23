// The structure of a PDF, for whoever reads it with a screen reader: what is
// a heading, a paragraph, a list and its items, a table and its cells, a
// picture and its description, a note, a link. A tagged PDF keeps it as a tree
// of elements beside the pages, each pointing at the pieces of their content
// that are its own; whatever is drawn and is not part of it (borders, shading,
// headers and footers, a heading row repeated on the next page) is marked as
// an artifact, which a reader skips.
//
// The tree is built from the document first, in its order, so the order of
// reading is the document's whatever order the pages are drawn in; drawing
// then gives each element its pieces. Elements that end up with none (an
// empty paragraph) are left out, except the cells of a table, which keep its
// shape.

import type { Doc, Paragraph } from './model';
import { headingLevels } from './outline';
import { endnoteReferences, footnoteReferences } from './footnotes';
import { textBoxId } from './textboxes';

/** An id as a PDF string of bytes, which is what ids are: the ones made here are letters, digits and hyphens. */
const byteString = (id: string) => `(${id.replace(/[^\w-]/g, '')})`;

/** A piece of a page's content that belongs to an element: by its number on the page. */
interface Marked {
  page: number;
  mcid: number;
}

/** A link of a page, which the element of its text points at. */
interface Annotation {
  page: number;
  annot: number;
}

export interface Element {
  type: string;
  parent?: Element;
  kids: (Element | Marked | Annotation)[];
  /** What else its dictionary says: a description, an id, the attributes of a cell. */
  alt?: string;
  id?: string;
  bbox?: [number, number, number, number];
  scope?: 'Column';
  rowSpan?: number;
  colSpan?: number;
  /** Kept when it has nothing: a cell of a table. */
  keep?: boolean;
}

/** The lists a container is in the middle of, from the outermost: each with its level and its last item's body. */
type Lists = { list: Element; body?: Element; level: number }[];

export class StructTree {
  readonly root: Element = { type: 'Document', kids: [] };
  private paragraphs = new Map<number, Element>();
  private labels = new Map<number, Element>();
  private notes = new Map<string, Element>();
  private notesBy = new Map<string, Element>();
  private boxes = new Map<string, Element>();
  private storyParagraphs = new Map<string, Element>();
  private lists = new Map<Element, Lists>();
  private tables = new Map<number, Map<string, Element>>();
  /** The elements of the pieces of each page, by their number; and of each link, after the pages. */
  private marked: Element[][] = [];
  private annotations: Element[] = [];

  /** Whether the tree was built from the document, and knows where its parts go. */
  private built: boolean;

  constructor(doc?: Doc) {
    this.built = !!doc;
    if (doc) this.build(doc);
  }

  /** Whether the text of a text box is read: one anchored in the body is, after its paragraph; one in a header is part of it, and is not. */
  readsBox(id: string): boolean {
    return !this.built || this.boxes.has(id);
  }

  /** A new element at the end of `parent`. */
  private add(parent: Element, type: string, extra: Partial<Element> = {}): Element {
    const kid: Element = { type, parent, kids: [], ...extra };
    parent.kids.push(kid);
    return kid;
  }

  private build(doc: Doc): void {
    const levels = headingLevels(doc);
    const referenced = new Map<number, string[]>();
    for (const ref of footnoteReferences(doc)) (referenced.get(ref.para) ?? referenced.set(ref.para, []).get(ref.para)!).push(ref.id);
    // A note at the end is named apart: its ids are counted apart from those at the foot of the page.
    for (const ref of endnoteReferences(doc)) (referenced.get(ref.para) ?? referenced.set(ref.para, []).get(ref.para)!).push(`endnote:${ref.id}`);
    doc.paragraphs.forEach((p, para) => {
      const container = p.cell ? this.cellOf(doc, p.cell) : this.root;
      const level = levels.get(p.props.styleId ?? '');
      let leaf: Element;
      if (level !== undefined) {
        this.lists.delete(container);
        leaf = this.add(container, `H${Math.min(6, Math.max(1, level))}`);
      } else if (p.props.numId) {
        leaf = this.item(container, p);
        this.labels.set(para, leaf.parent!.parent!.kids[0] as Element);
      } else {
        this.lists.delete(container);
        leaf = this.add(container, 'P');
      }
      this.paragraphs.set(para, leaf);
      // A note, where its reference is; a text box, after the paragraph it is anchored in.
      for (const id of referenced.get(para) ?? []) this.notesBy.set(id, leaf);
      for (const run of p.runs) {
        const box = textBoxId(run.props.object);
        if (box !== undefined && !this.boxes.has(box)) {
          this.lists.delete(container);
          this.boxes.set(box, this.add(container, 'Div'));
        }
      }
    });
  }

  /** An item of a list, in the list of its level, which a deeper one goes inside the item before: the element its text goes in. */
  private item(container: Element, p: Paragraph): Element {
    const level = p.props.listLevel ?? 0;
    const lists = this.lists.get(container) ?? [];
    this.lists.set(container, lists);
    while (lists.length && lists[lists.length - 1].level > level) lists.pop();
    let top = lists[lists.length - 1];
    if (!top || top.level < level) {
      const parent = top?.body ?? container;
      top = { list: this.add(parent, 'L'), level };
      lists.push(top);
    }
    const item = this.add(top.list, 'LI');
    this.add(item, 'Lbl');
    top.body = this.add(item, 'LBody');
    return this.add(top.body, 'P');
  }

  /** The element of a table's cell, the table made whole the first time one of its cells is asked for. A cell merged into the one above is that one. */
  private cellOf(doc: Doc, ref: { table: number; row: number; cell: number }): Element {
    let cells = this.tables.get(ref.table);
    if (!cells) {
      cells = new Map();
      this.tables.set(ref.table, cells);
      const table = doc.tables?.[ref.table];
      const container = table?.parent ? this.cellOf(doc, table.parent) : this.root;
      this.lists.delete(container);
      const element = this.add(container, 'Table');
      /** The cell each column is merged down from, while it goes on. */
      const open = new Map<number, Element>();
      for (const row of table?.rows ?? []) {
        const tr = this.add(element, 'TR', { keep: true });
        // Columns of the grid a row leaves out, before its cells or after them, are empty cells: every row is as wide as the table.
        const gap = (span: number) => span > 0 && this.add(tr, 'TD', { keep: true, ...(span > 1 ? { colSpan: span } : {}) });
        gap(row.before);
        let column = row.before;
        for (const cell of row.cells) {
          const above = cell.merge === 'continue' ? open.get(column) : undefined;
          if (above) {
            above.rowSpan = (above.rowSpan ?? 1) + 1;
            cells.set(`${row.id}:${cell.id}`, above);
          } else {
            const td = this.add(tr, row.header ? 'TH' : 'TD', { keep: true, ...(row.header ? { scope: 'Column' as const } : {}), ...(cell.span > 1 ? { colSpan: cell.span } : {}) });
            cells.set(`${row.id}:${cell.id}`, td);
            if (cell.merge === 'start') open.set(column, td);
            else open.delete(column);
          }
          column += cell.span;
        }
        gap((table?.columns.length ?? 0) - column);
      }
    }
    return cells.get(`${ref.row}:${ref.cell}`) ?? this.root;
  }

  /** The element the text of a paragraph of the body goes in; one of its own, made on the spot, when the tree was not built from the document. */
  paragraph(para: number): Element {
    let leaf = this.paragraphs.get(para);
    if (!leaf) this.paragraphs.set(para, (leaf = this.add(this.root, 'P')));
    return leaf;
  }

  /** The element the label of a list item goes in. */
  label(para: number): Element | undefined {
    return this.labels.get(para);
  }

  /** The element the text of a paragraph of a note goes in, where its reference is. */
  note(id: string, para: number): Element {
    let note = this.notes.get(id);
    if (!note) this.notes.set(id, (note = this.add(this.notesBy.get(id) ?? this.root, 'Note', { id: `note-${id}` })));
    return this.story(note, `note:${id}:${para}`);
  }

  /** The element the text of a paragraph of a text box goes in, after the paragraph it is anchored in. */
  box(id: string, para: number): Element {
    let box = this.boxes.get(id);
    if (!box) this.boxes.set(id, (box = this.add(this.root, 'Div')));
    return this.story(box, `box:${id}:${para}`);
  }

  private story(parent: Element, key: string): Element {
    let leaf = this.storyParagraphs.get(key);
    if (!leaf) this.storyParagraphs.set(key, (leaf = this.add(parent, 'P')));
    return leaf;
  }

  /** A picture, a link: an element of its own inside `parent`. */
  child(parent: Element, type: string, extra: Partial<Element> = {}): Element {
    return this.add(parent, type, extra);
  }

  /** Gives `element` the next piece of page `page`: the number the page's content marks it with. */
  mark(element: Element, page: number): number {
    const list = (this.marked[page] ??= []);
    element.kids.push({ page, mcid: list.length });
    list.push(element);
    return list.length - 1;
  }

  /** Gives `element` a link of page `page`, the annotation `annot`: the key the annotation names its element by. */
  link(element: Element, page: number, annot: number, pages: number): number {
    element.kids.push({ page, annot });
    this.annotations.push(element);
    return pages + this.annotations.length - 1;
  }

  /**
   * Writes the tree: each element that has something, the tree's root, and the
   * table that finds the element of each piece and each link. Returns the
   * root, for the catalog.
   */
  write(reserve: () => number, write: (id: number, dict: string) => void, pageIds: number[], text: (value: string) => string): number {
    const ids = new Map<Element, number>();
    const has = (element: Element): boolean => {
      const kept = element.kids.filter((kid) => !('type' in kid) || has(kid));
      element.kids = kept;
      return !!kept.length || !!element.keep;
    };
    has(this.root);
    const rootId = reserve();
    const number = (element: Element) => {
      ids.set(element, reserve());
      for (const kid of element.kids) if ('type' in kid) number(kid);
    };
    number(this.root);
    for (const [element, id] of ids) {
      const kids = element.kids.map((kid) =>
        'type' in kid
          ? `${ids.get(kid)} 0 R`
          : 'mcid' in kid
            ? `<< /Type /MCR /Pg ${pageIds[kid.page]} 0 R /MCID ${kid.mcid} >>`
            : `<< /Type /OBJR /Pg ${pageIds[kid.page]} 0 R /Obj ${kid.annot} 0 R >>`,
      );
      const table = [element.scope && `/Scope /${element.scope}`, element.rowSpan && `/RowSpan ${element.rowSpan}`, element.colSpan && `/ColSpan ${element.colSpan}`].filter(Boolean).join(' ');
      const attributes = [table && `<< /O /Table ${table} >>`, element.bbox && `<< /O /Layout /BBox [${element.bbox.join(' ')}] >>`].filter(Boolean);
      const parent = element.parent ? ids.get(element.parent) : rootId;
      write(
        id,
        `<< /Type /StructElem /S /${element.type} /P ${parent} 0 R` +
          (element.alt !== undefined ? ` /Alt ${text(element.alt)}` : '') +
          (element.id ? ` /ID ${byteString(element.id)}` : '') +
          (attributes.length ? ` /A ${attributes.length > 1 ? `[${attributes.join(' ')}]` : attributes[0]}` : '') +
          ` /K [${kids.join(' ')}] >>`,
      );
    }
    const nums: string[] = [];
    this.marked.forEach((list, page) => {
      if (list?.length) nums.push(`${page} [${list.map((element) => `${ids.get(element)} 0 R`).join(' ')}]`);
    });
    this.annotations.forEach((element, i) => nums.push(`${pageIds.length + i} ${ids.get(element)} 0 R`));
    const parentTree = reserve();
    write(parentTree, `<< /Nums [${nums.join(' ')}] >>`);
    const ided = [...ids.keys()].filter((element) => element.id);
    const idTree = ided.length ? reserve() : 0;
    if (idTree)
      write(
        idTree,
        `<< /Names [${ided
          .sort((a, b) => (a.id! < b.id! ? -1 : 1))
          .map((element) => `${byteString(element.id!)} ${ids.get(element)} 0 R`)
          .join(' ')}] >>`,
      );
    write(
      rootId,
      `<< /Type /StructTreeRoot /K ${ids.get(this.root)} 0 R /ParentTree ${parentTree} 0 R /ParentTreeNextKey ${pageIds.length + this.annotations.length}${idTree ? ` /IDTree ${idTree} 0 R` : ''} >>`,
    );
    return rootId;
  }
}
