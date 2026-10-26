// What the page "Tracked changes" says that is data, each checked in
// packages/core/src/revisions.ts, packages/editor/src/editor.ts (Tracked
// changes, commit, the keys), toolbar.ts (Review), panel.ts (renderChanges)
// and packages/mcp/src/tools.ts. Each text in each language of the site.

import { type Doc, type Paragraph, applyRunProps, createDoc, deleteRange, deleteRow, insertTable, insertText, paragraphText, setParagraphStyle, trackEdit } from '@rebodocs/core';
import type { L } from '@/lib/i18n';

const LUIS = { author: 'Luis', date: '2026-10-19T09:30:00Z' };
const para = (text: string): Paragraph => ({ props: {}, runs: [{ text, props: {} }] });

/** The receipt in a language, and what Luis does to it. */
interface Receipt {
  /** Its title and its three lines of terms: payment, late payments, cancelling. */
  lines: [string, string, string, string];
  /** The table, row by row: what is charged and its price. */
  cells: string[];
  /** In the line on payment, the days replaced. */
  days: [string, string];
  /** In the line on late payments, put in before `before`. */
  fee: { text: string; before: string };
  /** In the same line, the words made bold. */
  bold: string;
  /** In the line on cancelling, the words taken out. */
  cut: string;
  /** The first cell of the row taken out. */
  row: string;
}

const RECEIPTS: L<Receipt> = {
  en: {
    lines: ['Reservation receipt', 'Payment is due within 15 days of this receipt.', 'Late payments add a fee.', 'Either party may cancel by phone or in writing.'],
    cells: ['Item', 'Price', 'Room', '$900', 'Cleaning', '$50'],
    days: ['15', '30'],
    fee: { text: ' of 2% a month', before: '.' },
    bold: 'Late payments',
    cut: 'by phone or ',
    row: 'Cleaning',
  },
  es: {
    lines: ['Recibo de reservación', 'El pago vence a los 15 días de este recibo.', 'Los pagos tardíos suman un recargo.', 'Cualquiera de las partes puede cancelar por teléfono o por escrito.'],
    cells: ['Concepto', 'Precio', 'Habitación', '$900', 'Limpieza', '$50'],
    days: ['15', '30'],
    fee: { text: ' del 2% mensual', before: '.' },
    bold: 'Los pagos tardíos',
    cut: 'por teléfono o ',
    row: 'Limpieza',
  },
  zh: {
    lines: ['预订收据', '应在本收据开具后 15 天内付款。', '逾期付款加收费用。', '任何一方均可以电话或书面形式取消。'],
    cells: ['项目', '价格', '房间', '$900', '清洁费', '$50'],
    days: ['15', '30'],
    fee: { text: '每月 2% 的', before: '费用' },
    bold: '逾期付款',
    cut: '电话或',
    row: '清洁费',
  },
};

/** The receipt before Luis: two lines of terms and a table of what is charged. */
function receipt({ lines, cells }: Receipt): Doc {
  let doc = setParagraphStyle(createDoc([...lines.map(para), para('')]), 0, 0, 'Title');
  doc = insertTable(doc, { para: 4, offset: 0 }, 3, 2).doc;
  const at = doc.paragraphs.flatMap((p, i) => (p.cell ? [i] : []));
  cells.forEach((text, k) => (doc = insertText(doc, { para: at[k], offset: 0 }, text).doc));
  return doc;
}

/**
 * The document of the demo: Luis's edits, each tracked as the editor tracks
 * them, waiting for someone to decide. A word replaced, words put in and taken
 * out, a change of formatting and a row of the table taken out.
 */
function reviewed(spec: Receipt): Doc {
  let doc = receipt(spec);
  const step = (edit: (d: Doc) => Doc) => (doc = trackEdit(doc, edit(doc), LUIS, { words: true }).doc);
  // The lines of terms are paragraphs 1 to 3, before the table.
  const where = (para: number, text: string) => ({ para, offset: paragraphText(doc.paragraphs[para]).indexOf(text) });
  step((d) => {
    const from = where(1, spec.days[0]);
    return insertText(deleteRange(d, { from, to: { ...from, offset: from.offset + spec.days[0].length } }), from, spec.days[1]).doc;
  });
  step((d) => insertText(d, where(2, spec.fee.before), spec.fee.text).doc);
  step((d) => {
    const from = where(2, spec.bold);
    return applyRunProps(d, { from, to: { ...from, offset: from.offset + spec.bold.length } }, { bold: true });
  });
  step((d) => {
    const from = where(3, spec.cut);
    return deleteRange(d, { from, to: { ...from, offset: from.offset + spec.cut.length } });
  });
  step(
    (d) =>
      deleteRow(
        d,
        d.paragraphs.findIndex((p) => paragraphText(p) === spec.row),
      ).doc,
  );
  return { ...doc, trackRevisions: true };
}

export const REVIEWED: L<Doc> = { en: reviewed(RECEIPTS.en), es: reviewed(RECEIPTS.es), zh: reviewed(RECEIPTS.zh) };

export const PEOPLE = ['Ana', 'Luis'] as const;

/** How the keys behave while changes are tracked: commit and trackEdit in editor.ts, revisions.ts. */
export const KEYS: { key: L; text: L }[] = [
  {
    key: { en: 'Typing', es: 'Escribir', zh: '输入' },
    text: {
      en: 'What is typed is put in, underlined in your colour. What you type in a row is one change.',
      es: 'Lo que se escribe queda puesto, subrayado en tu color. Lo que escribes seguido es un solo cambio.',
      zh: '输入的内容会作为插入，以你的颜色加下划线显示。连续输入的内容算作一处更改。',
    },
  },
  {
    key: { en: 'Backspace', es: 'Retroceso', zh: 'Backspace' },
    text: {
      en: 'Text taken out stays, struck through, and the caret goes before it: Backspace again takes out the letter before, stepping over what is already struck.',
      es: 'El texto quitado se queda, tachado, y el cursor va antes de él: Retroceso otra vez quita la letra anterior, saltando lo ya tachado.',
      zh: '删除的文字会保留并显示删除线，光标移到它前面：再按一次 Backspace 会删除前一个字符，并跳过已划掉的内容。',
    },
  },
  {
    key: { en: 'Delete', es: 'Suprimir', zh: 'Delete' },
    text: { en: 'The same forward: the caret goes after what it took out.', es: 'Lo mismo hacia adelante: el cursor va después de lo que quitó.', zh: '向后删除，规则相同：光标移到删除内容的后面。' },
  },
  {
    key: { en: 'Over your own change', es: 'Sobre un cambio tuyo', zh: '在自己的更改上' },
    text: {
      en: 'Text you put in and take out again goes for good: it never was in the document.',
      es: 'El texto que pusiste y vuelves a quitar se va del todo: nunca estuvo en el documento.',
      zh: '自己插入又删除的文字会彻底消失：就像从未出现在文档中一样。',
    },
  },
  {
    key: { en: 'Over someone else’s', es: 'Sobre el de otra persona', zh: '在别人的更改上' },
    text: {
      en: 'Text another person put in stays, theirs and taken out by you: two changes, each decided on its own, as in Word.',
      es: 'El texto que puso otra persona se queda, suyo y quitado por ti: dos cambios, cada uno decidido por separado, como en Word.',
      zh: '别人插入的文字会保留，标为对方插入、由你删除：两处更改，各自单独处理，与 Word 相同。',
    },
  },
  {
    key: { en: 'Formatting', es: 'Formato', zh: '格式' },
    text: {
      en: 'Bold, a font, an alignment: a change of its own, which keeps the formatting the text had, to go back to. Text you just put in too, as in Word: its putting in and its formatting are decided apart.',
      es: 'Negrita, una fuente, una alineación: un cambio propio, que guarda el formato que tenía el texto, para volver a él. También en texto recién puesto, como en Word: ponerlo y su formato se deciden por separado.',
      zh: '加粗、字体、对齐方式：都是单独的更改，并保留文字原来的格式，以便恢复。刚插入的文字也是如此，与 Word 相同：插入和格式分开处理。',
    },
  },
  {
    key: { en: 'Enter', es: 'Intro', zh: 'Enter' },
    text: {
      en: 'The paragraph break is a change of its own, shown as a ¶ in your colour.',
      es: 'El salto de párrafo es un cambio propio, que se muestra como un ¶ en tu color.',
      zh: '分段本身是一处单独的更改，以你颜色的 ¶ 显示。',
    },
  },
  {
    key: { en: 'Backspace at the start', es: 'Retroceso al principio', zh: '在段首按 Backspace' },
    text: {
      en: 'Joining two paragraphs is a change too: they stay apart, the mark struck through, until it is accepted.',
      es: 'Unir dos párrafos también es un cambio: siguen separados, con la marca tachada, hasta que se acepta.',
      zh: '合并两个段落也是一处更改：在接受之前，两段仍然分开，段落标记显示删除线。',
    },
  },
];

/** The members of the editor, as editor.ts declares them. */
export const MEMBERS: { sig: string; text: L }[] = [
  {
    sig: 'trackChanges: boolean',
    text: {
      en: 'Whether changes are tracked. Saved in the file, as Word saves it.',
      es: 'Si se controlan los cambios. Se guarda en el archivo, como lo guarda Word.',
      zh: '是否启用修订。与 Word 一样保存在文件中。',
    },
  },
  {
    sig: 'setTrackChanges(on: boolean)',
    text: {
      en: 'Turns it on or off. Not a step to undo: what was tracked stays.',
      es: 'Lo activa o desactiva. No es un paso para deshacer: lo controlado se queda.',
      zh: '开启或关闭修订。不是可撤销的步骤：已记录的修订保留。',
    },
  },
  {
    sig: 'revisions: RevisionView[]',
    text: {
      en: 'Every change: of the text first, then of the headers, footers, notes and text boxes.',
      es: 'Todos los cambios: primero los del texto, luego los de encabezados, pies de página, notas y cuadros de texto.',
      zh: '所有更改：先是正文的，然后是页眉、页脚、脚注和文本框的。',
    },
  },
  { sig: 'hasRevisions: boolean', text: { en: 'Whether there is any change to accept or reject.', es: 'Si hay algún cambio que aceptar o rechazar.', zh: '是否有待接受或拒绝的更改。' } },
  {
    sig: 'activeRevision: RevisionView | undefined',
    text: {
      en: 'The change the caret is in, or the first the selection takes in.',
      es: 'El cambio donde está el cursor, o el primero que abarca la selección.',
      zh: '光标所在的更改，或选区包含的第一处更改。',
    },
  },
  {
    sig: 'acceptRevision(revision?) → boolean',
    text: {
      en: 'The change given, alone; without one, the changes the selection takes in, or the one at the caret. A move, both halves. False when there is none.',
      es: 'El cambio dado, solo; sin él, los cambios que abarca la selección, o el del cursor. Un movimiento, sus dos mitades. False cuando no hay ninguno.',
      zh: '只接受给定的更改；不传参数时，接受选区包含的更改或光标处的更改。移动会同时处理两部分。没有更改时返回 false。',
    },
  },
  { sig: 'rejectRevision(revision?) → boolean', text: { en: 'Rejects them the same way.', es: 'Los rechaza de la misma forma.', zh: '以同样的方式拒绝。' } },
  {
    sig: 'acceptAllRevisions(author?)',
    text: {
      en: 'Every change of the document, headers, notes and text boxes too, or every one of a person’s, as one step to undo.',
      es: 'Todos los cambios del documento, también encabezados, notas y cuadros de texto, o todos los de una persona, como un paso para deshacer.',
      zh: '接受文档的所有更改（包括页眉、脚注和文本框），或某个人的所有更改，作为一个可撤销的步骤。',
    },
  },
  { sig: 'rejectAllRevisions(author?)', text: { en: 'The same, rejected.', es: 'Lo mismo, rechazados.', zh: '同上，改为拒绝。' } },
  {
    sig: "changesView: 'all' | 'accepted' | 'original'",
    text: {
      en: 'How the changes are shown: marked, or the document as it would be with all of them accepted, or with none. Shown without them, it is only to be looked at.',
      es: 'Cómo se muestran los cambios: marcados, o el documento como quedaría con todos aceptados, o con ninguno. Mostrado sin ellos, es solo para mirar.',
      zh: '更改的显示方式：标记显示，或显示全部接受后的文档，或显示原始文档。不显示更改时，文档只能查看。',
    },
  },
  {
    sig: 'setChangesView(view)',
    text: {
      en: 'Shows them so. The changes are still in the document, and in what it saves.',
      es: 'Los muestra así. Los cambios siguen en el documento y en lo que guarda.',
      zh: '按该方式显示。更改仍保留在文档及其保存的内容中。',
    },
  },
  {
    sig: 'goToRevision(dir: 1 | -1) → boolean',
    text: {
      en: 'Selects the next change of the text being edited, or the one before. False when there is none.',
      es: 'Selecciona el siguiente cambio del texto que se edita, o el anterior. False cuando no hay ninguno.',
      zh: '选择正在编辑的文本中的下一处或上一处更改。没有更改时返回 false。',
    },
  },
  {
    sig: 'selectRevision(revision: RevisionView)',
    text: {
      en: 'Selects a change, going into its header, footer or note first.',
      es: 'Selecciona un cambio, entrando antes en su encabezado, pie de página o nota.',
      zh: '选择某处更改，必要时先进入其所在的页眉、页脚或脚注。',
    },
  },
];

/** RevisionView, as revisions.ts declares it. */
export const VIEW: { name: string; type: string; text: L }[] = [
  {
    name: 'type',
    type: "'insert' | 'delete' | 'format'",
    text: { en: 'Put in, taken out, or its formatting changed.', es: 'Puesto, quitado, o con su formato cambiado.', zh: '插入、删除或格式更改。' },
  },
  {
    name: 'author',
    type: 'string',
    text: {
      en: 'Who made it: the author of the editor, or "Anonymous" without one.',
      es: 'Quién lo hizo: el autor del editor, o "Anonymous" sin él.',
      zh: '更改者：编辑器的作者；没有作者时为 "Anonymous"。',
    },
  },
  { name: 'date', type: 'string?', text: { en: 'When, as ISO 8601, to the minute.', es: 'Cuándo, en ISO 8601, al minuto.', zh: '更改时间，ISO 8601 格式，精确到分钟。' } },
  {
    name: 'range',
    type: 'Range',
    text: {
      en: 'Where it is in the text of its part. A change to a paragraph mark ends at the start of the next paragraph.',
      es: 'Dónde está en el texto de su parte. Un cambio a una marca de párrafo termina al inicio del párrafo siguiente.',
      zh: '在所属部分文本中的位置。段落标记的更改结束于下一段的开头。',
    },
  },
  { name: 'text', type: 'string', text: { en: 'Its text, with ¶ for a paragraph mark.', es: 'Su texto, con ¶ para una marca de párrafo.', zh: '更改的文字，段落标记以 ¶ 表示。' } },
  {
    name: 'part',
    type: 'StoryPart?',
    text: {
      en: 'The header, footer or note it is in; the body when left out.',
      es: 'El encabezado, pie de página o nota donde está; el cuerpo si se omite.',
      zh: '所在的页眉、页脚或脚注；省略时为正文。',
    },
  },
  {
    name: 'move',
    type: 'string?',
    text: {
      en: 'The name of the move it is half of: where text left, taken out, or where it went, put in.',
      es: 'El nombre del movimiento del que es mitad: de donde salió el texto, quitado, o adonde fue, puesto.',
      zh: '所属移动的名称：文字移出的位置（删除），或移入的位置（插入）。',
    },
  },
  {
    name: 'format',
    type: 'string[]?',
    text: {
      en: 'For a change of formatting, what it changed: bold, fontSize, align…',
      es: 'Para un cambio de formato, qué cambió: bold, fontSize, align…',
      zh: '格式更改时，具体更改了什么：bold、fontSize、align…',
    },
  },
  { name: 'paragraph', type: 'true?', text: { en: 'A change of formatting of the whole paragraph.', es: 'Un cambio de formato de todo el párrafo.', zh: '整个段落的格式更改。' } },
  {
    name: 'row',
    type: 'true?',
    text: {
      en: 'A row of a table put in or taken out: its range is the row, its text that of its cells.',
      es: 'Una fila de una tabla puesta o quitada: su rango es la fila, su texto el de sus celdas.',
      zh: '插入或删除的表格行：范围是该行，文字是其单元格的文字。',
    },
  },
];

/** The functions of @rebodocs/core. */
export const CORE: { sig: string; text: L }[] = [
  {
    sig: 'trackEdit(before, after, by, { words? })',
    text: {
      en: 'Any edit to a text, tracked: what it took out comes back struck, what it put in is marked. Returns { doc, map } — map moves a position of after into the tracked doc.',
      es: 'Cualquier edición de un texto, controlada: lo que quitó vuelve tachado, lo que puso queda marcado. Devuelve { doc, map }: map lleva una posición de after al doc controlado.',
      zh: '把对文本的任意编辑记录为修订：删除的内容以删除线恢复，插入的内容被标记。返回 { doc, map }——map 把 after 中的位置映射到带修订的 doc 中。',
    },
  },
  {
    sig: 'trackDocEdit(before, after, by, words = true)',
    text: {
      en: 'The same for the whole document, with its headers, footers and notes, word by word.',
      es: 'Lo mismo para todo el documento, con sus encabezados, pies de página y notas, palabra por palabra.',
      zh: '对整个文档（包括页眉、页脚和脚注）执行同样的操作，逐词比较。',
    },
  },
  {
    sig: 'acceptRevisions(doc, range?, pick?)',
    text: {
      en: 'Accepts the changes in range, or all of the text; with pick, only those it takes, as one person’s or one kind.',
      es: 'Acepta los cambios de range, o de todo el texto; con pick, solo los que elige, como los de una persona o de un tipo.',
      zh: '接受 range 内或整个正文中的更改；提供 pick 时，只接受它选中的更改，例如某个人的或某一类的。',
    },
  },
  { sig: 'rejectRevisions(doc, range?, pick?)', text: { en: 'Rejects them.', es: 'Los rechaza.', zh: '拒绝这些更改。' } },
  {
    sig: 'decideAllRevisions(doc, accept, pick?)',
    text: {
      en: 'Every change, headers, footers, notes and text boxes included; with pick, only those it takes.',
      es: 'Todos los cambios, con encabezados, pies de página, notas y cuadros de texto; con pick, solo los que elige.',
      zh: '处理所有更改，包括页眉、页脚、脚注和文本框中的；提供 pick 时，只处理它选中的。',
    },
  },
  {
    sig: 'byAuthor(author) → pick',
    text: {
      en: 'The changes of one person: Word’s “Accept all changes by”.',
      es: 'Los cambios de una persona: el “Aceptar todos los cambios de” de Word.',
      zh: '某个人的更改：相当于 Word 的“接受某审阅者的所有修订”。',
    },
  },
  { sig: 'revisionsOf(doc) → RevisionView[]', text: { en: 'Every change of the document.', es: 'Todos los cambios del documento.', zh: '文档的所有更改。' } },
  { sig: 'hasRevisions(doc) → boolean', text: { en: 'Whether it has any.', es: 'Si tiene alguno.', zh: '是否有更改。' } },
  {
    sig: 'revisionColor(author) → string',
    text: {
      en: 'The colour of a person’s changes, always the same for the same name, as hex.',
      es: 'El color de los cambios de una persona, siempre el mismo para el mismo nombre, en hexadecimal.',
      zh: '某个人的更改颜色，同一名称始终相同，以十六进制表示。',
    },
  },
];

/** What the MCP server has for tracked changes, from tools.ts. */
export const TOOLS: { name: string; text: L }[] = [
  {
    name: 'track_changes',
    text: {
      en: 'Turns tracking on or off. While on, everything any tool changes is tracked.',
      es: 'Activa o desactiva el control. Mientras está activo, todo lo que cambia cualquier herramienta se controla.',
      zh: '开启或关闭修订。开启期间，任何工具做出的更改都会被记录。',
    },
  },
  {
    name: 'list_changes',
    text: {
      en: 'The changes, numbered: who, put in or taken out, the text and its paragraph.',
      es: 'Los cambios, numerados: quién, puesto o quitado, el texto y su párrafo.',
      zh: '编号列出更改：更改者、插入或删除、文字及所在段落。',
    },
  },
  {
    name: 'accept_changes',
    text: {
      en: 'Those of the numbers given, all of one person’s with author, or all.',
      es: 'Los de los números dados, todos los de una persona con author, o todos.',
      zh: '接受指定编号的更改、用 author 指定某人的全部更改，或全部更改。',
    },
  },
  { name: 'reject_changes', text: { en: 'The same, rejected.', es: 'Lo mismo, rechazados.', zh: '同上，改为拒绝。' } },
];
