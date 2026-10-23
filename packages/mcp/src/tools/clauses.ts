// Clauses: the numbers written in their headings ("Primera.", "CLÁUSULA 3.",
// "IV.") put in order again, a clause moved with all it holds, and the text of
// a cell written by where the cell is. What Word leaves to the person: the
// numbers of a contract are words in its text, not a list.

import { type Doc, type Paragraph, locateCell, moveSection, outline, paragraphLength, paragraphText, replaceRange, styleIdAt } from '@rebodocs/core/internal';
import { type Tool, fail, lines, mainLooks, paragraphIndex, dress, spliced, whole } from './shared';

// --- Ordinals in Spanish ------------------------------------------------------------

const UNITS = ['', 'primer', 'segund', 'tercer', 'cuart', 'quint', 'sext', 'séptim', 'octav', 'noven'];
const TENS = ['', 'décim', 'vigésim', 'trigésim', 'cuadragésim', 'quincuagésim', 'sexagésim', 'septuagésim', 'octogésim', 'nonagésim'];
const bare = (word: string) => word.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** The value of an ordinal word stem, as a unit, a ten, or one of the two that have their own name. */
function stemValue(stem: string): number | undefined {
  const s = bare(stem);
  if (s === 'undecim') return 11;
  if (s === 'duodecim') return 12;
  if (s === 'setim') return 7;
  const unit = UNITS.findIndex((u, i) => i && bare(u) === s);
  if (unit > 0) return unit;
  const ten = TENS.findIndex((t, i) => i && bare(t) === s);
  return ten > 0 ? ten * 10 : undefined;
}

const ORDINAL_WORD =
  /(?:primer|segund|tercer|cuart|quint|sext|s[ée]p?tim|octav|noven|d[ée]cim|undécim|undecim|duodécim|duodecim|vig[ée]sim|trig[ée]sim|cuadrag[ée]sim|quincuag[ée]sim|sexag[ée]sim|septuag[ée]sim|octog[ée]sim|nonag[ée]sim)[oa]?/giu;

/** An ordinal written in words, as one word or several: "Décima Primera", "decimotercera", "Primero". */
function parseOrdinal(words: string): { value: number; feminine: boolean } | undefined {
  const parts = words.match(ORDINAL_WORD);
  if (!parts || parts.join('').length !== words.replace(/[\s-]/g, '').length) return undefined;
  let value = 0;
  let feminine = false;
  for (const part of parts) {
    const end = part.slice(-1).toLowerCase();
    const stem = end === 'a' || end === 'o' ? part.slice(0, -1) : part;
    const n = stemValue(stem);
    if (n === undefined) return undefined;
    // Each piece smaller than the one before: "décima primera", never "primera décima".
    if (value && n >= value) return undefined;
    value += n;
    feminine = end === 'a';
  }
  // "Primer" alone is masculine, as in "Primer párrafo".
  return value ? { value, feminine } : undefined;
}

/** An ordinal in words: `special` writes 11 and 12 as "undécima" and "duodécima". */
function ordinalWords(n: number, feminine: boolean, special: boolean): string {
  const end = feminine ? 'a' : 'o';
  if (special && (n === 11 || n === 12)) return `${n === 11 ? 'undécim' : 'duodécim'}${end}`;
  const ten = Math.floor(n / 10);
  const unit = n % 10;
  return [ten ? `${TENS[ten]}${end}` : '', unit ? `${UNITS[unit]}${end}` : ''].filter(Boolean).join(' ');
}

const ROMAN: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];
const toRoman = (n: number) =>
  ROMAN.reduce((out, [value, letters]) => {
    let s = out;
    while (n >= value) {
      s += letters;
      n -= value;
    }
    return s;
  }, '');
function fromRoman(letters: string): number | undefined {
  if (!/^[IVXLCDM]+$/i.test(letters)) return undefined;
  const n = [...letters.toUpperCase()].reduce((sum, ch, i, all) => {
    const value = ROMAN.find(([, l]) => l === ch)![0];
    const next = all[i + 1] ? ROMAN.find(([, l]) => l === all[i + 1])![0] : 0;
    return sum + (value < next ? -value : value);
  }, 0);
  return toRoman(n) === letters.toUpperCase() ? n : undefined;
}

/** Writes `made` with the capitals `like` has: all of them, each word's first, the first, or none. */
function caseLike(like: string, made: string): string {
  const letters = like.replace(/[^\p{L}]/gu, '');
  if (letters && letters === letters.toUpperCase()) return made.toUpperCase();
  const words = like.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  if (words.length > 1 && words.every((w) => /^\p{Lu}/u.test(w))) return made.replace(/(^|\s)(\p{L})/gu, (_, space, ch) => space + ch.toUpperCase());
  if (/^\p{Lu}/u.test(like)) return made.charAt(0).toUpperCase() + made.slice(1);
  return made;
}

// --- The numbers of the headings of clauses ---------------------------------------

/** The word a number of a clause may come after. */
const PREFIX = /^(?:cl[áa]usula|art[íi]culo|cap[íi]tulo|secci[óo]n)\s+/iu;
/** What may follow the number: a full stop, a colon, a bracket or a dash. */
const AFTER = /^\s*[.:)\-–—]/u;

type Scheme = 'arabic' | 'roman' | 'words';

interface Numbered {
  para: number;
  value: number;
  scheme: Scheme;
  /** Where the number is in the text of the paragraph, and what it reads. */
  start: number;
  token: string;
  feminine: boolean;
  /** What the clauses of one series share: the word before the number, how it is written, and the style. */
  key: string;
}

function numbered(doc: Doc, para: number): Numbered | undefined {
  const full = paragraphText(doc.paragraphs[para]);
  const leading = full.length - full.trimStart().length;
  const prefix = PREFIX.exec(full.slice(leading))?.[0] ?? '';
  const rest = full.slice(leading + prefix.length);
  /** The number, what kind it is and how long it is written; then what follows it. */
  const read = (): { token: string; value: number; scheme: Scheme; feminine: boolean } | undefined => {
    const digits = /^\d{1,3}/.exec(rest)?.[0];
    if (digits) return { token: digits, value: Number(digits), scheme: 'arabic', feminine: false };
    const roman = /^[IVXLCDM]{1,7}(?=[\s.:)\-–—]|$)/i.exec(rest)?.[0];
    const romanValue = roman && fromRoman(roman);
    // "I." is a number; "I" alone, as a word, is not, nor is a word of Spanish that happens to be Roman ("mil", "di").
    if (roman && romanValue && (prefix || AFTER.test(rest.slice(roman.length))) && roman === roman.toUpperCase()) return { token: roman, value: romanValue, scheme: 'roman', feminine: false };
    // An ordinal of up to three words: the longest that reads as one.
    const words = /^[\p{L}]+(?:[\s-]+[\p{L}]+){0,2}/u.exec(rest)?.[0].split(/(?<=[\p{L}])(?=[\s-])/u) ?? [];
    for (let n = words.length; n > 0; n--) {
      const token = words.slice(0, n).join('');
      const ordinal = parseOrdinal(token);
      if (ordinal) return { token, value: ordinal.value, scheme: 'words', feminine: ordinal.feminine };
    }
    return undefined;
  };
  const found = read();
  if (!found) return undefined;
  const after = rest.slice(found.token.length);
  // A number with nothing after it, and no word before, is just a line that starts with a number.
  if (!prefix && !AFTER.test(after)) return undefined;
  const mark = AFTER.exec(after)?.[0].trim() ?? '';
  const key = [bare(prefix.trim()), found.scheme, mark, styleIdAt(doc, para)].join('|');
  return { para, value: found.value, scheme: found.scheme, start: leading + prefix.length, token: found.token, feminine: found.feminine, key };
}

/** The series of numbered headings of the document: those that share a key, in order, the longest first. */
function series(doc: Doc): Numbered[][] {
  const groups = new Map<string, Numbered[]>();
  for (let i = 0; i < doc.paragraphs.length; i++) {
    if (doc.paragraphs[i].cell) continue;
    const found = numbered(doc, i);
    if (found) groups.set(found.key, [...(groups.get(found.key) ?? []), found]);
  }
  return [...groups.values()].filter((group) => group.length >= 2).sort((a, b) => b.length - a.length);
}

/** Where the clause a text names is: "cláusula Tercera", "la cláusula 3", "artículo IV". */
const MENTION = /\b(?:cl[áa]usulas?|art[íi]culos?)\s+((?:[\p{L}]+(?:\s+(?=[\p{L}]))?){1,2}|\d{1,3}|[IVXLCDM]{1,7})\b/giu;

const renumberClauses: Tool = {
  name: 'renumber_clauses',
  title: 'Renumber the clauses',
  description:
    'Puts in order the numbers written at the start of the headings of clauses, after one was put in, taken out or moved: "Primera.", "Segunda."… in words, "CLÁUSULA 3.", or "IV.", each kept as it is written (its capitals, "Primera" or "Primero", "Décima Primera" or "Undécima"). The headings of one series are those that begin the same way and have the same style; the longest is renumbered, or the one of "paragraph". It says the places of the text that name a clause by its number ("según la cláusula Tercera"), for you to check: it does not change them.',
  properties: {
    paragraph: { type: 'integer', description: 'A heading of the series to renumber, when the document has more than one. The longest when left out.' },
    start: { type: 'integer', description: 'The number of the first. 1 when left out.' },
  },
  writes: true,
  idempotent: true,
  run(doc, args) {
    const all = series(doc);
    if (!all.length) fail('No headings were found that begin with a number of clause ("Primera.", "Cláusula 3.", "IV."), two or more of the same kind.');
    const asked = whole(args, 'paragraph');
    const chosen = asked === undefined ? all[0] : (all.find((group) => group.some((item) => item.para === asked - 1)) ?? fail(`Paragraph ${asked} is not a heading of a series of numbered clauses.`));
    const start = whole(args, 'start') ?? 1;
    if (start < 1 || start > 500) fail('"start" must be from 1 to 500.');
    // 11 and 12 as the document writes them: as their own words if any is, "décima primera" otherwise.
    const special = chosen.some((item) => /^(undecim|duodecim)/.test(bare(item.token)));
    const changes: string[] = [];
    // What each number was, and what the clauses that had it are now: two had the same one when one was put in.
    const renamed = new Map<number, Set<number>>();
    let next = doc;
    // From the last, so that a change of length does not move the ones before.
    for (let k = chosen.length - 1; k >= 0; k--) {
      const item = chosen[k];
      const want = start + k;
      renamed.set(item.value, (renamed.get(item.value) ?? new Set<number>()).add(want));
      if (item.value === want) continue;
      const made = item.scheme === 'arabic' ? String(want) : item.scheme === 'roman' ? toRoman(want) : caseLike(item.token, ordinalWords(want, item.feminine, special));
      const written = item.scheme === 'roman' && item.token === item.token.toLowerCase() ? made.toLowerCase() : made;
      next = replaceRange(next, { from: { para: item.para, offset: item.start }, to: { para: item.para, offset: item.start + item.token.length } }, written).doc;
      changes.unshift(`Paragraph ${item.para + 1}: ${item.token} → ${written}`);
    }
    // The places that name a clause whose number changed: said, not changed, for whoever reads them to decide.
    const heads = new Set(chosen.map((item) => item.para));
    const mentions: string[] = [];
    next.paragraphs.forEach((p, i) => {
      if (heads.has(i)) return;
      for (const m of paragraphText(p).matchAll(MENTION)) {
        const named = m[1].trim();
        const words = named.split(/\s+/);
        // "la cláusula Tercera de este contrato": the ordinal is one word or two, and what follows is not.
        const value = /^\d+$/.test(named) ? Number(named) : (fromRoman(named) ?? parseOrdinal(words.join(' '))?.value ?? parseOrdinal(words[0])?.value);
        const now = value === undefined ? undefined : renamed.get(value);
        if (now && [...now].some((n) => n !== value)) mentions.push(`Paragraph ${i + 1} says "${m[0]}": that clause is now number ${[...now].sort((a, b) => a - b).join(' or ')}.`);
      }
    });
    if (!changes.length) return { text: `The ${chosen.length} clauses were already numbered from ${start} in order.${mentions.length ? `\n${mentions.join('\n')}` : ''}` };
    return {
      text: `Renumbered ${changes.length} of ${chosen.length} clauses:\n${changes.join('\n')}${mentions.length ? `\nTo check, the text names clauses by number:\n${mentions.join('\n')}` : ''}`,
      doc: next,
      reveal: { para: chosen[0].para, offset: 0 },
    };
  },
};

// --- Moving a clause ----------------------------------------------------------------

const moveClause: Tool = {
  name: 'move_section',
  title: 'Move a section',
  description:
    'Moves a heading and everything under it, down to the next heading of its level or above (a clause with its text, a chapter with its clauses), to another place, as dragging it in the outline of the editor does. The paragraphs keep their look, their notes and their pictures. After it, renumber_clauses puts the numbers of the headings in order.',
  properties: {
    paragraph: { type: 'integer', description: 'The heading of what to move, as read_document numbers it. get_overview lists the headings.' },
    before: { type: 'integer', description: 'The paragraph it goes before, as numbered now. Left out, it goes to the end of the document.' },
  },
  required: ['paragraph'],
  writes: true,
  run(doc, args) {
    const from = paragraphIndex(doc, args, 'paragraph');
    const heading =
      outline(doc).find((item) => item.para === from) ??
      fail(`Paragraph ${from + 1} is not a heading: give the number of a heading (get_overview lists them). To move other paragraphs, delete them and insert them where they go.`);
    const before = whole(args, 'before') === undefined ? undefined : paragraphIndex(doc, args, 'before');
    if (before !== undefined && doc.paragraphs[before].cell) fail('A section cannot go into a table: give the paragraph after the table.');
    const { doc: next, para } = moveSection(doc, from, before);
    if (next === doc) fail(`"before" is inside the section itself: it would stay where it is.`);
    const size = outlineSize(doc, from);
    return {
      text: `Moved "${heading.text}" and what is under it (${size} paragraphs): it is now paragraphs ${para + 1} to ${para + size}. The numbers of the paragraphs between moved.`,
      doc: next,
      reveal: { para, offset: 0 },
    };
  },
};

/** How many paragraphs the section of the heading at `from` has: down to the next heading of its level or above. */
function outlineSize(doc: Doc, from: number): number {
  const items = outline(doc);
  const at = items.findIndex((item) => item.para === from);
  const end = items.slice(at + 1).find((item) => item.level <= items[at].level)?.para ?? doc.paragraphs.length;
  return end - from;
}

// --- The text of a cell -------------------------------------------------------------

const setCellText: Tool = {
  name: 'set_cell_text',
  title: 'Write in a table cell',
  areas: true,
  description:
    'Writes the text of a cell of a table, by its table, row and cell, as read_document shows them ("table 1, row 2, cell 3"): what the cell had goes, empty or not, and the text takes the look most of it had. A new line in "text" starts another paragraph in the cell. The way to fill the cells of a row just put in.',
  properties: {
    table: { type: 'integer', description: 'The table, from 1.' },
    row: { type: 'integer', description: 'The row, from 1.' },
    cell: { type: 'integer', description: 'The cell in that row, from 1.' },
    text: { type: 'string', description: 'What the cell says. Empty to leave it empty.' },
  },
  required: ['table', 'row', 'cell', 'text'],
  writes: true,
  run(doc, args) {
    const [table, row, cell] = ['table', 'row', 'cell'].map((name) => whole(args, name) ?? fail(`"${name}" is needed: its number, from 1, as read_document shows it.`));
    const value = typeof args.text === 'string' ? args.text : fail('"text" must be a text: empty for an empty cell.');
    const paras: number[] = [];
    doc.paragraphs.forEach((p: Paragraph, i) => {
      const at = p.cell && locateCell(doc, i);
      if (at && at.tableIndex === table - 1 && at.rowIndex === row - 1 && at.cellIndex === cell - 1) paras.push(i);
    });
    if (!paras.length) {
      const tables = (doc.tables ?? []).filter((t) => t.rows.length).length;
      if (table < 1 || table > (doc.tables?.length ?? 0) || !doc.tables![table - 1].rows.length)
        fail(tables ? `There is no table ${table}: the document has ${tables}.` : 'The document has no tables.');
      const rows = doc.tables![table - 1].rows;
      if (row < 1 || row > rows.length) fail(`Table ${table} has ${rows.length} rows.`);
      fail(`Row ${row} of table ${table} has ${rows[row - 1].cells.length} cells.`);
    }
    const first = paras[0];
    const look = mainLooks(doc, first);
    const [head, ...more] = value.replace(/\r\n?/g, '\n').split('\n');
    // The other paragraphs of the cell go; the first keeps its own look, and takes the text.
    let next: Doc = paras.length > 1 ? { ...doc, paragraphs: doc.paragraphs.filter((_, i) => !paras.slice(1).includes(i)) } : doc;
    const length = paragraphLength(next.paragraphs[first]);
    next = replaceRange(next, { from: { para: first, offset: 0 }, to: { para: first, offset: length } }, head).doc;
    if (head) next = dress(next, first, 0, look, [{ text: head, patch: {} }]);
    if (more.length) {
      next = spliced(next, first, more);
      more.forEach((line, k) => {
        if (line) next = dress(next, first + 1 + k, 0, look, [{ text: line, patch: {} }]);
      });
    }
    return { text: `Table ${table}, row ${row}, cell ${cell} now says what was given.\n${lines(next, first, first + more.length)}`, doc: next, reveal: { para: first, offset: 0 } };
  },
};

/** The tools of clauses, in the order they are listed. */
export const CLAUSES: Tool[] = [moveClause, renumberClauses, setCellText];

// Read by the tests, which give it words and numbers to read.
export const _ordinals = { parseOrdinal, ordinalWords, toRoman, fromRoman, caseLike, numbered: (doc: Doc, para: number) => numbered(doc, para) };
