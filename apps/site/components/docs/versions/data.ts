// What the page "Versions" says that is data, each checked in
// packages/core/src/versions.ts (compareDocs, restoreVersion, describeChange),
// packages/editor/src/versions.ts (Versions, createVersionView), panel.ts (the
// Versions tab), packages/react/src/mount.ts (asked again after a save) and
// packages/mcp/src/tools.ts (compare_documents). Each text in each language of the
// site.

import { type Doc, type Paragraph, applyRunProps, createDoc, paragraphText, setParagraphStyle } from '@rebodocs/core';
import type { L } from '@/lib/i18n';

const para = (text: string): Paragraph => ({ props: {}, runs: [{ text, props: {} }] });

/** A receipt of a few lines, the first of them its title. */
function receipt(lines: string[]): Doc {
  return setParagraphStyle(createDoc(lines.map(para)), 0, 0, 'Title');
}

export interface Kept {
  id: string;
  date: string;
  author: string;
  label?: string;
  doc: Doc;
}

/** The lines of each version and of the document now, in each language of the site. */
const LINES: L<{ v1: string[]; v2: string[]; now: string[]; labels: [string, string] }> = {
  en: {
    v1: ['Reservation receipt', 'Payment is due within 15 days of this receipt.', 'Late payments add a fee.', 'Either party may cancel by phone or in writing.'],
    v2: ['Reservation receipt', 'Payment is due within 30 days of this receipt.', 'Late payments add a fee of 2% a month.', 'Either party may cancel by phone or in writing.', 'Prices include taxes.'],
    now: [
      'Reservation receipt for room 12',
      'Payment is due within 30 days of this receipt.',
      'Late payments add a fee of 2% a month.',
      'Either party may cancel in writing.',
      'Keys are returned at the front desk.',
    ],
    labels: ['First draft', 'Sent to the client'],
  },
  es: {
    v1: ['Recibo de reservación', 'El pago vence a los 15 días de este recibo.', 'Los pagos tardíos suman un recargo.', 'Cualquiera de las partes puede cancelar por teléfono o por escrito.'],
    v2: [
      'Recibo de reservación',
      'El pago vence a los 30 días de este recibo.',
      'Los pagos tardíos suman un recargo del 2% mensual.',
      'Cualquiera de las partes puede cancelar por teléfono o por escrito.',
      'Los precios incluyen impuestos.',
    ],
    now: [
      'Recibo de reservación de la habitación 12',
      'El pago vence a los 30 días de este recibo.',
      'Los pagos tardíos suman un recargo del 2% mensual.',
      'Cualquiera de las partes puede cancelar por escrito.',
      'Las llaves se devuelven en la recepción.',
    ],
    labels: ['Primer borrador', 'Enviado al cliente'],
  },
  zh: {
    v1: ['预订收据', '应在本收据开具后 15 天内付款。', '逾期付款将加收费用。', '任何一方均可通过电话或书面形式取消。'],
    v2: ['预订收据', '应在本收据开具后 30 天内付款。', '逾期付款每月加收 2% 的费用。', '任何一方均可通过电话或书面形式取消。', '价格已含税。'],
    now: ['12 号房间预订收据', '应在本收据开具后 30 天内付款。', '逾期付款每月加收 2% 的费用。', '任何一方均可书面取消。', '钥匙请交还前台。'],
    labels: ['初稿', '已发送给客户'],
  },
};

const each = <T>(fn: (lines: (typeof LINES)['en']) => T): L<T> => ({ en: fn(LINES.en), es: fn(LINES.es), zh: fn(LINES.zh) });

/** The versions the demo's application has kept, the oldest first. */
export const KEPT: L<Kept[]> = each(({ v1, v2, labels }) => [
  { id: 'v1', date: '2026-10-12T10:05:00', author: 'Ana', label: labels[0], doc: receipt(v1) },
  { id: 'v2', date: '2026-10-15T16:40:00', author: 'Luis', label: labels[1], doc: receipt(v2) },
]);

/** The document as it is now: changed since the last version, and its line on late payments made bold. */
export const CURRENT: L<Doc> = each(({ now }) => {
  const doc = receipt(now);
  const at = 2;
  return applyRunProps(doc, { from: { para: at, offset: 0 }, to: { para: at, offset: paragraphText(doc.paragraphs[at]).length } }, { bold: true });
});

/** What the application gives the editor, as packages/editor/src/versions.ts declares it. */
export const MEMBERS: { sig: string; text: L }[] = [
  {
    sig: 'list() → Promise<VersionInfo[]>',
    text: {
      en: 'The versions there are, in any order: the tab shows the newest first, those without a date last. Asked for each time the tab is opened, after a version is saved, and after each save of the document.',
      es: 'Las versiones que hay, en cualquier orden: la pestaña muestra primero la más nueva y al final las que no tienen fecha. Se pide cada vez que se abre la pestaña, después de guardar una versión y después de cada guardado del documento.',
      zh: '现有的版本，顺序不限：选项卡会把最新的排在最前，没有日期的排在最后。每次打开选项卡、保存版本之后以及每次保存文档之后都会调用。',
    },
  },
  {
    sig: 'load(id) → Promise<Uint8Array | ArrayBuffer>',
    text: {
      en: 'One version, as the bytes of its DOCX. A version does not change, so each one is read once; one that could not be read is asked for again the next time.',
      es: 'Una versión, como los bytes de su DOCX. Una versión no cambia, así que cada una se lee una vez; una que no se pudo leer se vuelve a pedir la siguiente vez.',
      zh: '某个版本，以其 DOCX 字节形式提供。版本不会改变，所以每个版本只读取一次；读取失败的版本会在下次重新请求。',
    },
  },
  {
    sig: 'save?(docx, { label?, author? }) → Promise',
    text: {
      en: 'Optional. Keeps the document as it is now, with the name typed for it and the editor’s author. With it the tab has Save version; without it, versions are kept when your application keeps them.',
      es: 'Opcional. Guarda el documento tal como está, con el nombre que se le escribió y el autor del editor. Con él la pestaña tiene Guardar versión; sin él, las versiones se guardan cuando tu aplicación las guarda.',
      zh: '可选。以输入的名称和编辑器的作者保存文档当前的状态。提供它时，选项卡中会有“保存版本”；不提供时，版本由你的应用自行保存。',
    },
  },
];

/** VersionInfo. */
export const INFO: { name: string; type: string; text: L }[] = [
  {
    name: 'id',
    type: 'string',
    text: {
      en: 'What your application knows the version by, given back to load.',
      es: 'Con lo que tu aplicación identifica la versión; se devuelve a load.',
      zh: '你的应用用来识别该版本的标识，会传回给 load。',
    },
  },
  {
    name: 'date',
    type: 'string?',
    text: {
      en: 'When it was kept, as an ISO date: shown in the language of the interface, and the order of the list.',
      es: 'Cuándo se guardó, como fecha ISO: se muestra en el idioma de la interfaz y da el orden de la lista.',
      zh: '保存时间，ISO 日期格式：按界面语言显示，并决定列表的顺序。',
    },
  },
  { name: 'author', type: 'string?', text: { en: 'Who kept it.', es: 'Quién la guardó.', zh: '保存者。' } },
  {
    name: 'label',
    type: 'string?',
    text: { en: 'Its name. Without one, the list calls it by its date.', es: 'Su nombre. Sin él, la lista la llama por su fecha.', zh: '版本名称。没有名称时，列表用日期来称呼它。' },
  },
];

/** What compareDocs gives. */
export const COMPARISON: { name: string; type: string; text: L }[] = [
  {
    name: 'changes',
    type: 'Change[]',
    text: {
      en: 'One for each paragraph put in (added), taken out (removed), changed (changed), or with the same text and another look (formatted). Each has before and after, its index in each version, and part when it is in a header, a footer, a note at the foot of the page or a text box.',
      es: 'Uno por cada párrafo puesto (added), quitado (removed), cambiado (changed), o con el mismo texto y otro aspecto (formatted). Cada uno tiene before y after, su índice en cada versión, y part cuando está en un encabezado, un pie de página, una nota al pie o un cuadro de texto.',
      zh: '每个插入（added）、删除（removed）、修改（changed）或文字相同但格式不同（formatted）的段落各对应一项。每项都有 before 和 after、在各版本中的索引；位于页眉、页脚、脚注或文本框中时还有 part。',
    },
  },
  {
    name: 'notes',
    type: 'NoteChange[]',
    text: {
      en: 'The notes on the text written (added), taken out (removed) or whose text changed (changed), each by author and date, which Word keeps when it saves, though not the id. Listed, not marked in doc.',
      es: 'Las notas sobre el texto escritas (added), quitadas (removed) o cuyo texto cambió (changed), cada una por autor y fecha, que Word conserva al guardar, aunque no el id. Se listan, no se marcan en doc.',
      zh: '新增（added）、删除（removed）或文字被修改（changed）的批注，按作者和日期识别（Word 保存时会保留这两项，但不保留 id）。只列出，不在 doc 中标记。',
    },
  },
  {
    name: 'doc',
    type: 'Doc',
    text: {
      en: 'The later version with the changes marked, as the editor shows it. It lays out, prints and exports to PDF like any document; it is for reading, not for editing or keeping.',
      es: 'La versión posterior con los cambios marcados, como la muestra el editor. Se compone, se imprime y se exporta a PDF como cualquier documento; es para leer, no para editar ni guardar.',
      zh: '标记了更改的较新版本，与编辑器中显示的一样。它可以像任何文档一样排版、打印和导出为 PDF；它用于阅读，而不是编辑或保存。',
    },
  },
  {
    name: 'marks',
    type: '{ part?, pos }[]',
    text: {
      en: 'Where each change starts in doc, for going from one to the next.',
      es: 'Dónde empieza cada cambio en doc, para ir de uno al siguiente.',
      zh: '每处更改在 doc 中的起始位置，用于逐个跳转。',
    },
  },
];

/** The functions, of core and of the editor. */
export const FUNCTIONS: { sig: string; text: L }[] = [
  {
    sig: 'compareDocs(before, after) → Comparison',
    text: {
      en: 'What changed from one version to another: paragraph by paragraph and, inside one that changed, word by word, in the text, its headers, footers, notes at the foot of the page and text boxes; and the notes on the text. Tracked changes are taken as accepted, as Word compares.',
      es: 'Lo que cambió de una versión a otra: párrafo por párrafo y, dentro de uno que cambió, palabra por palabra, en el texto, sus encabezados, pies de página, notas al pie y cuadros de texto; y las notas sobre el texto. Los cambios con control se toman como aceptados, como compara Word.',
      zh: '从一个版本到另一个版本的变化：逐段比较，在有变化的段落内再逐词比较，范围包括正文、页眉、页脚、脚注和文本框，以及批注。修订视为已接受，与 Word 的比较方式相同。',
    },
  },
  {
    sig: 'describeChange(change, context = 40) → string',
    text: {
      en: 'A change, of a paragraph or of a note, as plain text: [-taken out-], {+put in+}, a picture as [image], and up to context letters of what is around it.',
      es: 'Un cambio, de un párrafo o de una nota, como texto plano: [-quitado-], {+puesto+}, una imagen como [image], y hasta context letras de lo que lo rodea.',
      zh: '把段落或批注的更改描述为纯文本：[-删除的-]、{+插入的+}，图片显示为 [image]，并附上周围最多 context 个字符。',
    },
  },
  {
    sig: 'restoreVersion(current, version) → Doc',
    text: {
      en: 'The document to put in place of current: the version, with the current paragraphs wherever they are the same.',
      es: 'El documento que poner en lugar de current: la versión, con los párrafos actuales dondequiera que sean iguales.',
      zh: '用来替换 current 的文档：即该版本，但在段落相同之处保留当前的段落。',
    },
  },
  {
    sig: 'editor.restoreVersion(doc)',
    text: { en: 'The same, on the editor, as one step to undo.', es: 'Lo mismo, en el editor, como un paso para deshacer.', zh: '在编辑器上执行同样的操作，可一步撤销。' },
  },
  {
    sig: 'loadVersion(versions, id) → Promise<Doc>',
    text: {
      en: 'A version, read once. From @rebodocs/editor and @rebodocs/react.',
      es: 'Una versión, leída una vez. De @rebodocs/editor y @rebodocs/react.',
      zh: '读取某个版本（只读取一次）。来自 @rebodocs/editor 和 @rebodocs/react。',
    },
  },
  {
    sig: 'createVersionView(editor, versions, { onRestore?, onError? })',
    text: {
      en: 'The comparison over the pages of an editor, for a list of versions of your own: show(from, to?), close().',
      es: 'La comparación sobre las páginas de un editor, para una lista de versiones propia: show(from, to?), close().',
      zh: '在编辑器页面上显示比较结果，适用于你自己的版本列表：show(from, to?)、close()。',
    },
  },
];
