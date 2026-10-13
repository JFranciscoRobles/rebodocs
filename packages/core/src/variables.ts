// Templates: a document whose text holds variables, written {{name}}, to be
// filled in with values. A variable is plain text, so any DOCX can be a
// template and Word shows it as it is; it takes the formatting of the text
// it stands in. After the name it can say how its value is to be written:
// {{fecha | fecha larga | mayúsculas}}.

import { type Doc, type Range, type RunProps, type Story } from './model';
import { replaceRange } from './find';
import { applyRunProps } from './ops';

export interface Variable {
  name: string;
  /** How the value is to be written, as they are in the text: `fecha larga`, `mayúsculas`... */
  formats: string[];
  range: Range;
}

/**
 * What a variable looks like: a name of letters, digits, spaces, dots, dashes
 * and underscores between double braces, and then its formats, each after a bar.
 */
const VARIABLE = /\{\{\s*([\p{L}\p{N}_][\p{L}\p{N}_.\- ]*?)\s*((?:\|[^{}|]*)*)\}\}/gu;
const NAME = /^[\p{L}\p{N}_][\p{L}\p{N}_.\- ]*$/u;

/** True for a name a variable can have. */
export function isVariableName(name: string): boolean {
  return NAME.test(name);
}

/** The text of a variable called `name`, with the formats given. */
export function variableText(name: string, formats: string[] = []): string {
  return `{{${[name.trim(), ...formats].join(' | ')}}}`;
}

// --- Formats ----------------------------------------------------------------------

/** Formats of one group replace each other; the others add up. */
type FormatGroup = 'case' | 'type' | 'style';

interface FormatKind {
  /** How it is written in a document. */
  write: string;
  group: FormatGroup;
  /** Other names it is known by, without accents. */
  alias?: string[];
}

export type FormatId = 'upper' | 'lower' | 'capital' | 'bold' | 'italic' | 'underline' | 'date' | 'dateLong' | 'dateFull' | 'number' | 'currency';

const FORMATS: Record<FormatId, FormatKind> = {
  upper: { write: 'mayúsculas', group: 'case', alias: ['mayusculas', 'mayuscula'] },
  lower: { write: 'minúsculas', group: 'case', alias: ['minusculas', 'minuscula'] },
  capital: { write: 'nombre propio', group: 'case', alias: ['capital', 'capitalizar'] },
  bold: { write: 'negrita', group: 'style', alias: ['negritas'] },
  italic: { write: 'cursiva', group: 'style', alias: ['cursivas', 'italica'] },
  underline: { write: 'subrayado', group: 'style' },
  date: { write: 'fecha', group: 'type', alias: ['fecha corta'] },
  dateLong: { write: 'fecha larga', group: 'type' },
  dateFull: { write: 'fecha completa', group: 'type' },
  number: { write: 'número', group: 'type', alias: ['numero'] },
  currency: { write: 'moneda', group: 'type', alias: ['importe'] },
};

const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const BY_NAME = new Map<string, FormatId>();
for (const [id, kind] of Object.entries(FORMATS) as [FormatId, FormatKind][]) for (const name of [id, kind.write, ...(kind.alias ?? [])]) BY_NAME.set(plain(name), id);

/** A format as it is written: what it is, and what comes after the colon, as in `fecha: d de MMMM`. */
function parseFormat(format: string): { id?: FormatId; arg: string } {
  const colon = format.indexOf(':');
  const name = colon < 0 ? format : format.slice(0, colon);
  return { id: BY_NAME.get(plain(name)), arg: colon < 0 ? '' : format.slice(colon + 1).trim() };
}

/** How a format is written in a document: `formatText('date', 'dd/MM/yyyy')` is `fecha: dd/MM/yyyy`. */
export function formatText(id: FormatId, arg = ''): string {
  return arg ? `${FORMATS[id].write}: ${arg}` : FORMATS[id].write;
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DATE_PATTERNS: Record<string, string> = { date: 'dd/MM/yyyy', dateLong: 'd de MMMM de yyyy', dateFull: 'dddd, d de MMMM de yyyy' };

interface Day {
  year: number;
  month: number;
  day: number;
}

/** The day a value names: `2026-10-12`, `12/10/2026` (the day first) or `hoy`. */
function parseDay(value: string, today: Date): Day | undefined {
  const text = value.trim();
  if (plain(text) === 'hoy') return { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() };
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(text);
  const local = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(text);
  if (!iso && !local) return undefined;
  const [year, month, day] = iso ? [+iso[1], +iso[2], +iso[3]] : [+local![3] < 100 ? 2000 + +local![3] : +local![3], +local![2], +local![1]];
  // The last day of the month is the day before the first of the next.
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return undefined;
  return { year, month, day };
}

const two = (n: number) => String(n).padStart(2, '0');

/**
 * A day written after a pattern. Its words are taken as they are, but for
 * `d`, `dd`, `dddd` (the day of the week), `M`, `MM`, `MMM`, `MMMM`, and `yy`,
 * `yyyy` or `aa`, `aaaa`: no quotes are needed for `d de MMMM de yyyy`.
 */
function writeDay({ year, month, day }: Day, pattern: string): string {
  return pattern.replace(/\p{L}+/gu, (word) => {
    switch (word.toLowerCase()) {
      case 'd':
        return String(day);
      case 'dd':
        return two(day);
      case 'dddd':
        return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
      case 'm':
        return String(month);
      case 'mm':
        return two(month);
      case 'mmm':
        return MONTHS[month - 1].slice(0, 3);
      case 'mmmm':
        return MONTHS[month - 1];
      case 'yy':
      case 'aa':
        return two(year % 100);
      case 'yyyy':
      case 'aaaa':
        return String(year);
      default:
        return word;
    }
  });
}

/** A number written with its thousands apart: `1234567.5` is `1,234,567.5`; with `decimals`, rounded to them. */
function writeNumber(value: string, decimals: number | undefined): string | undefined {
  const text = value.replace(/[$\s,]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(text)) return undefined;
  const [whole, fraction = ''] = (decimals === undefined ? text : Number(text).toFixed(decimals)).replace('-', '').split('.');
  const sign = text.startsWith('-') && /[1-9]/.test(whole + fraction) ? '-' : '';
  return `${sign}${whole.replace(/\B(?=(\d{3})+$)/g, ',')}${fraction ? `.${fraction}` : ''}`;
}

/** Why a variable could not be written as its format asks. */
export interface FormatProblem {
  format: string;
  /** `format`: there is no such format. `value`: the value is not what the format is for (not a date, not a number). */
  kind: 'format' | 'value';
}

export interface FormatOptions {
  /** The day `hoy` stands for; today, if it is not given. */
  today?: Date;
}

/**
 * A value as its formats ask, one after another: its text, and the character
 * formatting they add. A format that cannot be applied leaves the value as it was.
 */
export function formatValue(value: string, formats: string[], options: FormatOptions = {}): { text: string; props: RunProps; problems: FormatProblem[] } {
  let text = value;
  const props: RunProps = {};
  const problems: FormatProblem[] = [];
  for (const format of formats) {
    const { id, arg } = parseFormat(format);
    let next: string | undefined = text;
    if (id === 'upper') next = text.toLocaleUpperCase('es');
    else if (id === 'lower') next = text.toLocaleLowerCase('es');
    else if (id === 'capital') next = text.toLocaleLowerCase('es').replace(/(^|[^\p{L}\p{N}'’])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toLocaleUpperCase('es'));
    else if (id === 'bold' || id === 'italic' || id === 'underline') props[id] = true;
    else if (id === 'date' || id === 'dateLong' || id === 'dateFull') {
      const day = parseDay(text, options.today ?? new Date());
      next = day && writeDay(day, (id === 'date' && arg) || DATE_PATTERNS[id]);
    } else if (id === 'number' || id === 'currency') {
      const decimals = /^\d$/.test(arg) ? +arg : id === 'currency' ? 2 : undefined;
      next = writeNumber(text, decimals);
      if (next !== undefined && id === 'currency') next = next.startsWith('-') ? `-$${next.slice(1)}` : `$${next}`;
    } else {
      problems.push({ format, kind: 'format' });
    }
    if (next === undefined) problems.push({ format, kind: 'value' });
    else text = next;
  }
  return { text, props, problems };
}

// --- In the document ---------------------------------------------------------------

/** Every variable in the paragraphs of the document, in order. Marks that take no room do not break one up. */
export function findVariables(doc: Pick<Doc, 'paragraphs'>): Variable[] {
  const out: Variable[] = [];
  doc.paragraphs.forEach((p, para) => {
    let text = '';
    const at: number[] = [];
    let offset = 0;
    for (const run of p.runs) {
      if (!run.props.object) {
        for (let i = 0; i < run.text.length; i++) at.push(offset + i);
        text += run.text;
      }
      offset += run.text.length;
    }
    if (!text.includes('{{')) return;
    for (const match of text.matchAll(VARIABLE)) {
      const end = match.index + match[0].length;
      const formats = match[2]
        .split('|')
        .map((format) => format.trim())
        .filter(Boolean);
      out.push({ name: match[1], formats, range: { from: { para, offset: at[match.index] }, to: { para, offset: at[end - 1] + 1 } } });
    }
  });
  return out;
}

const stories = (doc: Doc) => [doc.header, doc.footer].filter((story): story is Story => !!story);
const parts = (doc: Doc) => [doc, ...stories(doc)];

/** The names of the variables of the document, its header and its footer, each once, in the order they first appear. */
export function variableNames(doc: Doc): string[] {
  const names = new Set<string>();
  for (const part of parts(doc)) for (const variable of findVariables(part)) names.add(variable.name);
  return [...names];
}

/**
 * The document after `change` has gone over its text, its header and its
 * footer, each seen as a document; where it gives nothing back, that part
 * stays as it is.
 */
function mapParts(doc: Doc, change: (part: Doc) => Doc | undefined): Doc {
  let next = change(doc) ?? doc;
  for (const key of ['header', 'footer'] as const) {
    const story = doc[key];
    if (!story) continue;
    const changed = change({ ...doc, paragraphs: story.paragraphs, tables: story.tables });
    if (changed) next = { ...next, [key]: { ...story, paragraphs: changed.paragraphs } };
  }
  return next;
}

/**
 * The document with each variable that has a value replaced by it, written
 * as its formats ask, in the text, the header and the footer. A variable
 * without a value stays as it is.
 */
export function fillVariables(doc: Doc, values: Record<string, string>, options: FormatOptions = {}): Doc {
  return mapParts(doc, (part) => {
    const found = findVariables(part).filter((variable) => values[variable.name] !== undefined);
    if (!found.length) return undefined;
    let next = part;
    // From the last one back, so the ones still to do keep their place.
    for (let i = found.length - 1; i >= 0; i--) {
      const { name, formats, range } = found[i];
      const { text, props } = formatValue(values[name], formats, options);
      const replaced = replaceRange(next, range, text);
      next = Object.keys(props).length ? applyRunProps(replaced.doc, { from: range.from, to: replaced.pos }, props) : replaced.doc;
    }
    return next;
  });
}

/** How many times the variable is used in the document, its header and its footer. */
export function variableUses(doc: Doc, name: string): number {
  return parts(doc).reduce((count, part) => count + findVariables(part).filter((variable) => variable.name === name).length, 0);
}

/** What would go wrong filling the document with these values: formats that do not exist, and values that are not what theirs are for. */
export function variableProblems(doc: Doc, values: Record<string, string>, options: FormatOptions = {}): (FormatProblem & { name: string })[] {
  const seen = new Set<string>();
  const out: (FormatProblem & { name: string })[] = [];
  for (const part of parts(doc)) {
    for (const { name, formats } of findVariables(part)) {
      // Without a value, only the formats themselves can be wrong.
      const { problems } = formatValue(values[name] ?? '', formats, options);
      for (const problem of problems) {
        if (problem.kind === 'value' && !values[name]) continue;
        const key = `${name}|${problem.format}|${problem.kind}`;
        if (!seen.has(key)) out.push({ name, ...problem });
        seen.add(key);
      }
    }
  }
  return out;
}

export interface ActiveFormat {
  id: FormatId;
  /** What follows the colon: the pattern of a date, the decimals of a number. */
  arg: string;
}

/** The formats every use of the variable has. */
export function variableFormats(doc: Doc, name: string): ActiveFormat[] {
  const uses = parts(doc).flatMap((part) => findVariables(part).filter((variable) => variable.name === name));
  const known = (use: Variable) => use.formats.map(parseFormat).filter((format): format is ActiveFormat => !!format.id);
  if (!uses.length) return [];
  return known(uses[0]).filter((format) => uses.every((use) => known(use).some((other) => other.id === format.id && other.arg === format.arg)));
}

/**
 * Gives a format to every use of the variable, or takes it away. A way of
 * writing a date or a number takes the place of the one there was, and so
 * does a change of capitals.
 */
export function setVariableFormat(doc: Doc, name: string, id: FormatId, on: boolean, arg = ''): Doc {
  const { group } = FORMATS[id];
  return mapParts(doc, (part) => {
    const uses = findVariables(part).filter((variable) => variable.name === name);
    let next: Doc | undefined;
    for (let i = uses.length - 1; i >= 0; i--) {
      const kept = uses[i].formats.filter((format) => {
        const other = parseFormat(format).id;
        return !other || (group === 'style' ? other !== id : FORMATS[other].group !== group);
      });
      const text = variableText(name, on ? [...kept, formatText(id, arg)] : kept);
      next = replaceRange(next ?? part, uses[i].range, text).doc;
    }
    return next;
  });
}
