// Contracts made up for the purpose, to measure the layout against Microsoft
// Word's where it is weakest: long documents of clauses, in the fonts both
// Word and this machine have (Times New Roman, Georgia, Verdana, Arial), with
// justified text, lists, long tables, sections, columns and text kept
// together. Each case leans on one of those; together they are what a
// contract is. They are written by the tools an assistant has, and by the
// core where no tool does it, so they are files the engine itself makes.
//
//   npm run contract-cases                          writes test-documents/contract-*.docx
//   npm run word-compare -- test-documents/contract-<case>.docx --word    Word's PDF of one, and its lines against ours
//
// The files go to test-documents/, with the PDF Word made of each: written again, a case needs Word's PDF again.

import { strToU8, zipSync } from 'fflate';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type Doc, type Paragraph, applyRunProps, createDoc, exportDocx, importDocx, insertSectionBreak, paragraphLength, setParagraphStyle } from '../packages/core/src/internal';
import { runTool } from '../packages/mcp/src/tools';

const OUT = resolve('test-documents');

const SENTENCES = [
  'Las partes reconocen que celebran el presente contrato de manera libre y sin que medie error, dolo, mala fe ni lesión alguna.',
  'El incumplimiento de cualquiera de las obligaciones aquí pactadas dará derecho a la parte afectada a exigir su cumplimiento forzoso o la rescisión.',
  'Cualquier modificación al presente instrumento deberá constar por escrito y estar firmada por ambas partes para que surta efectos.',
  'Los gastos, derechos e impuestos que se causen con motivo de la celebración del presente contrato serán cubiertos conforme a la ley.',
  'Para la interpretación y cumplimiento de lo pactado, las partes se someten a la jurisdicción de los tribunales competentes de la ciudad.',
  'El arrendatario se obliga a conservar el inmueble en el estado en que lo recibe, salvo el deterioro natural por el uso ordinario.',
  'Las notificaciones entre las partes se harán por escrito en los domicilios señalados en el apartado de declaraciones de este contrato.',
];
const ORDINALS = ['Primera', 'Segunda', 'Tercera', 'Cuarta', 'Quinta', 'Sexta', 'Séptima', 'Octava', 'Novena', 'Décima'];
const ordinal = (n: number) =>
  n <= 10 ? ORDINALS[n - 1] : `${['Décima', 'Vigésima', 'Trigésima', 'Cuadragésima'][Math.floor(n / 10) - 1]}${n % 10 ? ` ${ORDINALS[(n % 10) - 1].toLowerCase()}` : ''}`;
/** A paragraph of `count` sentences, starting at `from`: the same for the same numbers. */
const prose = (count: number, from: number) => Array.from({ length: count }, (_, i) => SENTENCES[(from + i) % SENTENCES.length]).join(' ');
const p = (text: string): Paragraph => ({ props: {}, runs: [{ text, props: {} }] });

/** Every run of the document, header and footer apart, in one font and size; headings a little larger and in bold. */
function inFont(doc: Doc, fontFamily: string, fontSize: number, headings: number[] = []): Doc {
  let next = doc;
  for (let i = 0; i < next.paragraphs.length; i++) {
    const length = paragraphLength(next.paragraphs[i]);
    if (!length) continue;
    const heading = headings.includes(i);
    next = applyRunProps(next, { from: { para: i, offset: 0 }, to: { para: i, offset: length } }, { fontFamily, fontSize: heading ? fontSize + 1 : fontSize, bold: heading || undefined });
  }
  return next;
}

/** Runs a tool of the assistant, which must change the document. */
const tool = (doc: Doc, name: string, args: Record<string, unknown>): Doc => {
  const result = runTool(doc, name, args);
  if (!result.doc) throw new Error(`${name} did not change the document: ${result.text}`);
  return result.doc;
};

/** A title, then `clauses` clauses: a heading each, and one paragraph or two of `sentences`. The paragraphs of the headings come back too. */
function clauses(title: string, count: number, sentences = 3): { doc: Doc; headings: number[] } {
  const paragraphs = [p(title)];
  const headings: number[] = [];
  for (let n = 1; n <= count; n++) {
    headings.push(paragraphs.length);
    paragraphs.push(p(`${ordinal(n)}. ${['Objeto', 'Plazo', 'Renta', 'Depósito', 'Mantenimiento', 'Notificaciones', 'Rescisión', 'Jurisdicción'][n % 8]}`));
    paragraphs.push(p(prose(sentences + (n % 3), n)));
    if (n % 4 === 0) paragraphs.push(p(prose(2, n + 3)));
  }
  let doc = setParagraphStyle(createDoc(paragraphs), 0, 0, 'Title');
  for (const h of headings) doc = setParagraphStyle(doc, h, h, 'Heading1');
  return { doc, headings };
}

// --- Written as Word writes it ----------------------------------------------------
// What the tools of an assistant do not make (cells apart, a table beside the text, a table in a cell, text on its side,
// a row set further in), written in WordprocessingML and read by the engine, which writes the file Word is given.

const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** A paragraph: its properties, and runs of text, a run given as [text, its properties]. */
const wp = (pPr: string, ...runs: (string | [string, string])[]) =>
  `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${runs.map((r) => (typeof r === 'string' ? `<w:r><w:t xml:space="preserve">${esc(r)}</w:t></w:r>` : `<w:r><w:rPr>${r[1]}</w:rPr><w:t xml:space="preserve">${esc(r[0])}</w:t></w:r>`)).join('')}</w:p>`;
const border = (side: string, val: string, size: number, color: string) => `<w:${side} w:val="${val}" w:sz="${size}" w:space="0" w:color="${color}"/>`;
const allBorders = (val: string, size: number, color: string) =>
  `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => border(s, val, size, color)).join('')}</w:tblBorders>`;
/** A cell: its width in twips, what else its properties say, and its paragraphs. */
const tc = (width: number, tcPr: string, ...content: string[]) => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${tcPr}</w:tcPr>${content.join('') || '<w:p/>'}</w:tc>`;
const tr = (trPr: string, ...cells: string[]) => `<w:tr>${trPr ? `<w:trPr>${trPr}</w:trPr>` : ''}${cells.join('')}</w:tr>`;
const tbl = (tblPr: string, grid: number[], ...rows: string[]) =>
  `<w:tbl><w:tblPr>${tblPr}<w:tblLook w:val="0000"/></w:tblPr><w:tblGrid>${grid.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.join('')}</w:tbl>`;
const shade = (fill: string) => `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>`;
const cellText = (text: string, rPr = '', pPr = '') => wp(`<w:pStyle w:val="TableText"/>${pPr}`, rPr ? [text, rPr] : text);
const WHITE_BOLD = '<w:b/><w:color w:val="FFFFFF"/>';

/** A whole package from the body of a document, its styles and lists. */
function wordPackage(body: string, sectPr: string): Uint8Array {
  const styles = `<w:styles ${W_NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="21"/><w:lang w:val="es-MX"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="1F3864"/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="60"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="23"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="19"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/></w:pPr><w:rPr><w:b/><w:color w:val="1F3864"/><w:sz w:val="18"/></w:rPr></w:style>
<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;
  const numbering = `<w:numbering ${W_NS}>
<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val=""/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr></w:lvl></w:abstractNum>
<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr><w:rPr><w:b/></w:rPr></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`;
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W_NS}><w:body>${body}${sectPr}</w:body></w:document>`;
  const rels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>';
  const types =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>';
  const root =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  return zipSync({
    '[Content_Types].xml': strToU8(types),
    '_rels/.rels': strToU8(root),
    'word/document.xml': strToU8(document),
    'word/_rels/document.xml.rels': strToU8(rels),
    'word/styles.xml': strToU8(styles),
    'word/numbering.xml': strToU8(numbering),
  });
}

const LETTER = '<w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/>';

/**
 * A lease's annex of tables in Arial, in every way a table of Word comes: a long one whose heading row goes on
 * each page, cells merged across and down, lines of each kind and rows of a height they keep, cells apart, a
 * table as wide as the text by a percentage with a row set further in, one beside the text, one inside a cell,
 * text on its side, lists in cells; then the text in two columns, broken by a column break.
 */
function tablesAnnex(): Doc {
  const body: string[] = [];
  const h1 = (t: string) => body.push(wp('<w:pStyle w:val="Heading1"/>', t));
  const h2 = (t: string) => body.push(wp('<w:pStyle w:val="Heading2"/>', t));
  const caption = (t: string) => body.push(wp('<w:pStyle w:val="Caption"/>', t));
  const text = (n: number, from: number) => body.push(wp('<w:jc w:val="both"/>', prose(n, from)));
  const grid = '8A9FC8';

  h1('ANEXO C. CUADROS DEL ARRENDAMIENTO');
  text(3, 0);
  // A long table: its heading row on each page, every other row shaded, amounts to the right.
  caption('Cuadro C.1. Calendario de rentas');
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const head = tr(
    '<w:tblHeader/>',
    ...[
      ['Mes', 1600],
      ['Vencimiento', 2200],
      ['Renta', 1800],
      ['Mantenimiento', 1800],
      ['Total', 2400],
    ].map(([t, w]) => tc(w as number, shade('1F3864'), cellText(t as string, WHITE_BOLD))),
  );
  const rows = Array.from({ length: 36 }, (_, i) => {
    const fill = i % 2 ? shade('EEF2F9') : '';
    const rent = 18500 + 500 * Math.floor(i / 12);
    const money = (n: number) => `$${n.toLocaleString('en-US')}.00`;
    return tr(
      '',
      tc(1600, fill, cellText(`${months[i % 12]} ${2027 + Math.floor(i / 12)}`)),
      tc(2200, fill, cellText(`día ${5 + (i % 3)} del mes`)),
      tc(1800, fill, cellText(money(rent), '', '<w:jc w:val="right"/>')),
      tc(1800, fill, cellText(money(1200), '', '<w:jc w:val="right"/>')),
      tc(2400, fill, cellText(money(rent + 1200), '<w:b/>', '<w:jc w:val="right"/>')),
    );
  });
  body.push(tbl(`<w:tblW w:w="9800" w:type="dxa"/>${allBorders('single', 4, grid)}`, [1600, 2200, 1800, 1800, 2400], head, ...rows));
  text(2, 3);

  // Merged across and down, the text in the middle and at the foot of what they cover.
  caption('Cuadro C.2. Áreas arrendadas');
  body.push(
    tbl(
      `<w:tblW w:w="9800" w:type="dxa"/>${allBorders('single', 4, '1F3864')}`,
      [2000, 2600, 2600, 2600],
      tr(
        '',
        tc(2000, `${shade('1F3864')}<w:vAlign w:val="center"/>`, cellText('Nivel', WHITE_BOLD)),
        tc(5200, `<w:gridSpan w:val="2"/>${shade('1F3864')}`, cellText('Locales', WHITE_BOLD, '<w:jc w:val="center"/>')),
        tc(2600, shade('1F3864'), cellText('Superficie', WHITE_BOLD)),
      ),
      tr(
        '<w:trHeight w:val="560"/>',
        tc(2000, `<w:vMerge w:val="restart"/><w:vAlign w:val="center"/>${shade('D9E2F3')}`, cellText('Planta baja', '<w:b/>')),
        tc(2600, '', cellText('Local A-1')),
        tc(2600, '', cellText('Local A-2')),
        tc(2600, '<w:vMerge w:val="restart"/><w:vAlign w:val="bottom"/>', cellText('420 m²', '', '<w:jc w:val="right"/>')),
      ),
      tr('<w:trHeight w:val="560"/>', tc(2000, '<w:vMerge/>'), tc(2600, '', cellText('Bodega B-1')), tc(2600, '', cellText('Bodega B-2')), tc(2600, '<w:vMerge/>')),
      tr('', tc(9800, `<w:gridSpan w:val="4"/>${shade('FBE5D6')}`, cellText('Las superficies se entienden aproximadas y se ajustan al levantamiento topográfico del anexo A.', '<w:i/>'))),
    ),
  );
  text(2, 5);

  // Lines of each kind, a row of a height it keeps whatever it holds, and one of at least a height.
  caption('Cuadro C.3. Inventario de llaves');
  const kinds: [string, string, number][] = [
    ['single', 'sencilla', 4],
    ['double', 'doble', 6],
    ['dashed', 'discontinua', 8],
    ['dotted', 'punteada', 8],
  ];
  body.push(
    tbl(
      '<w:tblW w:w="9800" w:type="dxa"/>',
      [2450, 2450, 2450, 2450],
      tr(
        '<w:trHeight w:val="600" w:hRule="exact"/>',
        ...kinds.map(([val, name, size]) =>
          tc(
            2450,
            `<w:tcBorders>${['top', 'left', 'bottom', 'right'].map((side) => border(side, val, size, '1F3864')).join('')}</w:tcBorders><w:vAlign w:val="center"/>`,
            cellText(`Línea ${name}`, '', '<w:jc w:val="center"/>'),
          ),
        ),
      ),
      tr(
        '<w:trHeight w:val="900"/>',
        ...kinds.map(([val, , size], i) =>
          tc(2450, `<w:tcBorders>${['top', 'left', 'bottom', 'right'].map((side) => border(side, val, size, '1F3864')).join('')}</w:tcBorders>`, cellText(`${4 + i} llaves`)),
        ),
      ),
    ),
  );
  text(2, 1);

  // Cells apart, each with its own lines, and the table its own round them.
  caption('Cuadro C.4. Contactos');
  body.push(
    tbl(
      `<w:tblW w:w="9800" w:type="dxa"/><w:tblCellSpacing w:w="40" w:type="dxa"/>${allBorders('single', 4, grid)}`,
      [3260, 3270, 3270],
      tr(
        '<w:tblCellSpacing w:w="40" w:type="dxa"/>',
        tc(3220, shade('EEF2F9'), cellText('Arrendador', '<w:b/>')),
        tc(3230, shade('D9E2F3'), cellText('Arrendatario', '<w:b/>')),
        tc(3230, shade('FBE5D6'), cellText('Administrador', '<w:b/>')),
      ),
      tr(
        '<w:tblCellSpacing w:w="40" w:type="dxa"/>',
        tc(3220, '', cellText('Inmobiliaria del Bajío, S.A.')),
        tc(3230, '', cellText('Comercial Andina, S. de R.L.')),
        tc(3230, '', cellText('Servicios Integrales del Centro')),
      ),
    ),
  );
  text(1, 4);

  // As wide as the text by a percentage, a row set further in by its grid.
  caption('Cuadro C.5. Presupuesto de mantenimiento');
  body.push(
    tbl(
      `<w:tblW w:w="5000" w:type="pct"/>${allBorders('single', 4, grid)}`,
      [2450, 2450, 2450, 2450],
      tr('', ...['Concepto', 'Presupuesto', 'Ejercido', 'Diferencia'].map((t) => tc(2450, shade('1F3864'), cellText(t, WHITE_BOLD)))),
      ...[
        ['Limpieza', '120,000', '118,450', '(1,550)'],
        ['Vigilancia', '240,000', '251,900', '11,900'],
        ['Jardinería', '60,000', '57,300', '(2,700)'],
      ].map((r) => tr('', ...r.map((t, k) => tc(2450, '', cellText(t, '', k ? '<w:jc w:val="right"/>' : ''))))),
      tr(
        '<w:gridBefore w:val="1"/><w:gridAfter w:val="1"/><w:wBefore w:w="2450" w:type="dxa"/><w:wAfter w:w="2450" w:type="dxa"/>',
        tc(4900, `<w:gridSpan w:val="2"/>${shade('D9E2F3')}`, cellText('Revisado por el comité de administración', '<w:i/>')),
      ),
    ),
  );
  text(1, 6);

  // One beside the text, at the right of the column.
  h2('Garantías');
  body.push(
    tbl(
      `<w:tblpPr w:leftFromText="180" w:rightFromText="0" w:bottomFromText="120" w:vertAnchor="text" w:horzAnchor="margin" w:tblpXSpec="right" w:tblpY="60"/><w:tblW w:w="3600" w:type="dxa"/>${allBorders('single', 4, '1F3864')}`,
      [1800, 1800],
      tr('', tc(1800, shade('1F3864'), cellText('Garantía', WHITE_BOLD)), tc(1800, shade('1F3864'), cellText('Monto', WHITE_BOLD))),
      tr('', tc(1800, '', cellText('Depósito')), tc(1800, '', cellText('$39,400.00', '', '<w:jc w:val="right"/>'))),
      tr('', tc(1800, '', cellText('Fianza')), tc(1800, '', cellText('$236,400.00', '', '<w:jc w:val="right"/>'))),
    ),
  );
  text(4, 2);
  text(3, 5);

  // A table inside a cell, text on its side, and lists in cells.
  caption('Cuadro C.6. Entregables');
  const inner = tbl(
    `<w:tblW w:w="2800" w:type="dxa"/>${allBorders('single', 2, grid)}`,
    [1400, 1400],
    tr('', tc(1400, '', cellText('Clave')), tc(1400, '', cellText('Valor'))),
    tr('', tc(1400, '', cellText('Uso')), tc(1400, '', cellText('Comercial'))),
  );
  const item = (numId: number, t: string) => wp(`<w:pStyle w:val="TableText"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr>`, t);
  body.push(
    tbl(
      `<w:tblW w:w="9800" w:type="dxa"/>${allBorders('single', 4, '1F3864')}`,
      [700, 3300, 3000, 2800],
      tr(
        '<w:cantSplit/>',
        tc(700, `<w:vMerge w:val="restart"/><w:textDirection w:val="btLr"/><w:vAlign w:val="center"/>${shade('D9E2F3')}`, cellText('Entrega', '<w:b/>', '<w:jc w:val="center"/>')),
        tc(3300, '', cellText('Documentos', '<w:b/>'), item(1, 'Escritura de propiedad'), item(1, 'Planos autorizados'), item(1, 'Constancia de uso de suelo')),
        tc(3000, '', cellText('Pasos', '<w:b/>'), item(2, 'Inspección conjunta'), item(2, 'Acta de entrega'), item(2, 'Entrega de llaves')),
        tc(2800, '', cellText('Datos del predio', '<w:b/>'), inner, cellText('')),
      ),
      tr(
        '<w:trHeight w:val="700"/>',
        tc(700, '<w:vMerge/>'),
        tc(3300, '<w:vAlign w:val="bottom"/>', cellText('Abajo de su celda')),
        tc(3000, '<w:vAlign w:val="center"/>', cellText('Al centro de su celda')),
        tc(2800, '', cellText('Arriba de su celda')),
      ),
    ),
  );
  text(2, 0);

  // The text in two columns, from here to the end of this part, broken where a column break says.
  body.push(wp(`<w:pStyle w:val="Heading2"/><w:sectPr><w:type w:val="continuous"/>${LETTER}<w:cols w:space="708"/></w:sectPr>`, 'Reglas de uso'));
  for (let i = 0; i < 3; i++) {
    h2(['Horarios', 'Accesos', 'Residuos'][i]);
    text(3 + (i % 2), i * 2);
  }
  body.push(wp('<w:pStyle w:val="TableText"/>', ['', '']).replace('<w:r><w:rPr></w:rPr><w:t xml:space="preserve"></w:t></w:r>', '<w:r><w:br w:type="column"/></w:r>'));
  for (let i = 0; i < 2; i++) {
    h2(['Mascotas', 'Obras'][i]);
    text(4, i + 3);
  }
  body.push(wp(`<w:jc w:val="both"/><w:sectPr><w:type w:val="continuous"/>${LETTER}<w:cols w:num="2" w:space="567" w:sep="1"/></w:sectPr>`, prose(2, 6)));
  text(3, 1);
  return importDocx(wordPackage(body.join(''), `<w:sectPr>${LETTER}<w:cols w:space="708"/></w:sectPr>`));
}

const CASES: Record<string, () => Doc> = {
  // Tables in every way Word makes them, and a part in two columns broken by a column break.
  'arial-tables': tablesAnnex,
  // Justified text in Times New Roman, at 1.15 lines, with space after each paragraph: where lines fall, page after page.
  'times-justified': () => {
    const { doc, headings } = clauses('CONTRATO DE ARRENDAMIENTO', 28, 3);
    let next = inFont(doc, 'Times New Roman', 12, headings);
    next = tool(next, 'format_paragraphs', { from: 2, to: next.paragraphs.length, align: 'justify', line_spacing: 1.15, space_after_pt: 6 });
    return tool(next, 'set_page_number', { place: 'footer', align: 'center' });
  },
  // Lists in Georgia: numbered obligations, each with lettered items under it, and space after each item.
  'georgia-lists': () => {
    const paragraphs = [p('OBLIGACIONES DE LAS PARTES')];
    const level: number[] = [];
    for (let n = 0; n < 24; n++) {
      paragraphs.push(p(prose(1 + (n % 2), n)));
      level.push(0);
      for (let k = 0; k < (n % 3) + 1; k++) {
        paragraphs.push(p(SENTENCES[(n + k) % SENTENCES.length]));
        level.push(1);
      }
    }
    let doc = inFont(setParagraphStyle(createDoc(paragraphs), 0, 0, 'Title'), 'Georgia', 11);
    doc = tool(doc, 'set_list', { from: 2, to: doc.paragraphs.length, kind: 'number' });
    doc = tool(doc, 'format_paragraphs', { from: 2, to: doc.paragraphs.length, space_after_pt: 4 });
    // The items under each obligation, one level in.
    const paragraphsNow = doc.paragraphs.slice();
    level.forEach((l, i) => {
      if (l) paragraphsNow[i + 1] = { ...paragraphsNow[i + 1], props: { ...paragraphsNow[i + 1].props, listLevel: 1 } };
    });
    return { ...doc, paragraphs: paragraphsNow };
  },
  // A table of amounts in Verdana, longer than a page, its heading row on every page; then the signatures.
  'verdana-tables': () => {
    const rows = [['Concepto', 'Periodo', 'Monto']];
    for (let i = 1; i <= 60; i++)
      rows.push([
        `${['Renta', 'Mantenimiento', 'Agua', 'Predial', 'Seguro'][i % 5]} ${i}`,
        `Mes ${((i - 1) % 12) + 1} de ${2026 + Math.floor((i - 1) / 12)}`,
        `$${(18_500 + i * 125).toLocaleString('en-US')}.00`,
      ]);
    let doc = createDoc([p('ANEXO A. CALENDARIO DE PAGOS'), p(prose(3, 1)), p('En constancia, las partes firman.')]);
    doc = tool(doc, 'insert_table', { after_paragraph: 2, header: true, rows });
    doc = tool(doc, 'insert_signatures', { after_paragraph: doc.paragraphs.length, titles: ['EL ARRENDADOR', 'EL ARRENDATARIO'], names: ['Rodrigo Ibarra Soto', 'Mariana Quintero Solís'] });
    return inFont(setParagraphStyle(doc, 0, 0, 'Title'), 'Verdana', 10);
  },
  // Two sections in Arial: the contract on letter paper, upright; its annex across the page, with other margins.
  'arial-sections': () => {
    const { doc, headings } = clauses('CONTRATO DE PRESTACIÓN DE SERVICIOS', 12, 3);
    let next = doc;
    const annex = next.paragraphs.length;
    next = { ...next, paragraphs: [...next.paragraphs, p('ANEXO B. ALCANCE DE LOS SERVICIOS'), ...Array.from({ length: 10 }, (_, i) => p(prose(4, i)))] };
    next = insertSectionBreak(next, { para: annex - 1, offset: paragraphLength(next.paragraphs[annex - 1]) }).doc;
    next = inFont(next, 'Arial', 11, headings);
    next = tool(next, 'set_page_setup', { section: 1, paper: 'letter', orientation: 'portrait', margin_top_cm: 2.5, margin_bottom_cm: 2.5, margin_left_cm: 3, margin_right_cm: 2.5 });
    next = tool(next, 'set_page_setup', { section: 2, paper: 'letter', orientation: 'landscape', margin_top_cm: 2, margin_bottom_cm: 2, margin_left_cm: 2, margin_right_cm: 2 });
    return tool(next, 'set_page_number', { place: 'footer', align: 'right' });
  },
  // Columns in Times New Roman: the clauses across the page, then a glossary in two columns, then across again.
  'times-columns': () => {
    const { doc, headings } = clauses('CONTRATO DE COMPRAVENTA', 6, 3);
    const from = doc.paragraphs.length;
    const terms = Array.from({ length: 24 }, (_, i) => p(`${['Inmueble', 'Precio', 'Arras', 'Escritura', 'Notario', 'Gravamen'][i % 6]} ${i + 1}: ${SENTENCES[i % SENTENCES.length]}`));
    let next = { ...doc, paragraphs: [...doc.paragraphs, p('GLOSARIO'), ...terms, p('CIERRE'), p(prose(4, 2)), p(prose(3, 5))] };
    next = inFont(next, 'Times New Roman', 11, [...headings, from, from + terms.length + 1]);
    return tool(next, 'set_columns', { from: from + 2, to: from + 1 + terms.length, count: 2, space_cm: 1, separator: true });
  },
  // Notes at the end, in Times New Roman: after the last clause, under their line, going on to a page of their own.
  'times-endnotes': () => {
    const { doc, headings } = clauses('CONTRATO DE ARRENDAMIENTO', 9, 3);
    let next = inFont(doc, 'Times New Roman', 12, headings);
    const notes = [
      [2, 'Conforme al artículo 2398 del Código Civil aplicable.'],
      [6, 'El depósito se devuelve dentro de los treinta días siguientes a la entrega del inmueble, descontados los adeudos que hubiera.'],
      [10, 'Las partes podrán convenir por escrito una prórroga. ' + prose(6, 2)],
      [14, 'Véase el anexo A.'],
    ] as const;
    // From the last, so that the paragraphs before keep their numbers.
    for (const [para, text] of [...notes].reverse()) next = tool(next, 'insert_endnote', { at_paragraph: para, text });
    return tool(next, 'set_page_number', { place: 'footer', align: 'center' });
  },
  // Notes at the end that do not fit after the text: they go on to a page of their own, a note cut across the two.
  'times-endnotes-long': () => {
    const { doc, headings } = clauses('CONTRATO DE ARRENDAMIENTO', 12, 3);
    let next = inFont(doc, 'Times New Roman', 12, headings);
    const notes = [
      [2, prose(8, 1)],
      [6, prose(12, 3)],
      [10, prose(16, 5)],
      [14, 'Véase el anexo A.'],
    ] as const;
    for (const [para, text] of [...notes].reverse()) next = tool(next, 'insert_endnote', { at_paragraph: para, text });
    return tool(next, 'set_page_number', { place: 'footer', align: 'center' });
  },
  // Notes at the end of each section, in Times New Roman: the contract's after its clauses, crossing a page, then the annex
  // that follows on that page leaves its notes to the last, which starts a page of its own.
  'times-endnotes-sections': () => {
    const { doc, headings } = clauses('CONTRATO DE ARRENDAMIENTO', 9, 3);
    const annexA = doc.paragraphs.length;
    let next: Doc = { ...doc, paragraphs: [...doc.paragraphs, p('ANEXO A. INVENTARIO'), p(prose(4, 2)), p(prose(3, 6))] };
    const annexB = next.paragraphs.length;
    next = { ...next, paragraphs: [...next.paragraphs, p('ANEXO B. REGLAMENTO'), p(prose(5, 4)), p(prose(2, 1))] };
    next = inFont(next, 'Times New Roman', 12, [...headings, annexA, annexB]);
    const notes = [
      [2, prose(6, 1)],
      [10, prose(10, 3)],
      [headings[8] + 1, prose(8, 5)],
      [annexA + 1, 'Según el acta de entrega.'],
      [annexB + 1, 'El reglamento vigente a la firma.'],
    ] as const;
    for (const [para, text] of [...notes].reverse()) next = tool(next, 'insert_endnote', { at_paragraph: para, text });
    // From the last, so that the paragraphs before keep their numbers.
    next = insertSectionBreak(next, { para: annexB - 1, offset: paragraphLength(next.paragraphs[annexB - 1]) }).doc;
    next = insertSectionBreak(next, { para: annexA - 1, offset: paragraphLength(next.paragraphs[annexA - 1]) }, 'continuous').doc;
    // The annex A is the second section: its mark is the last paragraph before the annex B.
    const paragraphs = next.paragraphs.slice();
    const mark = paragraphs.findIndex((para, i) => i > annexA && para.section);
    paragraphs[mark] = { ...paragraphs[mark], section: { ...paragraphs[mark].section!, noEndnotes: true } };
    return { ...next, paragraphs, endnotesAt: 'sections' };
  },
  // Kept together, in Arial: paragraphs that must not be cut, headings kept with their text, and a clause that starts a page.
  'arial-keep': () => {
    const { doc, headings } = clauses('CONVENIO DE CONFIDENCIALIDAD', 20, 4);
    let next = inFont(doc, 'Arial', 11, headings);
    next = tool(next, 'format_paragraphs', { from: 2, to: next.paragraphs.length, space_after_pt: 10, line_spacing: 1.08 });
    for (let i = 2; i < next.paragraphs.length; i += 3) if (!headings.includes(i)) next = tool(next, 'format_paragraphs', { from: i + 1, keep_lines_together: true });
    // The tenth clause on a page of its own start.
    const tenth = headings[9];
    const paragraphs = next.paragraphs.slice();
    paragraphs[tenth] = { ...paragraphs[tenth], props: { ...paragraphs[tenth].props, pageBreakBefore: true } };
    return { ...next, paragraphs };
  },
};

mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
for (const [name, build] of Object.entries(CASES)) {
  if (only.length && !only.includes(name)) continue;
  const file = join(OUT, `contract-${name}.docx`);
  writeFileSync(file, exportDocx(build()));
  console.log(`Wrote ${file}`);
}
