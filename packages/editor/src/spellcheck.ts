// Spelling: what the editor asks of a dictionary, how it finds the words of a
// paragraph, and one dictionary to ask, Hunspell's, read by nspell in a worker
// of its own so the page does not wait while it is made ready.

// The worker, with nspell, as a string: no bundler has to find a file of it.
import { SPELL_WORKER } from './spellcheck.worker.code';

/**
 * What the editor asks to know which words are spelled wrong, and what they
 * could be instead. Any dictionary can answer: the one `createSpellChecker`
 * makes, or one of the application's own, on its server for instance.
 */
export interface SpellChecker {
  /** Whether each word is spelled right in `language`, a tag such as 'es-MX'. For a language it has no dictionary of, all of them. */
  check(words: string[], language: string): boolean[] | Promise<boolean[]>;
  /** Words it could be instead, the likeliest first. */
  suggest(word: string, language: string): string[] | Promise<string[]>;
  /** Takes the word as spelled right from now on, as "Add to dictionary" asks. Without it, the editor does not offer to. */
  add?(word: string, language: string): void;
}

/** A dictionary in Hunspell's form: the address of its .aff file and of its .dic file, or a function that gives their text. */
export type Dictionary = { aff: string; dic: string } | (() => Promise<{ aff: string; dic: string }>);

export interface SpellCheckerOptions {
  /**
   * A dictionary for each language, by its tag or by the language alone:
   * `{ es: …, en: … }` serves 'es-MX' and 'en-US' too. Each is loaded the
   * first time a text in its language is checked.
   */
  dictionaries: Record<string, Dictionary>;
}

/** The dictionary of a language: the one for its whole tag, or else for the language alone. */
export function dictionaryFor<T>(dictionaries: Record<string, T>, language: string): string | undefined {
  const tag = language.toLowerCase();
  const keys = Object.keys(dictionaries);
  return keys.find((key) => key.toLowerCase() === tag) ?? keys.find((key) => key.toLowerCase() === tag.split('-')[0]);
}

/**
 * A spell checker with Hunspell dictionaries, as LibreOffice and Firefox use,
 * read by nspell in a worker. The dictionaries are the application's to give:
 * those of wooorm/dictionaries on npm, for one, each under its own licence.
 */
export function createSpellChecker(options: SpellCheckerOptions): SpellChecker & { destroy(): void } {
  const source = URL.createObjectURL(new Blob([SPELL_WORKER], { type: 'text/javascript' }));
  const worker = new Worker(source);
  let next = 0;
  const waiting = new Map<number, { resolve: (value: never) => void; reject: (error: Error) => void }>();
  worker.addEventListener('message', (e: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
    const asked = waiting.get(e.data.id);
    if (!asked) return;
    waiting.delete(e.data.id);
    if (e.data.error) asked.reject(new Error(e.data.error));
    else asked.resolve(e.data.result as never);
  });
  const ask = <T>(message: Record<string, unknown>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const id = ++next;
      waiting.set(id, { resolve, reject });
      worker.postMessage({ id, ...message });
    });
  /** The languages whose dictionary the worker has, or is being given. */
  const loading = new Map<string, Promise<void>>();
  const ready = (language: string): Promise<string | undefined> => {
    const key = dictionaryFor(options.dictionaries, language);
    if (!key) return Promise.resolve(undefined);
    let load = loading.get(key);
    if (!load) {
      const source = options.dictionaries[key];
      load = (async () => {
        const { aff, dic } =
          typeof source === 'function'
            ? await source()
            : // Addresses as the page has them: the worker reads them from where it is.
              { aff: new URL(source.aff, document.baseURI).href, dic: new URL(source.dic, document.baseURI).href };
        await ask({ type: 'load', key, aff, dic, fetch: typeof source !== 'function' });
      })();
      // One that failed may be asked again later.
      load.catch(() => loading.delete(key));
      loading.set(key, load);
    }
    return load.then(() => key);
  };
  return {
    async check(words, language) {
      const key = await ready(language);
      return key ? ask<boolean[]>({ type: 'check', key, words }) : words.map(() => true);
    },
    async suggest(word, language) {
      const key = await ready(language);
      return key ? ask<string[]>({ type: 'suggest', key, word }) : [];
    },
    add(word, language) {
      const key = dictionaryFor(options.dictionaries, language);
      if (key) void ready(language).then(() => worker.postMessage({ id: 0, type: 'add', key, word }));
    },
    destroy() {
      worker.terminate();
      URL.revokeObjectURL(source);
      for (const asked of waiting.values()) asked.reject(new Error('The spell checker was closed.'));
      waiting.clear();
    },
  };
}

// --- The words of a paragraph ---------------------------------------------------------

/** A word: letters, with the apostrophes inside it ("don't", "l'eau"). Not Chinese or Japanese, which have no dictionary to check them in: the latin words between them are words. */
const LETTER = String.raw`(?:(?![\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])[\p{L}\p{M}])`;
const WORD = new RegExp(`${LETTER}+(?:['’]${LETTER}+)*`, 'gu');
/** What is not words to check: variables and the marks of blocks, addresses and emails. */
const NOT_WORDS = /\{\{[^}]*\}\}|\b(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w-]+\.[\w.-]+/gu;
const DIGIT = /[\p{N}_]/u;

export interface SpelledWord {
  word: string;
  from: number;
  to: number;
}

/**
 * The words of a text to check, with where each starts and ends. Left out:
 * single letters, words in capitals (initials, as "IVA"), words joined to
 * digits ("3er", "A4"), variables, addresses and emails.
 */
export function wordsToCheck(text: string): SpelledWord[] {
  const skipped = [...text.matchAll(NOT_WORDS)].map((match) => [match.index, match.index + match[0].length]);
  const words: SpelledWord[] = [];
  for (const match of text.matchAll(WORD)) {
    const from = match.index;
    const to = from + match[0].length;
    const word = match[0];
    if (word.length < 2 || skipped.some(([start, end]) => from < end && to > start)) continue;
    if (DIGIT.test(text[from - 1] ?? '') || DIGIT.test(text[to] ?? '')) continue;
    if (word === word.toUpperCase() && word !== word.toLowerCase()) continue;
    words.push({ word, from, to });
  }
  return words;
}
