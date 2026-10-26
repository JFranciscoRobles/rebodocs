// Writes the document the editor on the landing page opens with: a receipt
// that is also a template, short enough to read at a glance and with one of
// each thing worth trying: variables, a change Claude suggested, a comment,
// a note at the foot of the page, lists, a link, a table and signatures.
// Made with the same operations the editor uses.
//
//   npm run demo -w @rebodocs/site     → public/demo.docx, demo-es.docx and demo-zh.docx, one for each language of the site

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  type Doc,
  type Run,
  type RunProps,
  addNote,
  applyRunProps,
  createDoc,
  exportDocx,
  findAll,
  insertFootnote,
  insertLink,
  insertSignatures,
  insertTable,
  insertText,
  replaceRange,
  setCellProps,
  setListStyle,
  setPageNumbering,
  setParagraphStyle,
  toggleList,
  trackDocEdit,
} from '../../../packages/core/src/index';
import type { Locale } from '../lib/i18n';

const run = (text: string, props: RunProps = {}): Run => ({ text, props });
const bold = (text: string) => run(text, { bold: true });

type Line = { runs: Run[]; style?: string; list?: 'bullet' | 'number'; align?: 'justify' | 'right' | 'center' };

/** What the receipt says in a language, and the words the steps below look for in it. */
interface Content {
  file: string;
  language: string;
  lines: Line[];
  table: string[][];
  signers: [string, string];
  fullName: string;
  /** The words a footnote goes after, and the note. */
  footnote: [string, string];
  /** The variable a comment is on, and the comment. */
  comment: [string, string];
  header: string;
  /** The days Claude changes, what it changes them to, the words after which it adds the way to pay, and that way. */
  change: { from: string; to: string; after: string; add: string };
  guide: string;
}

const CONTENT: Record<Locale, Content> = {
  en: {
    file: 'demo.docx',
    language: 'en-US',
    lines: [
      { runs: [run('Reservation receipt')], style: 'Title' },
      { runs: [run('A real DOCX, open in the real editor. Change anything: nothing leaves your browser.')], style: 'Subtitle' },
      { runs: [run('{{city}}, {{date}}', { italic: true })], align: 'right' },
      {
        runs: [
          run('Received from '),
          bold('{{client | capital}}'),
          run(' the amount of '),
          bold('{{amount | currency}}'),
          run(' as a deposit to reserve the property known as '),
          bold('{{property}}'),
          run('. The deposit is credited to the price on signing, and the balance is paid within 30 days.'),
        ],
        align: 'justify',
      },
      { runs: [run('Terms')], style: 'Heading1' },
      { runs: [run('The property is taken off the market from the date of this receipt.')], list: 'number' },
      { runs: [run('Either party may cancel in writing before the date of signing.')], list: 'number' },
      { runs: [run('Both parties sign below in agreement.')], list: 'number' },
      { runs: [run('Try it')], style: 'Heading1' },
      { runs: [run('Select a word and make it '), bold('bold'), run(', '), run('red', { color: 'C0392B' }), run(' or '), run('highlighted', { highlight: 'FFF176' }), run('.')], list: 'bullet' },
      { runs: [run('Claude suggested a change above: accept or reject it from Review.')], list: 'bullet' },
      { runs: [run('Open the side panel to fill the variables, answer Ana’s comment, and save a version to compare.')], list: 'bullet' },
      { runs: [run('Open the menu: load your own .docx, export a PDF, set a letterhead.')], list: 'bullet' },
      { runs: [run('Add rows to the table below with Tab in its last cell. Everything here is in the guide, at ')], list: 'bullet' },
      { runs: [run('')] },
      { runs: [run('')] },
    ],
    table: [
      ['Concept', 'Due', 'Amount'],
      ['Deposit', 'Today', '{{amount | currency}}'],
      ['Balance', 'On signing', '{{balance | currency}}'],
    ],
    signers: ['Received by', 'Agreed by'],
    fullName: 'FULL NAME',
    footnote: ['on signing', 'If the sale does not go ahead for a reason of the seller, the deposit is returned in full.'],
    comment: ['{{property}}', 'Check the cadastral reference before we send it.'],
    header: 'Rebodocs · sample document',
    change: { from: '30', to: '15', after: '15 days', add: ', by bank transfer' },
    guide: 'https://rebodocs.com/docs/',
  },
  es: {
    file: 'demo-es.docx',
    language: 'es-MX',
    lines: [
      { runs: [run('Recibo de apartado')], style: 'Title' },
      { runs: [run('Un DOCX real, abierto en el editor real. Cambia lo que quieras: nada sale de tu navegador.')], style: 'Subtitle' },
      { runs: [run('{{ciudad}}, {{fecha | fecha larga}}', { italic: true })], align: 'right' },
      {
        runs: [
          run('Recibí de '),
          bold('{{cliente | nombre propio}}'),
          run(' la cantidad de '),
          bold('{{importe | moneda}}'),
          run(' como anticipo para apartar el inmueble conocido como '),
          bold('{{inmueble}}'),
          run('. El anticipo se abona al precio al firmar, y el saldo se paga en un plazo de 30 días.'),
        ],
        align: 'justify',
      },
      { runs: [run('Condiciones')], style: 'Heading1' },
      { runs: [run('El inmueble se retira del mercado a partir de la fecha de este recibo.')], list: 'number' },
      { runs: [run('Cualquiera de las partes puede cancelar por escrito antes de la fecha de firma.')], list: 'number' },
      { runs: [run('Ambas partes firman abajo de conformidad.')], list: 'number' },
      { runs: [run('Pruébalo')], style: 'Heading1' },
      {
        runs: [run('Selecciona una palabra y ponla en '), bold('negrita'), run(', en '), run('rojo', { color: 'C0392B' }), run(' o '), run('resaltada', { highlight: 'FFF176' }), run('.')],
        list: 'bullet',
      },
      { runs: [run('Claude sugirió un cambio arriba: acéptalo o recházalo desde Revisar.')], list: 'bullet' },
      { runs: [run('Abre el panel lateral para llenar las variables, responder el comentario de Ana y guardar una versión para comparar.')], list: 'bullet' },
      { runs: [run('Abre el menú: carga tu propio .docx, exporta un PDF, pon un membrete.')], list: 'bullet' },
      { runs: [run('Agrega filas a la tabla de abajo con Tab en su última celda. Todo esto está en la guía, en ')], list: 'bullet' },
      { runs: [run('')] },
      { runs: [run('')] },
    ],
    table: [
      ['Concepto', 'Vence', 'Importe'],
      ['Anticipo', 'Hoy', '{{importe | moneda}}'],
      ['Saldo', 'Al firmar', '{{saldo | moneda}}'],
    ],
    signers: ['Recibió', 'De conformidad'],
    fullName: 'NOMBRE COMPLETO',
    footnote: ['al firmar', 'Si la venta no se realiza por causa del vendedor, el anticipo se devuelve íntegro.'],
    comment: ['{{inmueble}}', 'Revisar la clave catastral antes de enviarlo.'],
    header: 'Rebodocs · documento de ejemplo',
    change: { from: '30', to: '15', after: '15 días', add: ', por transferencia bancaria' },
    guide: 'https://rebodocs.com/es/docs/',
  },
  zh: {
    file: 'demo-zh.docx',
    language: 'zh-CN',
    lines: [
      { runs: [run('预订定金收据')], style: 'Title' },
      { runs: [run('这是一份真实的 DOCX，在真实的编辑器中打开。随意修改：所有内容都不会离开你的浏览器。')], style: 'Subtitle' },
      { runs: [run('{{城市}}，{{日期 | 长日期}}', { italic: true })], align: 'right' },
      {
        runs: [run('今收到'), bold('{{客户}}'), run('交来人民币'), bold('{{金额 | 货币: CNY}}'), run('，作为预订'), bold('{{房产}}'), run('的定金。定金于签约时抵作房款，余款应在 30 天内付清。')],
        align: 'justify',
      },
      { runs: [run('条款')], style: 'Heading1' },
      { runs: [run('自本收据开具之日起，该房产不再对外出售。')], list: 'number' },
      { runs: [run('任何一方均可在签约日前以书面形式取消。')], list: 'number' },
      { runs: [run('双方同意并在下方签字。')], list: 'number' },
      { runs: [run('试一试')], style: 'Heading1' },
      { runs: [run('选中一个词，把它设为'), bold('加粗'), run('、'), run('红色', { color: 'C0392B' }), run('或'), run('突出显示', { highlight: 'FFF176' }), run('。')], list: 'bullet' },
      { runs: [run('Claude 在上文提出了一处修订：可在“审阅”中接受或拒绝。')], list: 'bullet' },
      { runs: [run('打开侧边栏填写变量、回复 Ana 的批注，并保存一个版本用于对比。')], list: 'bullet' },
      { runs: [run('打开菜单：载入你自己的 .docx、导出 PDF、设置信头。')], list: 'bullet' },
      { runs: [run('在下表最后一个单元格中按 Tab 可添加新行。这里的一切都写在指南中：')], list: 'bullet' },
      { runs: [run('')] },
      { runs: [run('')] },
    ],
    table: [
      ['项目', '到期', '金额'],
      ['定金', '今天', '{{金额 | 货币: CNY}}'],
      ['余款', '签约时', '{{余款 | 货币: CNY}}'],
    ],
    signers: ['收款人', '确认人'],
    fullName: '姓名',
    footnote: ['签约时', '如因卖方原因未能成交，定金全额退还。'],
    comment: ['{{房产}}', '发送前请核对不动产权证号。'],
    header: 'Rebodocs · 示例文档',
    change: { from: '30', to: '15', after: '15 天', add: '，以银行转账方式' },
    guide: 'https://rebodocs.com/zh/docs/',
  },
};

/** Where `text` first is in the document. */
const find = (doc: Doc, text: string) => {
  const range = findAll(doc, text, { matchCase: true })[0];
  if (!range) throw new Error(`"${text}" is not in the document.`);
  return range;
};

function demoDoc(content: Content): Doc {
  const { lines, table: rows } = content;
  let doc = createDoc(lines.map((line) => ({ props: line.align ? { align: line.align } : {}, runs: line.runs })));
  lines.forEach((line, i) => {
    if (line.style) doc = setParagraphStyle(doc, i, i, line.style);
  });
  for (const kind of ['number', 'bullet'] as const) {
    const first = lines.findIndex((line) => line.list === kind);
    const last = lines.length - 1 - [...lines].reverse().findIndex((line) => line.list === kind);
    doc = toggleList(doc, first, last, kind);
    // The terms go by letter: a), b), c).
    if (kind === 'number') doc = setListStyle(doc, first, last, { format: 'lowerLetter', text: '#)' });
  }

  // From the end back, so the places above stay where they are.
  doc = insertSignatures(doc, { para: lines.length - 1, offset: 0 }, content.signers, content.fullName).doc;
  const table = lines.length - 2;
  doc = insertTable(doc, { para: table, offset: 0 }, rows.length, rows[0].length).doc;
  const cell = doc.paragraphs.findIndex((p, i) => i >= table && p.cell);
  const cells = rows.flat();
  for (let i = cells.length - 1; i >= 0; i--) doc = insertText(doc, { para: cell + i, offset: 0 }, cells[i]).doc;
  const head = cell + rows[0].length - 1;
  doc = setCellProps(doc, cell, head, { shade: 'E8EEF9' });
  doc = applyRunProps(doc, { from: { para: cell, offset: 0 }, to: { para: head, offset: rows[0][rows[0].length - 1].length } }, { bold: true });

  const guide = lines.length - 3;
  doc = insertLink(doc, { para: guide, offset: doc.paragraphs[guide].runs.reduce((n, r) => n + r.text.length, 0) }, content.guide.replace('https://', '').replace(/\/$/, ''), content.guide).doc;
  doc = insertText(doc, { para: guide, offset: doc.paragraphs[guide].runs.reduce((n, r) => n + r.text.length, 0) }, content.language.startsWith('zh') ? '。' : '.').doc;

  doc = insertFootnote(doc, find(doc, content.footnote[0]).to, content.footnote[1]).doc;
  doc = addNote(doc, find(doc, content.comment[0]), { text: content.comment[1], author: 'Ana', date: '2026-10-20T09:30:00Z' }).doc;

  doc = { ...doc, header: { paragraphs: [{ props: { align: 'right' }, runs: [run(content.header, { fontSize: 9, color: '777777' })] }] } };
  doc = setPageNumbering(doc, { place: 'footer', align: 'center', format: 'pageOfTotal' });

  // Last, the change Claude suggested: 30 days down to 15, and how to pay.
  const { change } = content;
  let after = replaceRange(doc, find(doc, change.from), change.to).doc;
  after = insertText(after, find(after, change.after).to, change.add).doc;
  return trackDocEdit(doc, after, { author: 'Claude', date: '2026-10-20T10:00:00Z' });
}

for (const content of Object.values(CONTENT)) {
  const out = fileURLToPath(new URL(`../public/${content.file}`, import.meta.url));
  writeFileSync(out, exportDocx(demoDoc(content), { language: content.language }));
  console.log(`${content.file}: ${out}`);
}
