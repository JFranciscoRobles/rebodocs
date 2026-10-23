// The cases of the assistant's evaluation: a document, what a person asks of
// it, and a check of the document the assistant leaves, not of what it says
// it did. The documents are made up, so that nothing is answered from memory;
// the asks are said as an adviser of the CRM would say them, in Spanish.
// Some ask for no change at all: an assistant that changes everything should
// not pass those.

import {
  type Doc,
  FontMeasurer,
  type Paragraph,
  createDoc,
  layoutDocument,
  listKindAt,
  listLabels,
  locateCell,
  paragraphText,
  resolveRun,
  revisionsOf,
  setParagraphStyle,
  styleIdAt,
  toggleList,
  variableNames,
} from '@rebodocs/core/internal';
import { fontsFor } from '../../packages/mcp/src/fonts';
import { _ordinals } from '../../packages/mcp/src/tools/clauses';
import { runTool } from '../../packages/mcp/src/tools';

export interface Case {
  id: string;
  /** What the case is about, for the report. */
  about: string;
  ask: string;
  doc(): Doc;
  /** Whether the document left behind is right, and why not when it is not. `answer` is all the assistant said. */
  check(after: Doc, before: Doc, answer: string): { pass: boolean; why?: string };
  /** Harder: several steps, a long document, or a part of it besides its text. */
  hard?: boolean;
  /** It lays the document out to check it, with the fonts of this machine. */
  needsFonts?: boolean;
}

const p = (text: string, bold?: string): Paragraph => {
  if (!bold || !text.includes(bold)) return { props: {}, runs: [{ text, props: {} }] };
  const at = text.indexOf(bold);
  return {
    props: {},
    runs: [
      { text: text.slice(0, at), props: {} },
      { text: bold, props: { bold: true } },
      { text: text.slice(at + bold.length), props: {} },
    ].filter((run) => run.text),
  };
};
const texts = (doc: Doc) => doc.paragraphs.map((para) => paragraphText(para).replace(/⁠/g, ''));
const all = (doc: Doc) => texts(doc).join('\n');
const styled = (doc: Doc, styles: [number, string][]) => styles.reduce((now, [para, style]) => setParagraphStyle(now, para, para, style), doc);
const ok = (pass: boolean, why: string) => (pass ? { pass } : { pass, why });
const same = (a: Doc, b: Doc) => all(a) === all(b);

/** A lease with clauses as headings, the way the CRM's templates are. */
function lease(): Doc {
  return styled(
    createDoc([
      p('CONTRATO DE ARRENDAMIENTO'),
      p('Primera. Objeto'),
      p('El arrendador da en arrendamiento al arrendatario el inmueble ubicado en Calle Ficticia 123, Colonia Inventada.'),
      p('Segunda. Plazo'),
      p('El plazo del arrendamiento es de 12 meses, contados a partir de la firma.'),
      p('Tercera. Renta'),
      p('El arrendatario pagará al arrendador una renta mensual de $18,500.00, los primeros cinco días de cada mes.'),
      p('Cuarta. Penalización'),
      p('Si el arrendatario se retrasa en el pago, pagará una penalización del 10% de la renta.'),
      p('Quinta. Jurisdicción'),
      p('Para todo lo relativo a este contrato, las partes se someten a los tribunales de la ciudad.'),
    ]),
    [
      [0, 'Title'],
      [1, 'Heading1'],
      [3, 'Heading1'],
      [5, 'Heading1'],
      [7, 'Heading1'],
      [9, 'Heading1'],
    ],
  );
}

function template(): Doc {
  return styled(
    createDoc([
      p('RECIBO DE APARTADO'),
      p('Recibí de {{cliente}} la cantidad de {{importe | moneda}} como apartado del inmueble {{inmueble}}.'),
      p('Fecha: {{fecha | fecha larga}}'),
      p('Asesor: {{asesor}}'),
    ]),
    [[0, 'Title']],
  );
}

/** The text a document reads as, its deletions taken out: what a tracked change leaves to read. */
const reads = (doc: Doc) =>
  doc.paragraphs.map((para) =>
    para.runs
      .filter((run) => run.props.revision !== 'delete')
      .map((run) => run.text)
      .join('')
      .replace(/\u2060/g, ''),
  );

/** The text of each cell of the first table, row by row: the paragraphs of a cell that say something, joined. */
function tableRows(doc: Doc): string[][] {
  const rows = new Map<number, Map<number, string[]>>();
  doc.paragraphs.forEach((para, i) => {
    const at = para.cell ? locateCell(doc, i) : undefined;
    if (!at || at.tableIndex !== 0) return;
    const row = rows.get(at.rowIndex) ?? new Map<number, string[]>();
    const text = paragraphText(para).trim();
    row.set(at.cellIndex, [...(row.get(at.cellIndex) ?? []), ...(text ? [text] : [])]);
    rows.set(at.rowIndex, row);
  });
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, cells]) => [...cells.entries()].sort((a, b) => a[0] - b[0]).map(([, parts]) => parts.join(' ')));
}

const layout = (doc: Doc) => layoutDocument(doc, new FontMeasurer(fontsFor(doc)));

/** The pages the lines of the first table are on, from 1. */
function tablePages(doc: Doc): number[] {
  const pages = new Set<number>();
  for (const line of layout(doc).lines) if (doc.paragraphs[line.para]?.cell && locateCell(doc, line.para)?.tableIndex === 0) pages.add(line.page + 1);
  return [...pages].sort((a, b) => a - b);
}

/** A long agreement: 45 clauses, a heading and a paragraph each, several of them with the same term in days. */
function longAgreement(): Doc {
  const topics = ['Objeto', 'Definiciones', 'Vigencia', 'Precio', 'Forma de pago', 'Facturación', 'Impuestos', 'Entregas', 'Inspección', 'Garantía'];
  const paragraphs: Paragraph[] = [p('CONTRATO MARCO DE SERVICIOS INMOBILIARIOS')];
  for (let n = 1; n <= 45; n++) {
    const topic = n === 37 ? 'Notificaciones' : `${topics[n % topics.length]} (${n})`;
    paragraphs.push(p(`Cláusula ${n}. ${topic}`));
    const days = n % 4 === 1 || n === 37 ? ' Cualquier aviso relativo a esta cláusula se hará con 15 días naturales de anticipación.' : '';
    paragraphs.push(p(`Las partes acuerdan lo relativo a ${topic.toLowerCase()} conforme a lo que aquí se dispone, y a lo que la ley aplicable señala en lo no previsto.${days}`));
  }
  return styled(createDoc(paragraphs), [[0, 'Title'], ...paragraphs.map((_, i) => [i, 'Heading1'] as [number, string]).filter(([i]) => i % 2 === 1)]);
}

/** A lease with two people's tracked changes in it: Laura's raises the rent, Pedro's shortens the term. */
function reviewed(): Doc {
  let doc: Doc = { ...lease(), trackRevisions: true };
  const at = new Date('2026-10-20T10:00:00Z');
  doc = runTool(doc, 'replace_text', { find: '$18,500.00', replace: '$19,000.00' }, { reviser: 'Laura Méndez', now: at }).doc!;
  doc = runTool(doc, 'replace_text', { find: '12 meses', replace: '6 meses' }, { reviser: 'Pedro Ruiz', now: at }).doc!;
  const { trackRevisions: _, ...rest } = doc;
  return rest;
}

function withHeader(): Doc {
  return { ...lease(), header: { paragraphs: [p('Inmobiliaria Ejemplo — Contrato')] }, footer: { paragraphs: [p('Calle Ficticia 99, Ciudad')] } };
}

function obligations(): Doc {
  const doc = createDoc([
    p('Obligaciones del arrendatario'),
    p('Pagar la renta a tiempo'),
    p('Cuidar el inmueble'),
    p('No subarrendar'),
    p('Avisar de cualquier daño'),
    p('Lo demás se rige por la ley.'),
  ]);
  return toggleList(styled(doc, [[0, 'Heading1']]), 1, 4, 'number');
}

function costs(): Doc {
  return runTool(createDoc([p('Costos mensuales'), p('Todos los montos incluyen IVA.')]), 'insert_table', {
    after_paragraph: 1,
    header: true,
    rows: [
      ['Concepto', 'Monto'],
      ['Renta', '$18,500'],
      ['Estacionamiento', '$1,500'],
      ['Agua', '$300'],
    ],
  }).doc!;
}

/** A contract whose block of signatures is cut by the end of a page, laid out with the fonts of this machine: as many paragraphs before it as that takes. */
function splitSignatures(): Doc {
  for (let filler = 1; filler < 80; filler++) {
    const paragraphs = [p('CONTRATO DE PRESTACIÓN DE SERVICIOS')];
    for (let i = 1; i <= filler; i++) paragraphs.push(p(`${i}. El prestador realizará los servicios pactados con diligencia y en los plazos acordados por las partes.`));
    paragraphs.push(p('En constancia, las partes firman este contrato.'));
    const doc = runTool(styled(createDoc(paragraphs), [[0, 'Title']]), 'insert_signatures', {
      after_paragraph: paragraphs.length,
      titles: ['EL PRESTADOR', 'EL CLIENTE'],
      names: ['Rodrigo Ibarra', 'Mariana Quintero'],
    }).doc!;
    if (tablePages(doc).length > 1) return doc;
  }
  throw new Error('No length of the contract cuts its signatures with the fonts of this machine.');
}

/** The document without its first `k` clauses: the page each line of its signatures is on, and the page its last clause ends on. */
function layoutAfterCut(doc: Doc, k: number): { table: number[]; lastClause: number } | undefined {
  const clauses = doc.paragraphs.map((para, i) => (/^\d+\. El prestador/.test(paragraphText(para)) ? i : -1)).filter((i) => i >= 0);
  if (clauses.length <= k) return undefined;
  const cut = new Set(clauses.slice(0, k));
  // The paragraphs go and the tables stay, so that the cells of the signatures still name their table.
  const shorter: Doc = { ...doc, paragraphs: doc.paragraphs.filter((_, i) => !cut.has(i)) };
  const last = shorter.paragraphs.findIndex((para) => para === doc.paragraphs[clauses[clauses.length - 1]]);
  const laid = layout(shorter);
  const lastClause = Math.max(...laid.lines.filter((line) => line.para === last).map((line) => line.page + 1));
  return { table: tablePages(shorter), lastClause };
}

const bodyText = (doc: Doc) =>
  texts(doc)
    .filter((line) => line.trim() && line.trim() !== '\f')
    .join('\n')
    .replace(/\f/g, '');

export const CASES: Case[] = [
  {
    id: 'fill-template',
    about: 'Fills the variables of a template from what the person says',
    ask: 'Llena el recibo: el cliente es Mariana Quintero Solís, el importe es 25000, el inmueble es Torre Alcatraz depto 1204, la fecha es el 3 de noviembre de 2026 y el asesor soy yo, Rodrigo Ibarra.',
    doc: template,
    check(after) {
      const left = variableNames(after);
      const text = all(after);
      if (left.length) return ok(false, `variables left: ${left.join(', ')}`);
      return ok(
        ['Mariana Quintero Solís', 'Torre Alcatraz', 'Rodrigo Ibarra', '25'].every((part) => text.includes(part)),
        `text: ${text}`,
      );
    },
  },
  {
    id: 'clause-after-third',
    about: 'Inserts a clause in the right place, as a heading and its text, and the clauses after it are numbered again',
    ask: 'Agrega una cláusula de confidencialidad después de la tercera, con su título como las demás, y que la numeración de las cláusulas quede correcta.',
    doc: lease,
    check(after) {
      // Every clause numbered in order: Primera, Segunda… with no number twice.
      const clauses = texts(after).filter((_, i) => i > 0 && styleIdAt(after, i) === 'Heading1');
      const numbers = clauses.map((line) => _ordinals.parseOrdinal(line.split('.')[0].trim())?.value ?? 0);
      if (numbers.join(',') !== clauses.map((_, i) => i + 1).join(',')) return ok(false, `the clauses read: ${clauses.join(' / ')}`);
      const t = texts(after);
      const third = t.findIndex((line) => line.startsWith('Tercera'));
      const fourth = t.findIndex((line) => /Penalización/.test(line) && styleIdAt(after, t.indexOf(line)) === 'Heading1');
      const heading = t.findIndex((line, i) => /confidencial/i.test(line) && styleIdAt(after, i) === 'Heading1');
      if (heading < 0) return ok(false, 'no heading about confidentiality');
      if (!(heading > third && (fourth < 0 || heading < fourth))) return ok(false, `heading at ${heading + 1}, third at ${third + 1}, fourth at ${fourth + 1}`);
      return ok(
        t.slice(heading + 1).some((line, i) => /confidencial/i.test(line) && styleIdAt(after, heading + 1 + i) !== 'Heading1'),
        'no text under the heading',
      );
    },
  },
  {
    id: 'remove-clause',
    about: 'Takes a clause out, heading and text, and nothing else',
    ask: 'Quita la cláusula de penalización completa.',
    doc: lease,
    check(after, before) {
      if (/penaliza/i.test(all(after))) return ok(false, 'the penalty is still there');
      return ok(after.paragraphs.length === before.paragraphs.length - 2, `${before.paragraphs.length} paragraphs before, ${after.paragraphs.length} after`);
    },
  },
  {
    id: 'replace-everywhere',
    about: 'Changes a word everywhere it is, in every form',
    ask: 'En todo el contrato cambia "arrendador" por "propietario" y "arrendatario" por "inquilino".',
    doc: lease,
    check(after, before) {
      const text = all(after);
      if (/arrendador|arrendatario/i.test(text.replace(/arrendamiento/gi, ''))) return ok(false, 'a word was left');
      const count = (doc: Doc, re: RegExp) => (all(doc).match(re) ?? []).length;
      return ok(count(after, /propietario/gi) === count(before, /arrendador/gi) && count(after, /inquilino/gi) === count(before, /arrendatario/gi), 'the counts do not match');
    },
  },
  {
    id: 'tracked-change',
    about: 'Makes a change as a tracked change, when asked to',
    ask: 'Con control de cambios activado, cambia el plazo de 12 a 24 meses, para que el cliente vea qué se cambió.',
    doc: lease,
    check(after) {
      if (!revisionsOf(after).length) return ok(false, 'no tracked changes');
      // What reads now, with the deletions taken out.
      const shown = after.paragraphs
        .map((para) =>
          para.runs
            .filter((run) => run.props.revision !== 'delete')
            .map((run) => run.text)
            .join(''),
        )
        .join('\n');
      return ok(/24 meses/.test(shown) && !/12 meses/.test(shown), `text: ${shown.slice(0, 300)}`);
    },
  },
  {
    id: 'bold-name',
    about: 'Sets the look of a stretch of text, and only of it',
    ask: 'Pon en negritas la dirección del inmueble.',
    doc: lease,
    check(after) {
      const para = after.paragraphs[2];
      const bold = para.runs
        .filter((run) => resolveRun(run.props).bold)
        .map((run) => run.text)
        .join('');
      return ok(/Calle Ficticia 123/.test(bold) && bold.length < paragraphText(para).length * 0.7, `bold: "${bold}"`);
    },
  },
  {
    id: 'translate-keep-bold',
    about: 'Writes a paragraph anew in another language and keeps what was bold',
    ask: 'Traduce al inglés el segundo párrafo, conservando las negritas.',
    doc: () => createDoc([p('Aviso de privacidad'), p('Sus datos personales serán tratados de forma confidencial y no serán compartidos con terceros.', 'confidencial'), p('Gracias.')]),
    check(after) {
      const para = after.paragraphs[1];
      const text = paragraphText(para);
      if (/datos|serán|terceros/.test(text)) return ok(false, `still in Spanish: ${text}`);
      const bold = para.runs
        .filter((run) => resolveRun(run.props).bold)
        .map((run) => run.text)
        .join('');
      return ok(/confidential/i.test(bold), `bold: "${bold}"`);
    },
  },
  {
    id: 'lines-to-table',
    about: 'Turns lines of data into a table',
    ask: 'Convierte los datos del inmueble (las líneas con dos puntos) en una tabla de dos columnas.',
    doc: () => createDoc([p('Ficha del inmueble'), p('Recámaras: 3'), p('Baños: 2.5'), p('Estacionamientos: 2'), p('Superficie: 145 m²'), p('Notas al final.')]),
    check(after) {
      const tables = (after.tables ?? []).filter((table) => table.rows.length);
      if (!tables.length) return ok(false, 'no table');
      const text = all(after);
      return ok(
        tables.some((table) => table.rows.length >= 4) && ['Recámaras', 'Superficie', '145'].every((part) => text.includes(part)),
        `rows: ${tables.map((table) => table.rows.length).join(', ')}`,
      );
    },
  },
  {
    id: 'heading-style',
    about: 'Gives paragraphs the style asked for',
    ask: 'Los títulos de las cláusulas (Primera, Segunda…) ponlos con el estilo Título 2 en lugar de Título 1.',
    doc: lease,
    check(after) {
      const wrong = texts(after)
        .map((line, i) => [line, styleIdAt(after, i)] as const)
        .filter(([line]) => /^(Primera|Segunda|Tercera|Cuarta|Quinta)\./.test(line))
        .filter(([, style]) => style !== 'Heading2');
      return ok(!wrong.length, wrong.map(([line, style]) => `${line}: ${style}`).join('; '));
    },
  },
  // Both ways: these ask for no change.
  {
    id: 'review-only',
    about: 'Reviews with notes, without changing the text',
    ask: 'Revisa el contrato y deja comentarios donde veas algo que falte o esté mal. No cambies el texto.',
    doc: lease,
    check(after, before) {
      if (!same(after, before)) return ok(false, 'the text changed');
      return ok((after.notes?.length ?? 0) > 0, 'no notes');
    },
  },
  {
    id: 'question-only',
    about: 'Answers a question about the document without touching it',
    ask: '¿De cuánto es la renta y cada cuándo se paga?',
    doc: lease,
    check(after, before, answer) {
      if (!same(after, before) || (after.notes?.length ?? 0) !== (before.notes?.length ?? 0)) return ok(false, 'the document changed');
      return ok(/18[,.]?500/.test(answer), `answer: ${answer.slice(0, 200)}`);
    },
  },
  {
    id: 'no-such-clause',
    about: 'Says so when what is asked is not there, instead of making it up',
    ask: 'Cambia el monto del depósito en garantía a dos meses de renta.',
    doc: lease,
    check(after, before, answer) {
      // There is no deposit clause: changing the rent or the term to say so would be wrong. Adding one, or asking, is right.
      const t = texts(after);
      if (!t.some((line) => /18,500/.test(line))) return ok(false, 'the rent was changed');
      if (!t.some((line) => /12 meses/.test(line))) return ok(false, 'the term was changed');
      return ok(same(after, before) ? /dep[oó]sito/i.test(answer) : /dep[oó]sito/i.test(all(after)), 'neither added nor said');
    },
  },
  // Harder: a long document, several steps, the parts of a document besides its text.
  {
    id: 'long-document',
    about: 'Finds the one clause of 45 to change, in a long document, and leaves the same words elsewhere',
    hard: true,
    ask: 'En la cláusula 37 (Notificaciones), cambia el aviso de 15 días naturales a 30 días hábiles. Solo en esa cláusula.',
    doc: longAgreement,
    check(after, before) {
      const t = texts(after);
      const heading = t.findIndex((line) => line.startsWith('Cláusula 37.'));
      const body = t[heading + 1] ?? '';
      if (!/30 días hábiles/.test(body) || /15 días naturales/.test(body)) return ok(false, `clause 37 reads: ${body}`);
      const count = (doc: Doc) => (all(doc).match(/15 días naturales/g) ?? []).length;
      return ok(count(after) === count(before) - 1 && after.paragraphs.length === before.paragraphs.length, `"15 días naturales" ${count(before)} times before, ${count(after)} after`);
    },
  },
  {
    id: 'many-changes',
    about: 'Makes five changes asked for at once, each where it goes',
    hard: true,
    ask: 'Haz estos cambios al contrato: 1) la renta sube a $21,000.00; 2) el plazo es de 18 meses; 3) quita la cláusula de penalización completa; 4) después de la cláusula de renta agrega una cláusula «Mantenimiento», con su título como las demás, que diga que el arrendatario paga el mantenimiento del condominio; 5) la dirección del inmueble es Avenida Real 456, Colonia Centro.',
    doc: lease,
    check(after) {
      const t = texts(after);
      const text = all(after);
      const fails = [
        !/21,000\.00/.test(text) || /18,500/.test(text) ? 'rent' : '',
        !/18 meses/.test(text) || /12 meses/.test(text) ? 'term' : '',
        /penaliza/i.test(text) ? 'penalty still there' : '',
        !/Avenida Real 456/.test(text) || /Calle Ficticia/.test(text) ? 'address' : '',
      ];
      const rent = t.findIndex((line) => /Renta/.test(line) && styleIdAt(after, t.indexOf(line)) === 'Heading1');
      const upkeep = t.findIndex((line, i) => /Mantenimiento/i.test(line) && styleIdAt(after, i) === 'Heading1');
      const next = t.findIndex((_, i) => i > rent && styleIdAt(after, i) === 'Heading1');
      if (upkeep < 0) fails.push('no heading "Mantenimiento"');
      else if (upkeep !== next) fails.push(`"Mantenimiento" at ${upkeep + 1}, not right after the rent`);
      else if (!/mantenimiento/i.test(t[upkeep + 1] ?? '')) fails.push('no text under "Mantenimiento"');
      const wrong = fails.filter(Boolean);
      return ok(!wrong.length, wrong.join('; '));
    },
  },
  {
    id: 'header-footer',
    about: 'Changes the header and adds to the footer, and leaves the text as it was',
    hard: true,
    ask: 'Cambia el encabezado para que diga «Inmobiliaria Quintana · Contrato 2026» y agrega al pie de página, debajo de la dirección, una línea que diga «Documento confidencial».',
    doc: withHeader,
    check(after, before) {
      const header = (after.header?.paragraphs ?? []).map(paragraphText).join(' / ');
      const footer = (after.footer?.paragraphs ?? []).map(paragraphText);
      if (!/Inmobiliaria Quintana · Contrato 2026/.test(header) || /Ejemplo/.test(header)) return ok(false, `header: ${header}`);
      const address = footer.findIndex((line) => /Calle Ficticia 99/.test(line));
      const secret = footer.findIndex((line) => /Documento confidencial/.test(line));
      if (address < 0 || secret <= address) return ok(false, `footer: ${footer.join(' / ')}`);
      return ok(same(after, before), 'the text of the document changed');
    },
  },
  {
    id: 'numbered-list',
    about: 'Puts an item in the middle of a numbered list, and the numbers follow',
    hard: true,
    ask: 'En la lista de obligaciones, agrega «Pagar el predial» entre la segunda y la tercera, como parte de la misma lista numerada.',
    doc: obligations,
    check(after) {
      const t = texts(after);
      const at = t.findIndex((line) => /predial/i.test(line));
      if (at < 0) return ok(false, 'no item');
      if (!(t[at - 1] === 'Cuidar el inmueble' && t[at + 1] === 'No subarrendar')) return ok(false, `between "${t[at - 1]}" and "${t[at + 1]}"`);
      const labels = listLabels(after);
      const items = t.map((_, i) => i).filter((i) => listKindAt(after, i) === 'number');
      const numbers = items.map((i) => (labels[i]?.text ?? '').replace(/\D/g, ''));
      return ok(items.length === 5 && numbers.join(',') === '1,2,3,4,5', `items ${items.map((i) => i + 1).join(',')}, numbered ${numbers.join(',')}`);
    },
  },
  {
    id: 'decide-changes',
    about: "Accepts one person's tracked changes and rejects another's",
    hard: true,
    ask: 'Acepta los cambios que hizo Laura y rechaza los de Pedro.',
    doc: reviewed,
    check(after) {
      if (revisionsOf(after).length) return ok(false, `${revisionsOf(after).length} tracked changes left`);
      const text = reads(after).join('\n');
      return ok(/19,000\.00/.test(text) && !/18,500/.test(text) && /12 meses/.test(text) && !/6 meses/.test(text), `text: ${text.slice(0, 400)}`);
    },
  },
  {
    id: 'table-rows',
    about: 'Takes a row out of a table and adds one at its end',
    hard: true,
    ask: 'En la tabla de costos, quita la fila de Estacionamiento y agrega al final una fila con «Mantenimiento» y «$1,200».',
    doc: costs,
    check(after) {
      const rows = tableRows(after).map((row) => row.join(' | '));
      return ok(rows.join('\n') === ['Concepto | Monto', 'Renta | $18,500', 'Agua | $300', 'Mantenimiento | $1,200'].join('\n'), rows.join(' // '));
    },
  },
  {
    id: 'signatures-on-one-page',
    about: 'Keeps the signatures whole on a page, in a way that still holds when the text above grows shorter',
    hard: true,
    needsFonts: true,
    ask: 'Este contrato se va a enviar. Revisa que el bloque de firmas no quede partido entre dos páginas y, si lo está, arréglalo sin cambiar el texto, de forma que siga bien si después se acorta el texto de arriba: que no quede media página vacía antes de las firmas.',
    doc: splitSignatures,
    check(after, before) {
      const pages = tablePages(after);
      if (pages.length !== 1) return ok(false, `the signatures are on pages ${pages.join(', ')}`);
      if (bodyText(after) !== bodyText(before)) return ok(false, 'the text changed');
      // The text above made shorter, by as many clauses as it takes for the signatures to fit after it as they were, uncut: then they must go on with the text, not on a page of their own.
      for (let k = 3; k <= 12; k++) {
        const plain = layoutAfterCut(before, k);
        if (!plain || plain.table.length !== 1 || plain.table[0] !== plain.lastClause) continue;
        const mended = layoutAfterCut(after, k);
        if (!mended) return ok(false, 'the clauses of the contract are not there');
        if (mended.table.length !== 1) return ok(false, `with ${k} clauses less, the signatures are on pages ${mended.table.join(', ')}`);
        return ok(mended.table[0] === mended.lastClause, `with ${k} clauses less, the signatures go to page ${mended.table[0]} and the text ends on page ${mended.lastClause}: a page left part empty`);
      }
      return ok(false, 'no shorter contract fits its signatures: the case is wrong');
    },
  },
];
