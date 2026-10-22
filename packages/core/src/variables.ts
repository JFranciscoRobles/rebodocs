// Templates: a document whose text holds variables, written {{name}}, to be
// filled in with values. A variable is plain text, so any DOCX can be a
// template and Word shows it as it is; it takes the formatting of the text
// it stands in. After the name it can say how its value is to be written:
// {{fecha | fecha larga | mayúsculas}}.

import { type Doc, type Range, type RunProps, comparePositions, defined } from './model';
import { replaceRange } from './find';
import { applyRunProps } from './ops';
import { type StoryPart, storyOf, textParts, withStory } from './stories';
import { type Block, type TemplateData, expandBlocks, findBlocks, flattenValues } from './blocks';
import { documentLanguage } from './docx/source';
import { noteRanges } from './notes';

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
  upper: { write: 'mayúsculas', group: 'case', alias: ['mayusculas', 'mayuscula', 'uppercase'] },
  lower: { write: 'minúsculas', group: 'case', alias: ['minusculas', 'minuscula', 'lowercase'] },
  capital: { write: 'nombre propio', group: 'case', alias: ['capital', 'capitalizar', 'title case'] },
  bold: { write: 'negrita', group: 'style', alias: ['negritas'] },
  italic: { write: 'cursiva', group: 'style', alias: ['cursivas', 'italica'] },
  underline: { write: 'subrayado', group: 'style' },
  date: { write: 'fecha', group: 'type', alias: ['fecha corta'] },
  dateLong: { write: 'fecha larga', group: 'type', alias: ['long date'] },
  dateFull: { write: 'fecha completa', group: 'type', alias: ['full date'] },
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

/** The English name of each format, as a document written in English says it. */
const ENGLISH: Record<FormatId, string> = {
  upper: 'upper',
  lower: 'lower',
  capital: 'capital',
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  date: 'date',
  dateLong: 'long date',
  dateFull: 'full date',
  number: 'number',
  currency: 'currency',
};

/**
 * How a format is written in a document, in a language: `formatText('date',
 * 'dd/MM/yyyy')` is `date: dd/MM/yyyy`, and in Spanish `fecha: dd/MM/yyyy`.
 * English when no language is given; both names are read whichever is written.
 */
export function formatText(id: FormatId, arg = '', language = 'en'): string {
  const name = language.toLowerCase().startsWith('es') ? FORMATS[id].write : ENGLISH[id];
  return arg ? `${name}: ${arg}` : name;
}

/** The language values are written in when none is given. */
const DEFAULT_LOCALE = 'en-US';

interface Day {
  year: number;
  month: number;
  day: number;
}

/** Whether a language writes the month before the day, as in the United States: 10/12/2026 is October 12. */
function monthFirst(locale: string): boolean {
  try {
    const parts = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' }).formatToParts(new Date(Date.UTC(2026, 9, 12)));
    return parts.findIndex((part) => part.type === 'month') < parts.findIndex((part) => part.type === 'day');
  } catch {
    return false;
  }
}

/** The day a value names: `2026-10-12`, `12/10/2026` (the day first, or the month for a language that puts it first), `hoy` or `today`. */
function parseDay(value: string, today: Date, locale: string): Day | undefined {
  const text = value.trim();
  if (plain(text) === 'hoy' || plain(text) === 'today') return { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() };
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(text);
  const local = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(text);
  if (!iso && !local) return undefined;
  const swap = !iso && monthFirst(locale);
  const [year, month, day] = iso
    ? [+iso[1], +iso[2], +iso[3]]
    : [+local![3] < 100 ? 2000 + +local![3] : +local![3], +local![swap ? 1 : 2], +local![swap ? 2 : 1]];
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
function writeDay({ year, month, day }: Day, pattern: string, locale: string): string {
  const at = new Date(Date.UTC(year, month - 1, day));
  /** A name of the day in the language asked for. */
  const named = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(at);
  return pattern.replace(/\p{L}+/gu, (word) => {
    switch (word.toLowerCase()) {
      case 'd':
        return String(day);
      case 'dd':
        return two(day);
      case 'dddd':
        return named({ weekday: 'long' });
      case 'm':
        return String(month);
      case 'mm':
        return two(month);
      case 'mmm':
        return named({ month: 'short' });
      case 'mmmm':
        return named({ month: 'long' });
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

/** A day in a language, as it writes it: short with its digits, long, or with the day of the week. */
function writeDayIn({ year, month, day }: Day, id: 'date' | 'dateLong' | 'dateFull', locale: string): string {
  const style: Intl.DateTimeFormatOptions = id === 'date' ? { day: '2-digit', month: '2-digit', year: 'numeric' } : { dateStyle: id === 'dateLong' ? 'long' : 'full' };
  return new Intl.DateTimeFormat(locale, { ...style, timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * A number as a language writes it, with `decimals` when given, or as a
 * currency of that code. Undefined for a value that is not a number.
 */
function writeNumberIn(value: string, decimals: number | undefined, locale: string, currency?: string): string | undefined {
  const text = value.replace(/[$\s,]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(text)) return undefined;
  const digits = decimals ?? (currency ? undefined : Math.min(20, text.split('.')[1]?.length ?? 0));
  const options: Intl.NumberFormatOptions = currency ? { style: 'currency', currency } : {};
  if (digits !== undefined) Object.assign(options, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const written = new Intl.NumberFormat(locale, options).format(Number(text));
  // What rounds to nothing has no sign: -0.004 is 0.00.
  return /[1-9]/.test(written) ? written : written.replace(/^[-\u2212]/, '');
}

/** Why a variable could not be written as its format asks. */
export interface FormatProblem {
  format: string;
  /** `format`: there is no such format. `value`: the value is not what the format is for (not a date, not a number). */
  kind: 'format' | 'value';
}

export interface FormatOptions {
  /** The day `hoy` (or `today`) stands for; today, if it is not given. */
  today?: Date;
  /**
   * The language values are written in, as a tag: 'en-US', 'es-MX', 'de-DE'.
   * It gives the names of months and days, the order of a day written with
   * its digits, the separators of numbers and the rules of capitals. Left
   * out, `fillVariables` and `variableProblems` take the document's; without
   * one there either, English: 10/12/2026, October 12, 2026, 1,234.50 and
   * $1,234.50.
   */
  locale?: string;
  /**
   * The code of the currency `moneda` writes ('EUR', 'MXN'), as the language
   * writes it: 1.234,50 € in German. Without one, a dollar sign before the
   * number. A format can name its own: `moneda: EUR`.
   */
  currency?: string;
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
    const locale = options.locale ?? DEFAULT_LOCALE;
    if (id === 'upper') next = text.toLocaleUpperCase(locale);
    else if (id === 'lower') next = text.toLocaleLowerCase(locale);
    else if (id === 'capital') next = text.toLocaleLowerCase(locale).replace(/(^|[^\p{L}\p{N}'’])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toLocaleUpperCase(locale));
    else if (id === 'bold' || id === 'italic' || id === 'underline') props[id] = true;
    else if (id === 'date' || id === 'dateLong' || id === 'dateFull') {
      const day = parseDay(text, options.today ?? new Date(), locale);
      const pattern = id === 'date' && arg;
      next = day && (pattern ? writeDay(day, pattern, locale) : writeDayIn(day, id, locale));
    } else if (id === 'number' || id === 'currency') {
      const decimals = /^\d$/.test(arg) ? +arg : id === 'currency' ? 2 : undefined;
      // A currency by its code: the one of the format, or the one given.
      const code = id === 'currency' ? (/^[a-z]{3}$/i.test(arg) ? arg.toUpperCase() : options.currency) : undefined;
      try {
        next = writeNumberIn(text, decimals, locale, code);
        if (next !== undefined && id === 'currency' && !code) next = next.startsWith('-') ? `-$${next.slice(1)}` : `$${next}`;
      } catch {
        // A code or a language Intl does not know.
        next = undefined;
      }
    } else {
      problems.push({ format, kind: 'format' });
    }
    if (next === undefined) problems.push({ format, kind: 'value' });
    else text = next;
  }
  return { text, props, problems };
}

// --- In the document ---------------------------------------------------------------

/**
 * Every variable in the paragraphs of the document, in order. Marks that take
 * no room do not break one up, and neither does text taken out while changes
 * are tracked: it is no longer part of what the document says.
 */
export function findVariables(doc: Pick<Doc, 'paragraphs'>): Variable[] {
  const out: Variable[] = [];
  doc.paragraphs.forEach((p, para) => {
    let text = '';
    const at: number[] = [];
    let offset = 0;
    for (const run of p.runs) {
      if (!run.props.object && run.props.revision !== 'delete') {
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

/** Each part of the document as a document of its own: its text first (no part), then the others. */
const parts = (doc: Doc): { part?: StoryPart; doc: Doc }[] => [
  { doc },
  ...textParts(doc).flatMap((part) => {
    const story = storyOf(doc, part);
    return story ? [{ part, doc: { ...doc, paragraphs: story.paragraphs, tables: story.tables } }] : [];
  }),
];

/** The names of the variables of the document, its headers, footers, notes and text boxes, each once, in the order they first appear. */
export function variableNames(doc: Doc): string[] {
  const names = new Set<string>();
  for (const { doc: part } of parts(doc)) for (const variable of findVariables(part)) names.add(variable.name);
  return [...names];
}

/**
 * The document after `change` has gone over its text and each of its other
 * parts, each seen as a document; where it gives nothing back, that part
 * stays as it is.
 */
function mapParts(doc: Doc, change: (part: Doc) => Doc | undefined): Doc {
  let next = change(doc) ?? doc;
  for (const part of textParts(doc)) {
    const story = storyOf(next, part);
    if (!story) continue;
    const changed = change({ ...next, paragraphs: story.paragraphs, tables: story.tables });
    if (changed) next = withStory(next, part, { ...story, paragraphs: changed.paragraphs, ...(changed.tables ? { tables: changed.tables } : {}) });
  }
  return next;
}

/** The variables of one part filled with the values given, as they are named; the same part when none has a value. */
function fillPart(part: Doc, values: Record<string, string>, options: FormatOptions): Doc {
  const found = findVariables(part).filter((variable) => values[variable.name] !== undefined);
  let next = part;
  // From the last one back, so the ones still to do keep their place.
  for (let i = found.length - 1; i >= 0; i--) {
    const { name, formats, range } = found[i];
    const { text, props } = formatValue(values[name], formats, options);
    const change = insertedAt(next, range);
    const replaced = replaceRange(next, range, text);
    const added = { ...props, ...change };
    next = Object.keys(added).length && text ? applyRunProps(replaced.doc, { from: range.from, to: replaced.pos }, added) : replaced.doc;
  }
  return next;
}

/**
 * The document with each variable that has a value replaced by it, written
 * as its formats ask, in the text, the headers, the footers, the notes and the
 * text boxes, and each block written out: repeated for each item of its list,
 * kept or taken away (see blocks.ts). Values may be nested, `{ client: {
 * name } }` filling {{client.name}}. A variable or a block without a value
 * stays as it is. One put in while changes were tracked gives its value as
 * put in, by the same person. Without `locale`, values are written in the
 * language of the document, or in English when it says none.
 */
export function fillVariables(doc: Doc, values: TemplateData, given: FormatOptions = {}): Doc {
  const options = inLanguageOf(doc, given);
  const flat = flattenValues(values);
  return mapParts(doc, (part) => {
    const expanded = expandBlocks(part, values, (inside, data) => fillPart(inside, flattenValues(data), options));
    const next = fillPart(expanded, flat, options);
    return next === part ? undefined : next;
  });
}

/** Values are written in the language given, or else in the document's, or else in English. */
function inLanguageOf(doc: Doc, options: FormatOptions): FormatOptions {
  const language = options.locale ? undefined : documentLanguage(doc);
  return language ? { ...options, locale: language } : options;
}

/** The mark of a variable put in while changes were tracked, which its value keeps: who put it in, and when. */
function insertedAt(doc: Doc, range: Range): RunProps {
  let offset = 0;
  for (const run of doc.paragraphs[range.from.para].runs) {
    if (offset + run.text.length > range.from.offset) {
      const { revision, revisionAuthor, revisionDate } = run.props;
      return revision === 'insert' ? defined({ revision, revisionAuthor, revisionDate }) : {};
    }
    offset += run.text.length;
  }
  return {};
}

/** The blocks of the document, its headers, footers, notes and text boxes, each once by its name and sign. */
export function templateBlocks(doc: Doc): Block[] {
  const out: Block[] = [];
  for (const { doc: part } of parts(doc)) for (const block of findBlocks(part)) if (!out.some((one) => one.name === block.name && one.inverted === block.inverted)) out.push(block);
  return out;
}

/**
 * Every use of a variable in the document, its headers, footers, notes and
 * text boxes, in that order, each with the part it is in (none for the text):
 * its range is in that part.
 */
export function findAllVariables(doc: Doc): (Variable & { part?: StoryPart })[] {
  return parts(doc).flatMap(({ part, doc: text }) => findVariables(text).map((variable) => (part ? { ...variable, part } : variable)));
}

/**
 * What the notes on the variables say: for each variable a note is put on, on
 * it or on a part of it, the text of each such note, once. In a template, a
 * note on a variable says what to fill it with: "As written on the ID".
 */
export function variableNotes(doc: Doc): Record<string, string[]> {
  const texts = new Map((doc.notes ?? []).map((note) => [note.id, note.text.trim()]));
  const notes = noteRanges(doc).filter((note) => texts.get(note.id));
  const out: Record<string, string[]> = {};
  if (!notes.length) return out;
  for (const variable of findVariables(doc)) {
    for (const note of notes) {
      const touches = comparePositions(note.range.from, variable.range.to) < 0 && comparePositions(variable.range.from, note.range.to) < 0;
      const text = texts.get(note.id)!;
      if (touches && !out[variable.name]?.includes(text)) (out[variable.name] ??= []).push(text);
    }
  }
  return out;
}

/** How many times the variable is used in the document, its headers, footers, notes and text boxes. */
export function variableUses(doc: Doc, name: string): number {
  return findAllVariables(doc).filter((variable) => variable.name === name).length;
}

/** What would go wrong filling the document with these values: formats that do not exist, and values that are not what theirs are for. */
export function variableProblems(doc: Doc, data: TemplateData, given: FormatOptions = {}): (FormatProblem & { name: string })[] {
  const options = inLanguageOf(doc, given);
  const values = flattenValues(data);
  const seen = new Set<string>();
  const out: (FormatProblem & { name: string })[] = [];
  for (const { doc: part } of parts(doc)) {
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
  const uses = findAllVariables(doc).filter((variable) => variable.name === name);
  const known = (use: Variable) => use.formats.map(parseFormat).filter((format): format is ActiveFormat => !!format.id);
  if (!uses.length) return [];
  return known(uses[0]).filter((format) => uses.every((use) => known(use).some((other) => other.id === format.id && other.arg === format.arg)));
}

/**
 * Gives a format to every use of the variable, or takes it away. A way of
 * writing a date or a number takes the place of the one there was, and so
 * does a change of capitals.
 */
export function setVariableFormat(doc: Doc, name: string, id: FormatId, on: boolean, arg = '', language?: string): Doc {
  const { group } = FORMATS[id];
  return mapParts(doc, (part) => {
    const uses = findVariables(part).filter((variable) => variable.name === name);
    let next: Doc | undefined;
    for (let i = uses.length - 1; i >= 0; i--) {
      const kept = uses[i].formats.filter((format) => {
        const other = parseFormat(format).id;
        return !other || (group === 'style' ? other !== id : FORMATS[other].group !== group);
      });
      const text = variableText(name, on ? [...kept, formatText(id, arg, language ?? documentLanguage(doc))] : kept);
      next = replaceChanged(next ?? part, uses[i].range, text);
    }
    return next === part ? undefined : next;
  });
}

/**
 * The text of `range` made `text`, by replacing only what differs: the
 * characters both start and end with stay as they were, and so does what was
 * put in or taken out of them while changes were tracked.
 */
function replaceChanged(doc: Doc, range: Range, text: string): Doc {
  // Where each character that reads is, past the text taken out.
  const at: number[] = [];
  let was = '';
  let offset = 0;
  for (const run of doc.paragraphs[range.from.para].runs) {
    for (let i = 0; i < run.text.length; i++, offset++) {
      if (offset < range.from.offset || offset >= range.to.offset || run.props.revision === 'delete') continue;
      at.push(offset);
      was += run.text[i];
    }
  }
  if (was === text) return doc;
  let start = 0;
  while (start < was.length && start < text.length && was[start] === text[start]) start++;
  let end = 0;
  while (end < was.length - start && end < text.length - start && was[was.length - 1 - end] === text[text.length - 1 - end]) end++;
  const para = range.from.para;
  const from = start < at.length ? at[start] : range.to.offset;
  const to = was.length - end > start ? at[was.length - end - 1] + 1 : from;
  return replaceRange(doc, { from: { para, offset: from }, to: { para, offset: to } }, text.slice(start, text.length - end)).doc;
}
