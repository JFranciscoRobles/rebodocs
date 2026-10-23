// The document the playground opens with: a short tour of what the editor
// does, built with the same operations the editor uses, so that each part of
// it is something to try.

import {
  type Doc,
  type ListKind,
  type Paragraph,
  type Run,
  type RunProps,
  addNote,
  applyRunProps,
  createDoc,
  insertSignatures,
  insertTable,
  insertText,
  insertToc,
  paragraphLength,
  setLink,
  setCellProps,
  setPageNumbering,
  setParagraphStyle,
  toggleList,
} from '@rebodocs/core';

/** A paragraph of the tour: its style, the list it is in, or the table that goes in its place. */
interface Block {
  runs: Run[];
  style?: string;
  list?: ListKind;
  props?: Paragraph['props'];
  table?: string[][];
  /** Who signs, for the block of signatures that goes in its place. */
  signatures?: string[];
}

const run = (text: string, props: RunProps = {}): Run => ({ text, props });
const code = (text: string) => run(text, { fontFamily: 'Courier New', highlight: 'F1F3F4' });
const text = (...parts: (string | Run)[]): Run[] => parts.map((part) => (typeof part === 'string' ? run(part) : part));
const block = (runs: (string | Run)[], rest: Omit<Block, 'runs'> = {}): Block => ({ runs: text(...runs), ...rest });
const heading = (title: string, style = 'Heading1') => block([title], { style });
const bullet = (...parts: (string | Run)[]) => block(parts, { list: 'bullet' });
const step = (...parts: (string | Run)[]) => block(parts, { list: 'number' });

const BLOCKS: Block[] = [
  block(['Motor de documentos'], { style: 'Title' }),
  block(['Un editor de DOCX para el navegador, con motor propio'], { style: 'Subtitle' }),
  block([
    'Este documento es de prueba: todo lo que ves se puede editar, y cada apartado enseña algo que el editor sabe hacer. ',
    'Abre un archivo de Word con el menú de la izquierda, o empieza a escribir aquí mismo.',
  ]),

  heading('Formato de texto'),
  block([
    'El texto puede ir en ',
    run('negrita', { bold: true }),
    ', ',
    run('cursiva', { italic: true }),
    ', ',
    run('subrayado', { underline: true }),
    ', ',
    run('tachado', { strike: true }),
    ', en ',
    run('color', { color: 'C0392B' }),
    ', ',
    run('resaltado', { highlight: 'FFFF00' }),
    ' o con otra ',
    run('fuente y tamaño', { fontFamily: 'Georgia', fontSize: 15 }),
    ', todo en la misma línea. También puede ser un enlace, como este a la página de Office Open XML, el formato de los archivos de Word: ',
    'con ⌘ y un clic se abre.',
  ]),
  block(
    [
      'Los párrafos se alinean a la izquierda, al centro, a la derecha o justificados, como este, que reparte el espacio entre las palabras para que los dos bordes queden rectos. ',
      'La regla de arriba mueve las sangrías y los márgenes, y la barra de abajo cambia el zoom y la vista de las páginas.',
    ],
    { props: { align: 'justify', indentFirstLine: 18 } },
  ),

  heading('Acciones con ⌘'),
  block([
    'Selecciona algo —un texto, una variable, una imagen, las celdas de una tabla— o deja el cursor en una línea vacía, y da un toque a la tecla ⌘ sola ',
    '(Ctrl fuera de Mac). Junto a la selección sale una barrita con lo que se puede hacer justo ahí: dar formato, insertar una tabla o unas firmas, ',
    'convertir un texto en variable, ponerle una nota o hacerlo un enlace (también con ⌘K).',
  ]),

  heading('Atajos al escribir'),
  block(['En una línea nueva, prueba a teclear lo siguiente:']),
  bullet(code('# '), ', ', code('## '), ' o ', code('### '), ' y un espacio, para un título.'),
  bullet(code('- '), ' para una lista con viñetas, o ', code('1. '), ' para una numerada.'),
  bullet(code('**texto**'), ' para negrita, ', code('*texto*'), ' para cursiva y ', code('~~texto~~'), ' para tachado.'),
  block(['Si no querías la conversión, ⌘Z justo después deja lo que tecleaste.']),

  heading('Esquema del documento'),
  block([
    'El segundo botón de la barra abre un panel lateral. Su pestaña ',
    run('Esquema', { bold: true }),
    ' lista estos títulos: un clic te lleva a cada uno, y arrastrar uno sobre otro mueve su apartado entero.',
  ]),
  block([
    'El índice del principio sale de esos mismos títulos, con la página de cada uno. Un clic en una entrada lleva a su apartado, y el botón ',
    '«Actualizar índice» que aparece sobre él lo pone al día cuando cambias los títulos; en Word es una tabla de contenido normal.',
  ]),

  heading('Plantilla con variables'),
  block([
    'Una variable es un hueco para un dato, escrito entre llaves dobles. En la pestaña ',
    run('Variables', { bold: true }),
    ' del panel se les da valor y formato, y «Rellenar documento» las sustituye todas. Este recibo es una plantilla:',
  ]),
  heading('Recibo de pago', 'Heading2'),
  block(
    [
      'En {{ciudad | nombre propio}}, a {{fecha | fecha larga}}, {{cliente | mayúsculas | negrita}} entrega a {{proveedor | nombre propio}} ',
      'la cantidad de {{importe | moneda}} por concepto de {{concepto | minúsculas}}.',
    ],
    { props: { align: 'justify' } },
  ),
  block([], {
    table: [
      ['Concepto', 'Dato', 'Cómo se escribe'],
      ['Cliente', '{{cliente}}', 'Tal cual se da'],
      ['Fecha', '{{fecha | fecha}}', 'Día/mes/año'],
      ['Importe', '{{importe | número: 2}}', 'Con dos decimales'],
    ],
  }),
  block([], { signatures: ['CLIENTE', 'PROVEEDOR'] }),
  block(['Para probarlo, usa por ejemplo estos valores:']),
  step('ciudad: ', code('guadalajara')),
  step('fecha: ', code('hoy'), ' o ', code('2026-10-12')),
  step('cliente: ', code('ana pérez'), ', proveedor: ', code('servicios del norte')),
  step('importe: ', code('15000'), ', concepto: ', code('Asesoría de Octubre')),

  heading('Notas'),
  block([
    'Una nota es un comentario sobre un trozo del texto, como ',
    'esta frase resaltada',
    '. Pasa el ratón por encima para leerla, o pulsa el botón ',
    run('Notas al margen', { bold: true }),
    ' de la barra de abajo para verlas todas a la derecha de la página. Se añaden desde la pestaña Notas del panel, o con ⌘ sobre un texto seleccionado, ',
    'y cada una puede tener su color. En el archivo son comentarios de Word.',
  ]),

  heading('Tablas e imágenes'),
  block([
    'Las tablas nuevas salen del menú Insertar de la barra. En la del recibo, arrastra el borde de una columna para cambiar su ancho, o selecciona varias celdas y combínalas desde el menú de tabla. ',
    'El mismo menú oculta los bordes de toda la tabla: así están hechas las firmas de arriba, que son una tabla sin bordes.',
  ]),
  block([
    'Insertar › Imagen pone una foto, que después se mueve y se cambia de tamaño con el ratón. Si eliges varias a la vez, ',
    'se abre un diálogo para ordenarlas arrastrando y decidir cuántas van por fila, y entran todas juntas en cuadrícula.',
  ]),

  heading('Guardar y exportar'),
  block([
    'El menú guarda en Word, PDF o Markdown. Un DOCX abierto se guarda sin pérdida: lo que no tocas se escribe byte a byte como estaba. ',
    'El encabezado y el pie se editan con doble clic, y el número de página de abajo se actualiza solo. ',
    'En el mismo menú se configura la página y se cambia el idioma de la interfaz.',
  ]),

  heading('Paginación'),
  ...Array.from({ length: 4 }, (_, i) =>
    block(
      [
        'Este párrafo existe para comprobar el corte de líneas y la paginación del motor. Cada línea se mide con las métricas reales de la fuente, ' +
          'se parte en los espacios y, cuando ya no cabe en la página, pasa a la siguiente. Un título nunca se queda solo al final de una página: ' +
          'baja con el párrafo que lo sigue.',
      ],
      { props: { align: i % 2 ? 'justify' : 'left', indentFirstLine: 18 } },
    ),
  ),
];

const HEADER_SHADE = 'E8EEF9';

/** Puts a table of `cells` at an empty paragraph, its first row as a heading. */
function addTable(doc: Doc, para: number, cells: string[][]): Doc {
  let next = insertTable(doc, { para, offset: 0 }, cells.length, cells[0].length).doc;
  const first = next.paragraphs.findIndex((p, i) => i >= para && p.cell);
  const flat = cells.flat();
  // From the last cell back, though a cell is one paragraph and nothing moves.
  for (let i = flat.length - 1; i >= 0; i--) next = insertText(next, { para: first + i, offset: 0 }, flat[i]).doc;
  const lastOfRow = first + cells[0].length - 1;
  next = setCellProps(next, first, lastOfRow, { shade: HEADER_SHADE });
  return applyRunProps(next, { from: { para: first, offset: 0 }, to: { para: lastOfRow, offset: cells[0][cells[0].length - 1].length } }, { bold: true });
}

/** Puts a block of signatures at an empty paragraph, each name a variable of the template. */
function addSignatures(doc: Doc, para: number, titles: string[]): Doc {
  const names = titles.map((title) => `{{${title.toLowerCase()} | mayúsculas}}`);
  const made = insertSignatures(doc, { para, offset: 0 }, titles, names[0]).doc;
  // Each cell has its title, its line and its name: the name is the third paragraph of each.
  const first = made.paragraphs.findIndex((p, i) => i >= para && p.cell);
  const paragraphs = made.paragraphs.map((p, i) => {
    const cell = Math.floor((i - first) / 3);
    if (i < first || cell >= titles.length || (i - first) % 3 !== 2) return p;
    return { ...p, runs: [{ ...p.runs[0], text: names[cell] }] };
  });
  return { ...made, paragraphs };
}

/** The notes of the tour: the text each is on, what it says and its colour. */
const NOTES: [string, string, string][] = [
  ['esta frase resaltada', 'Esto es una nota. En Word se ve como un comentario al margen.', 'F4B400'],
  ['Notas al margen', 'Es el botón de la barra de abajo con una página y unas líneas a su derecha.', '4285F4'],
  ['{{importe | moneda}}', 'Las notas sirven para revisar una plantilla antes de usarla: ¿el importe lleva IVA?', '34A853'],
];

/** The paragraph the table of contents goes after. */
const INTRO = 2;

/** The texts that are links, and where each goes. */
const LINKS: [string, string][] = [['Office Open XML', 'https://es.wikipedia.org/wiki/Office_Open_XML']];

function addLinks(doc: Doc): Doc {
  let next = doc;
  for (const [text, href] of LINKS) {
    const para = next.paragraphs.findIndex((p) =>
      p.runs
        .map((r) => r.text)
        .join('')
        .includes(text),
    );
    if (para < 0) continue;
    const offset = next.paragraphs[para].runs
      .map((r) => r.text)
      .join('')
      .indexOf(text);
    next = setLink(next, { from: { para, offset }, to: { para, offset: offset + text.length } }, href);
  }
  return next;
}

/** Puts each note of `NOTES` on the first place its text is found. */
function addNotes(doc: Doc): Doc {
  let next = doc;
  for (const [text, note, color] of NOTES) {
    const para = next.paragraphs.findIndex((p) =>
      p.runs
        .map((r) => r.text)
        .join('')
        .includes(text),
    );
    if (para < 0) continue;
    const offset = next.paragraphs[para].runs
      .map((r) => r.text)
      .join('')
      .indexOf(text);
    next = addNote(next, { from: { para, offset }, to: { para, offset: offset + text.length } }, { text: note, author: 'Docs', date: '2026-10-12T12:00:00Z', color }).doc;
  }
  return next;
}

export function sampleDoc(): Doc {
  let doc = createDoc(BLOCKS.map((b) => ({ props: b.props ?? {}, runs: b.runs.length ? b.runs : [run('')] })));
  BLOCKS.forEach((b, i) => {
    if (b.style) doc = setParagraphStyle(doc, i, i, b.style);
  });
  // Each stretch of list items at once, so that a numbered one counts on.
  for (let i = 0; i < BLOCKS.length; i++) {
    const kind = BLOCKS[i].list;
    if (!kind) continue;
    let end = i;
    while (BLOCKS[end + 1]?.list === kind) end++;
    doc = toggleList(doc, i, end, kind);
    i = end;
  }
  // Last, for a table adds paragraphs and the indexes above are those of the blocks.
  for (let i = BLOCKS.length - 1; i >= 0; i--) {
    const { table, signatures } = BLOCKS[i];
    if (table) doc = addTable(doc, i, table);
    if (signatures) doc = addSignatures(doc, i, signatures);
  }
  doc = { ...doc, header: { paragraphs: [{ props: { align: 'right' }, runs: [run('Documento de prueba · {{cliente | nombre propio}}', { fontSize: 9, color: '666666' })] }] } };
  // After the opening words. The pages are for whoever lays the document out to give: the editor, as it opens it.
  const intro = { para: INTRO, offset: paragraphLength(doc.paragraphs[INTRO]) };
  doc = insertToc(doc, intro, { title: 'Índice', pageOf: () => 1 }).doc;
  doc = addNotes(addLinks(setPageNumbering(doc, { place: 'footer', align: 'center', format: 'pageOfTotal', words: { page: 'Página', of: 'de' } })));
  return withLongContract(doc);
}

// --- A long document ------------------------------------------------------------

/** The sentences the clauses of the long contract are made of, each used in its turn. */
const SENTENCES = [
  'El arrendatario se obliga a pagar la renta pactada dentro de los primeros cinco días de cada mes, en el domicilio del arrendador o en la cuenta bancaria que este le indique por escrito.',
  'Cualquier modificación al presente contrato deberá constar por escrito y estar firmada por ambas partes; ningún acuerdo verbal tendrá efectos entre ellas.',
  'El inmueble se entrega en buen estado de conservación, con las instalaciones eléctricas, hidráulicas y de gas funcionando, según el inventario que se anexa y que forma parte de este contrato.',
  'Las reparaciones menores que se deriven del uso normal del inmueble correrán por cuenta del arrendatario; las mayores, y las que afecten la estructura, por cuenta del arrendador.',
  'Queda prohibido subarrendar el inmueble, en todo o en parte, así como ceder los derechos de este contrato, sin el consentimiento previo y por escrito del arrendador.',
  'El arrendatario podrá dar por terminado el contrato antes de su vencimiento, avisando con treinta días de anticipación y pagando la renta del mes en que se desocupe el inmueble.',
  'Los servicios de agua, energía eléctrica, gas, teléfono e internet serán pagados por el arrendatario desde la fecha de entrega del inmueble y hasta su devolución.',
  'Para garantizar el cumplimiento de sus obligaciones, el arrendatario entrega en este acto un depósito equivalente a un mes de renta, que le será devuelto al término del contrato.',
  'El arrendador podrá visitar el inmueble para verificar su estado, previo aviso con al menos veinticuatro horas de anticipación y en horario de oficina.',
  'Al terminar el contrato, el arrendatario devolverá el inmueble en el estado en que lo recibió, salvo el desgaste natural por el paso del tiempo y el uso adecuado.',
  'Para la interpretación y cumplimiento del presente contrato, las partes se someten a las leyes y a los tribunales de la ciudad en que se encuentra el inmueble.',
  'Las notificaciones entre las partes se harán por escrito en los domicilios señalados en el proemio, o por correo electrónico a las direcciones que cada una designe.',
];
const TOPICS = ['Renta', 'Plazo', 'Depósito', 'Servicios', 'Mantenimiento', 'Mejoras', 'Seguros', 'Visitas', 'Terminación', 'Notificaciones', 'Penas convencionales', 'Jurisdicción'];
/** As many clauses as make the whole document about a hundred pages. */
const CLAUSES = 202;

/**
 * After the tour, a lease of a hundred pages: to see that a long document
 * opens, scrolls and is typed in as fast as a short one, and to try spelling
 * on text that is spelled right. A heading for it alone, so that the table of
 * contents and the outline stay short; each clause with its title in bold,
 * kept with its first paragraph, and a table of payments every twenty.
 */
function withLongContract(doc: Doc): Doc {
  const paragraphs: Paragraph[] = [
    { props: { pageBreakBefore: true }, runs: [run('Anexo: un contrato largo')] },
    {
      props: {},
      runs: [
        run(
          'Un contrato de arrendamiento de cien páginas, para ver que un documento largo se abre, se recorre y se escribe tan rápido como uno corto: solo las páginas que están a la vista tienen su texto.',
        ),
      ],
    },
  ];
  const tables: number[] = [];
  for (let i = 0; i < CLAUSES; i++) {
    paragraphs.push({ props: { spacingBefore: 12, keepNext: true }, runs: [run(`Cláusula ${i + 1}. ${TOPICS[i % TOPICS.length]}`, { bold: true })] });
    for (let k = 0; k < 4; k++) {
      const at = (i * 5 + k * 3) % SENTENCES.length;
      paragraphs.push({ props: { align: 'justify' }, runs: [run(`${SENTENCES[at]} ${SENTENCES[(at + 7) % SENTENCES.length]}`)] });
    }
    if (i % 20 === 19) {
      tables.push(doc.paragraphs.length + paragraphs.length);
      paragraphs.push({ props: {}, runs: [run('')] });
    }
  }
  const start = doc.paragraphs.length;
  let next: Doc = { ...doc, paragraphs: [...doc.paragraphs, ...paragraphs] };
  next = setParagraphStyle(next, start, start, 'Heading1');
  // From the last back: a table adds paragraphs, and the places before it stay where they are.
  for (const para of tables.reverse()) {
    next = addTable(next, para, [
      ['Mes', 'Renta', 'Servicios', 'Total'],
      ['Enero', '$12,500.00', '$1,830.00', '$14,330.00'],
      ['Febrero', '$12,500.00', '$1,764.00', '$14,264.00'],
      ['Marzo', '$12,500.00', '$1,902.00', '$14,402.00'],
    ]);
  }
  return next;
}
