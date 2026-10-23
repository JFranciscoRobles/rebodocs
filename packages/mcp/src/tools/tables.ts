// Tables, signatures and pictures.

import {
  cellOfTable,
  type Doc,
  applyRunProps,
  canMergeCells,
  canSplitCell,
  deleteColumn,
  deleteRow,
  deleteTable,
  setHeaderRow,
  setRowHeight,
  type Border,
  type BorderStyle,
  imageExtension,
  insertColumn,
  insertImage,
  insertRow,
  locateCell,
  mergeCells,
  setCellProps,
  setParagraphProps,
  splitCell,
  deleteRange,
  setAltText,
  insertSignatures,
  insertTable,
  insertText,
  MIN_COLUMN_WIDTH,
  movePicture,
  resizePicture,
  paragraphLength,
} from '@rebodocs/core/internal';
import { type Tool, fail, text, optionalText, optionalFlag, whole, paragraphIndex, afterIndex, lines, spliced, CM, PX, pictureSize, color, number } from './shared';

export const TABLES: Tool[] = [
  {
    name: 'insert_table',
    title: 'Insert a table',
    areas: true,
    description: 'Puts in a table after a paragraph, with the text of each cell. Every row must have the same number of cells.',
    properties: {
      after_paragraph: { type: 'integer', description: 'The number of the paragraph to insert after; 0 to insert at the start.' },
      rows: { type: 'array', minItems: 1, items: { type: 'array', minItems: 1, items: { type: 'string' } }, description: 'The rows, each a list with the text of its cells.' },
      header: { type: 'boolean', description: 'The first row is a heading, set in bold. True when left out.' },
    },
    required: ['after_paragraph', 'rows'],
    writes: true,
    run(doc, args) {
      const after = afterIndex(doc, args);
      const rows = Array.isArray(args.rows) && args.rows.length ? (args.rows as unknown[]) : fail('"rows" must be a list of rows.');
      const cells = rows.map((row) => (Array.isArray(row) && row.length ? row.map((cell) => String(cell ?? '')) : fail('Each row must be a list with the text of its cells.')));
      if (cells.some((row) => row.length !== cells[0].length)) fail('Every row must have the same number of cells.');
      if (cells[0].length > 12) fail('A table can have 12 columns at most.');
      if (after >= 0 && doc.paragraphs[after].cell) fail('A table cannot go inside another: choose a paragraph outside the table.');
      const at = after + 1;
      const made = insertTable(spliced(doc, after, ['']), { para: at, offset: 0 }, cells.length, cells[0].length).doc;
      if (made.paragraphs.length === doc.paragraphs.length + 1) fail('A table cannot go there.');
      const first = made.paragraphs.findIndex((p, i) => i >= at && p.cell);
      const flat = cells.flat();
      let next = made;
      for (let i = flat.length - 1; i >= 0; i--) if (flat[i]) next = insertText(next, { para: first + i, offset: 0 }, flat[i]).doc;
      if (optionalFlag(args, 'header') ?? true) {
        const last = first + cells[0].length - 1;
        next = applyRunProps(next, { from: { para: first, offset: 0 }, to: { para: last, offset: paragraphLength(next.paragraphs[last]) } }, { bold: true });
      }
      return { text: `Table of ${cells.length} × ${cells[0].length} inserted: its cells are paragraphs ${first + 1} to ${first + flat.length}.`, doc: next, reveal: { para: first, offset: 0 } };
    },
  },
  {
    name: 'insert_signatures',
    title: 'Insert signature lines',
    description: 'Puts in a block of signatures after a paragraph: side by side, each with its title (such as ASESOR and CLIENTE), a line to sign on and the name under it.',
    properties: {
      after_paragraph: { type: 'integer', description: 'The number of the paragraph to insert after.' },
      titles: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string' }, description: 'The title over each signature.' },
      names: { type: 'array', items: { type: 'string' }, description: 'The name under each line, in the order of the titles. A variable, like {{cliente | mayúsculas}}, makes it a template.' },
    },
    required: ['after_paragraph', 'titles'],
    writes: true,
    run(doc, args) {
      const after = afterIndex(doc, args);
      const titles = Array.isArray(args.titles) && args.titles.length ? args.titles.map(String) : fail('"titles" must be a list with the title of each signature.');
      if (titles.length > 4) fail('There is room for 4 signatures side by side at most.');
      const names = Array.isArray(args.names) ? args.names.map(String) : [];
      if (after >= 0 && doc.paragraphs[after].cell) fail('The signatures cannot go inside a table: choose a paragraph outside it.');
      const at = after + 1;
      const made = insertSignatures(spliced(doc, after, ['']), { para: at, offset: 0 }, titles, names[0]).doc;
      const first = made.paragraphs.findIndex((p, i) => i >= at && p.cell);
      if (first < 0) fail('The signatures cannot go there.');
      // Each cell has its title, its line and its name: the name is the third paragraph of each.
      const paragraphs = made.paragraphs.map((p, i) => {
        const cell = Math.floor((i - first) / 3);
        if (i < first || cell >= titles.length || (i - first) % 3 !== 2 || names[cell] === undefined) return p;
        return { ...p, runs: [{ ...p.runs[0], text: names[cell] }] };
      });
      return { text: `Signatures inserted in paragraphs ${first + 1} to ${first + titles.length * 3}.`, doc: { ...made, paragraphs }, reveal: { para: first, offset: 0 } };
    },
  },
  {
    name: 'edit_table',
    title: 'Edit a table',
    areas: true,
    description:
      'Changes the shape or the look of a table that is there. "paragraph" is any paragraph of the cell to act on (read_document says which cell each is in). Actions: insert_row_above, insert_row_below, insert_column_left, insert_column_right, delete_row, delete_column, merge_cells (from "paragraph" to "to_paragraph"), split_cell (undoes a merge), set_column_widths (with "widths_cm", one for each column), set_row_height (with "height_cm", 0 for as tall as it holds, and "exact"), header_row_on and header_row_off (the rows down to this one repeat at the top of each page), align_cells_top, align_cells_center, align_cells_bottom, text_level, text_up and text_down (the text of the cells set level, or vertically to read from the bottom up or from the top down; its lines are as long as the row is tall), shade_cells (with "shade"), cell_lines (with "line_style", "line_width_pt" and "line_color"; "line_style" none takes them away), show_borders, hide_borders (the whole table), keep_together (the whole table on one page, as a block of signatures should be: no row is cut, and each row stays with the next), allow_split (undoes it) and delete_table. The actions on cells take "to_paragraph" for several. The text of a cell is changed with replace_text and insert_paragraphs.',
    properties: {
      paragraph: { type: 'integer', description: 'A paragraph of the cell to act on.' },
      action: {
        type: 'string',
        enum: [
          'insert_row_above',
          'insert_row_below',
          'insert_column_left',
          'insert_column_right',
          'delete_row',
          'delete_column',
          'merge_cells',
          'split_cell',
          'set_column_widths',
          'set_row_height',
          'header_row_on',
          'header_row_off',
          'align_cells_top',
          'align_cells_center',
          'align_cells_bottom',
          'text_level',
          'text_up',
          'text_down',
          'shade_cells',
          'cell_lines',
          'show_borders',
          'hide_borders',
          'keep_together',
          'allow_split',
          'delete_table',
        ],
      },
      height_cm: { type: 'number', description: 'For set_row_height: in centimetres, without the margins of the cells; 0 for as tall as what it holds.' },
      exact: { type: 'boolean', description: 'For set_row_height: the row is that tall whatever it holds.' },
      line_style: { type: 'string', enum: ['single', 'double', 'dashed', 'dotted', 'none'], description: 'For cell_lines: the line all round the cells.' },
      line_width_pt: { type: 'number', description: 'For cell_lines: how thick, in points. 0.5 when left out.' },
      line_color: { type: 'string', description: 'For cell_lines: six hex digits. Black when left out.' },
      widths_cm: { type: 'array', items: { type: 'number' }, description: 'For set_column_widths: how wide each column is, in centimetres, from the left.' },
      to_paragraph: { type: 'integer', description: 'A paragraph of the cell at the other corner, for merge_cells and shade_cells.' },
      shade: { type: 'string', description: 'For shade_cells: the colour behind the cells, as six hex digits (E8EEF9); "none" to take it away.' },
    },
    required: ['paragraph', 'action'],
    writes: true,
    run(doc, args, context) {
      const para = paragraphIndex(doc, args, 'paragraph');
      const at = locateCell(doc, para) ?? fail(`Paragraph ${para + 1} is not in a table.`);
      if (
        at.tableIndex < (context.fixedTables ?? 0) &&
        !['shade_cells', 'cell_lines', 'align_cells_top', 'align_cells_center', 'align_cells_bottom', 'text_level', 'text_up', 'text_down', 'show_borders', 'hide_borders'].includes(
          String(args.action),
        )
      ) {
        fail('A table the header or the footer of the file came with cannot be given another shape here: change the text of its cells, or make a new table.');
      }
      const other = whole(args, 'to_paragraph') === undefined ? para : paragraphIndex(doc, args, 'to_paragraph');
      if (!cellOfTable(doc.tables, doc.paragraphs[other].cell, at.tableIndex)) fail(`Paragraph ${other + 1} is not in the same table.`);
      const action = text(args, 'action');
      /** The paragraphs of the table, which are one after another, those of the tables in its cells among them. */
      const span = (now: Doc, table: number) => {
        const from = now.paragraphs.findIndex((p) => cellOfTable(now.tables, p.cell, table));
        let to = from;
        while (cellOfTable(now.tables, now.paragraphs[to + 1]?.cell, table)) to++;
        return { from, to };
      };
      const all = span(doc, at.tableIndex);
      let next: Doc;
      switch (action) {
        case 'insert_row_above':
        case 'insert_row_below':
          next = insertRow(doc, para, action === 'insert_row_below');
          break;
        case 'insert_column_left':
        case 'insert_column_right':
          next = insertColumn(doc, para, action === 'insert_column_right');
          break;
        case 'delete_row':
          next = deleteRow(doc, para).doc;
          break;
        case 'delete_column':
          next = deleteColumn(doc, para).doc;
          break;
        case 'merge_cells':
          if (other === para) fail('merge_cells needs "to_paragraph": a paragraph of the cell at the other corner.');
          if (!canMergeCells(doc, para, other)) fail('Those cells cannot be merged: they must make a rectangle of whole cells.');
          next = mergeCells(doc, para, other).doc;
          break;
        case 'split_cell':
          if (!canSplitCell(doc, para)) fail('That cell is not a merged one: only a merge can be split.');
          next = splitCell(doc, para);
          break;
        case 'set_column_widths': {
          const given = Array.isArray(args.widths_cm) ? args.widths_cm : fail('set_column_widths needs "widths_cm": the width of each column, in centimetres.');
          if (given.length !== at.table.columns.length) fail(`The table has ${at.table.columns.length} columns: give ${at.table.columns.length} widths.`);
          const widths = given.map((value) => (typeof value === 'number' && value > 0 ? value * CM : fail('Each width must be a number above 0.')));
          if (widths.some((width) => width < MIN_COLUMN_WIDTH)) fail(`A column cannot be narrower than ${(MIN_COLUMN_WIDTH / CM).toFixed(1)} cm.`);
          const room = doc.page.width - doc.page.marginLeft - doc.page.marginRight;
          const total = widths.reduce((sum, width) => sum + width, 0);
          if (total > room + 0.5) fail(`Those widths add up to ${(total / CM).toFixed(1)} cm, and there are ${(room / CM).toFixed(1)} cm between the margins.`);
          const tables = (doc.tables ?? []).slice();
          // The widths are now the ones given: the table no longer follows the width of the page.
          const { widthFraction: _, ...rest } = at.table;
          tables[at.tableIndex] = { ...rest, columns: widths, fixed: true };
          next = { ...doc, tables };
          break;
        }
        case 'shade_cells': {
          const shade = text(args, 'shade');
          next = setCellProps(doc, para, other, { shade: shade === 'none' ? '' : color(shade, 'shade') });
          break;
        }
        case 'set_row_height': {
          const height = number(args, 'height_cm', 0, 50) ?? fail('set_row_height needs "height_cm": the height in centimetres, or 0 for as tall as what the row holds.');
          next = setRowHeight(doc, para, height * CM, optionalFlag(args, 'exact') ?? false);
          break;
        }
        case 'header_row_on':
        case 'header_row_off':
          next = setHeaderRow(doc, para, action === 'header_row_on');
          break;
        case 'align_cells_top':
        case 'align_cells_center':
        case 'align_cells_bottom':
          next = setCellProps(doc, para, other, { valign: action.slice('align_cells_'.length) as 'top' | 'center' | 'bottom' });
          break;
        case 'text_level':
        case 'text_up':
        case 'text_down':
          next = setCellProps(doc, para, other, { direction: action.slice('text_'.length) as 'level' | 'up' | 'down' });
          break;
        case 'cell_lines': {
          const style = text(args, 'line_style');
          if (!['single', 'double', 'dashed', 'dotted', 'none'].includes(style)) fail('"line_style" must be "single", "double", "dashed", "dotted" or "none".');
          const tint = optionalText(args, 'line_color');
          const line: Border = {
            width: number(args, 'line_width_pt', 0.25, 6) ?? 0.5,
            color: tint === undefined ? '000000' : color(tint, 'line_color'),
            style: (style === 'none' ? 'single' : style) as BorderStyle,
          };
          next = setCellProps(doc, para, other, style === 'none' ? { borders: false } : { line });
          break;
        }
        case 'show_borders':
        case 'hide_borders':
          next = setCellProps(doc, all.from, all.to, { borders: action === 'show_borders' });
          break;
        case 'keep_together':
        case 'allow_split': {
          // As Word keeps a table together: no row cut by a page, and every paragraph of the rows but the last kept with the next.
          const keep = action === 'keep_together';
          const tables = (doc.tables ?? []).slice();
          const rows = at.table.rows.map((row) => {
            const { cantSplit: _, ...rest } = row;
            return keep ? { ...rest, cantSplit: true } : rest;
          });
          tables[at.tableIndex] = { ...at.table, rows };
          const last = at.table.rows[at.table.rows.length - 1].id;
          const paragraphs = doc.paragraphs.map((p, i) => {
            if (i < all.from || i > all.to) return p;
            const want = keep && p.cell!.row !== last;
            if (!!p.props.keepNext === want) return p;
            const { keepNext: _, ...props } = p.props;
            return { ...p, props: want ? { ...props, keepNext: true } : props };
          });
          next = { ...doc, tables, paragraphs };
          if (paragraphs.every((p, i) => p === doc.paragraphs[i]) && at.table.rows.every((row) => !!row.cantSplit === keep)) next = doc;
          break;
        }
        case 'delete_table': {
          const gone = deleteTable(doc, para);
          return { text: 'Table deleted. The paragraphs after it moved up.', doc: gone.doc, reveal: gone.pos };
        }
        default:
          return fail(`There is no action "${action}".`);
      }
      if (next === doc) return { text: 'Nothing changed: the table was already like that.' };
      // A table that lost its last row or column has no paragraphs left: it is kept, empty, so that the others keep their place.
      if (!next.tables?.[at.tableIndex]?.rows.length || !next.paragraphs.some((p) => p.cell?.table === at.tableIndex))
        return { text: 'That was the last of the table: it is gone.', doc: next, reveal: { para: Math.min(all.from, next.paragraphs.length - 1), offset: 0 } };
      const now = span(next, at.tableIndex);
      const table = next.tables![at.tableIndex];
      return {
        text: `Done. The table has ${table.rows.length} rows and ${table.columns.length} columns; its cells are paragraphs ${now.from + 1} to ${now.to + 1}:\n${lines(next, now.from, now.to)}`,
        doc: next,
        reveal: { para: now.from, offset: 0 },
      };
    },
  },
  {
    name: 'insert_image',
    title: 'Insert a picture',
    areas: true,
    description:
      'Puts a picture from a file (PNG, JPEG or GIF) in a paragraph of its own after a paragraph. It goes at its own size, or as wide as the text when it is wider, unless "width_cm" says otherwise.',
    properties: {
      after_paragraph: { type: 'integer', description: 'The number of the paragraph to insert after; 0 to insert at the start.' },
      path: { type: 'string', description: 'The path of the picture file.' },
      width_cm: { type: 'number', description: 'How wide to show it, in centimetres. Its height follows.' },
      align: { type: 'string', enum: ['left', 'center', 'right'], description: 'Where on the line it goes. Left when left out.' },
    },
    required: ['after_paragraph', 'path'],
    writes: true,
    run(doc, args) {
      const after = afterIndex(doc, args);
      // The file is read by whoever runs the tool, which gives its bytes here: a page cannot open a path.
      const type = optionalText(args, 'type') ?? '';
      const data = optionalText(args, 'data') ?? fail('The picture file could not be read.');
      if (!imageExtension(type)) fail('Only PNG, JPEG and GIF pictures can be put in a document.');
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const size = pictureSize(bytes, type) ?? fail('The file is not a picture that can be read.');
      const { width: pageWidth, marginLeft, marginRight } = doc.page;
      const room = pageWidth - marginLeft - marginRight;
      const asked =
        args.width_cm === undefined || args.width_cm === null ? undefined : typeof args.width_cm === 'number' && args.width_cm > 0 ? args.width_cm * CM : fail('"width_cm" must be a number above 0.');
      const width = Math.min(asked ?? size.width * PX, room);
      const height = (width * size.height) / size.width;
      const align = optionalText(args, 'align') ?? 'left';
      if (align !== 'left' && align !== 'center' && align !== 'right') fail('"align" must be "left", "center" or "right".');
      const at = after + 1;
      let next = insertImage(spliced(doc, after, ['']), { para: at, offset: 0 }, { bytes, type, width, height }).doc;
      next = setParagraphProps(next, at, at, { align: align as 'left' | 'center' | 'right' });
      return { text: `Picture inserted as paragraph ${at + 1}, ${(width / CM).toFixed(1)} × ${(height / CM).toFixed(1)} cm.`, doc: next, reveal: { para: at, offset: 0 } };
    },
  },
  {
    name: 'edit_image',
    title: 'Edit a picture',
    areas: true,
    description:
      'Changes a picture that is in the document: "resize" it (with "width_cm"; its height follows), "move" it to a paragraph of its own after another (with "after_paragraph"), "align" the paragraph it is in (with "align"), "describe" it for whoever cannot see it (with "description", what a screen reader says; empty takes it away), or "delete" it. read_document shows a picture as [image], or [image: its description].',
    properties: {
      paragraph: { type: 'integer', description: 'The paragraph the picture is in.' },
      occurrence: { type: 'integer', description: 'Which picture of the paragraph, when it has several: 1 for the first.' },
      action: { type: 'string', enum: ['resize', 'move', 'align', 'describe', 'delete'] },
      description: { type: 'string', description: 'For describe: what the picture shows, in a sentence, as Word\'s "Alt Text".' },
      width_cm: { type: 'number', description: 'For resize: how wide to show it, in centimetres.' },
      after_paragraph: { type: 'integer', description: 'For move: the paragraph it goes after; 0 for the start.' },
      align: { type: 'string', enum: ['left', 'center', 'right'], description: 'For align.' },
    },
    required: ['paragraph', 'action'],
    writes: true,
    run(doc, args) {
      const para = paragraphIndex(doc, args, 'paragraph');
      /** Where each picture of the paragraph is, and the size it is shown at. */
      const pictures: { offset: number; width: number; height: number }[] = [];
      let offset = 0;
      for (const run of doc.paragraphs[para].runs) {
        if (run.props.object && !run.props.anchor)
          for (let i = 0; i < run.text.length; i++) pictures.push({ offset: offset + i, width: run.props.objectWidth ?? 0, height: run.props.objectHeight ?? 0 });
        offset += run.text.length;
      }
      if (!pictures.length) fail(`Paragraph ${para + 1} has no picture.`);
      const nth = whole(args, 'occurrence') ?? 1;
      const was = pictures[nth - 1] ?? fail(`Paragraph ${para + 1} has ${pictures.length} ${pictures.length === 1 ? 'picture' : 'pictures'}: there is no ${nth}.`);
      const pos = { para, offset: was.offset };
      const action = text(args, 'action');
      switch (action) {
        case 'resize': {
          if (!(was.width > 0 && was.height > 0)) fail('That picture cannot be given another size.');
          const asked = typeof args.width_cm === 'number' && args.width_cm > 0 ? args.width_cm * CM : fail('resize needs "width_cm": a number above 0.');
          const width = Math.min(asked, doc.page.width - doc.page.marginLeft - doc.page.marginRight);
          const height = (width * was.height) / was.width;
          const next = resizePicture(doc, pos, width, height);
          if (next === doc) fail('That picture cannot be given another size.');
          return { text: `The picture is now ${(width / CM).toFixed(1)} × ${(height / CM).toFixed(1)} cm.`, doc: next, reveal: pos };
        }
        case 'align': {
          const align = text(args, 'align');
          if (align !== 'left' && align !== 'center' && align !== 'right') fail('"align" must be "left", "center" or "right".');
          return { text: `Paragraph ${para + 1} is aligned ${align}.`, doc: setParagraphProps(doc, para, para, { align: align as 'left' | 'center' | 'right' }), reveal: pos };
        }
        case 'describe': {
          const said = typeof args.description === 'string' ? args.description : fail('describe needs "description": what the picture shows, or "" to take it away.');
          const next = setAltText(doc, pos, said);
          return { text: said.trim() ? `The picture is described as: ${said.trim()}` : 'The picture has no description now.', doc: next === doc ? undefined : next, reveal: pos };
        }
        case 'delete':
          return { text: 'Picture deleted.', doc: deleteRange(doc, { from: pos, to: { para, offset: pos.offset + 1 } }), reveal: pos };
        case 'move': {
          const after = afterIndex(doc, args);
          // A paragraph of its own for it, like the one it is in; then the one it leaves, when nothing else was in it.
          const made = spliced(doc, after, ['']);
          const from = { para: after < para ? para + 1 : para, offset: pos.offset };
          const moved = movePicture(made, from, { para: after + 1, offset: 0 });
          if (moved.doc === made) fail('The picture could not be moved there.');
          let next = setParagraphProps(moved.doc, after + 1, after + 1, { align: doc.paragraphs[para].props.align ?? 'left' });
          const left = next.paragraphs[from.para];
          const alone = !paragraphLength(left) && !left.cell && next.paragraphs.length > 1;
          if (alone) next = { ...next, paragraphs: next.paragraphs.filter((_, i) => i !== from.para) };
          const now = after + 1 - (alone && from.para < after + 1 ? 1 : 0);
          return { text: `The picture is now in paragraph ${now + 1}.`, doc: next, reveal: { para: now, offset: 0 } };
        }
        default:
          return fail(`There is no action "${action}".`);
      }
    },
  },
];
