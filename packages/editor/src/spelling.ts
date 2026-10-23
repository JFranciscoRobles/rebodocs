// The words spelled wrong in what the editor shows: which of them the spell
// checker was asked about, what it said, in which language, and what the
// person said to leave alone. Only the words of the paragraphs drawn are
// asked about, all at once, a moment after typing stops; the word being typed
// is left alone until it is finished.

import { type Paragraph, type Position, type Range, paragraphText } from '@rebodocs/core/internal';
import { type SpellChecker, type SpelledWord, wordsToCheck } from './spellcheck';

/** How long after the last key the words not known yet are asked about. */
const SPELL_WAIT_MS = 250;

/** What it needs of the editor. */
export interface SpellingHost {
  /** The language the text is checked in. */
  language(): string;
  /** The paragraphs of what is being written in. */
  paragraphs(): Paragraph[];
  /** Whether that is the body of the document: words are checked there alone, and not while nothing may change. */
  checking(): boolean;
  /** Draws the mark under a word spelled wrong, where its paragraph is drawn. */
  underline(range: Range): void;
  /** Draws the marks again, because what is known of the words changed. */
  redraw(): void;
  /** Whether the editor is still on the page. */
  connected(): boolean;
}

export class Spelling {
  private speller: SpellChecker | undefined;
  /** What the dictionary said of each word, by the language it was asked in. */
  private readonly spelled = new Map<string, Map<string, boolean>>();
  /** Words seen on the pages drawn and not yet asked about, and whether a question is on its way. */
  private readonly waiting = new Set<string>();
  private asking = false;
  private timer = 0;
  /** Words the person said to leave alone in this document. */
  private readonly ignored = new Set<string>();
  /** The suggestions for each word, once asked. */
  private readonly suggestions = new Map<string, Promise<string[]>>();
  /** The words of a paragraph to check, kept while it is the same. */
  private readonly words = new WeakMap<Paragraph, SpelledWord[]>();
  /** Where the caret was left by typing: the word it ends is not marked until it is finished. */
  typedAt: Position | undefined;

  constructor(private readonly host: SpellingHost) {}

  get checker(): SpellChecker | undefined {
    return this.speller;
  }

  /** Another spell checker, or none: says whether it is another, and what the last one said is forgotten. */
  use(checker: SpellChecker | undefined): boolean {
    if (checker === this.speller) return false;
    this.speller = checker;
    this.spelled.clear();
    this.waiting.clear();
    this.suggestions.clear();
    return true;
  }

  /** Marks the words spelled wrong in these paragraphs, first and last, and asks about those not known yet. */
  mark(paras: [number, number] | undefined): void {
    const { host } = this;
    if (!this.speller || !host.checking() || !paras) return;
    const typed = this.typedAt;
    for (let p = paras[0]; p <= paras[1]; p++) {
      const para = host.paragraphs()[p];
      if (!para) continue;
      for (const word of this.wordsOf(para)) {
        // The word being written is not finished yet.
        if (typed && typed.para === p && typed.offset === word.to) continue;
        const right = this.right(word.word);
        if (right === undefined) this.waiting.add(word.word);
        if (right === false) host.underline({ from: { para: p, offset: word.from }, to: { para: p, offset: word.to } });
      }
    }
    if (this.waiting.size) {
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => void this.ask(), SPELL_WAIT_MS);
    }
  }

  /** The word spelled wrong at a place, or that the place is at the end of; undefined when there is none, or it is not known yet. */
  wrongAt(para: number, offset: number): { word: string; range: Range } | undefined {
    if (!this.speller) return undefined;
    const paragraph = this.host.paragraphs()[para];
    const word = paragraph && this.wordsOf(paragraph).find((one) => one.from <= offset && offset <= one.to);
    if (!word || this.right(word.word) !== false) return undefined;
    return { word: word.word, range: { from: { para, offset: word.from }, to: { para, offset: word.to } } };
  }

  /** What a word could be instead, the likeliest first: asked once for each. */
  suggest(word: string): Promise<string[]> {
    const speller = this.speller;
    if (!speller) return Promise.resolve([]);
    const language = this.host.language();
    const key = `${language}\n${word}`;
    let asked = this.suggestions.get(key);
    if (!asked) {
      asked = Promise.resolve(speller.suggest(word, language)).catch(() => []);
      this.suggestions.set(key, asked);
    }
    return asked;
  }

  /** Leaves a word, and every other one like it, unmarked in this document. */
  ignore(word: string): void {
    this.ignored.add(word);
  }

  /** Gives a word to the dictionary, as spelled right from now on; says whether it takes words. */
  add(word: string): boolean {
    if (!this.speller?.add) return false;
    this.speller.add(word, this.host.language());
    this.spelled.get(this.host.language())?.set(word, true);
    return true;
  }

  stop(): void {
    window.clearTimeout(this.timer);
  }

  private wordsOf(para: Paragraph): SpelledWord[] {
    let words = this.words.get(para);
    if (!words) {
      // Text taken out, while the change waits, is not checked.
      const gone: [number, number][] = [];
      let at = 0;
      for (const run of para.runs) {
        if (run.props.revision === 'delete') gone.push([at, at + run.text.length]);
        at += run.text.length;
      }
      words = wordsToCheck(paragraphText(para)).filter((word) => !gone.some(([from, to]) => word.from < to && word.to > from));
      this.words.set(para, words);
    }
    return words;
  }

  /** What the dictionary said of a word in the language of the text: undefined until it has said. */
  private right(word: string): boolean | undefined {
    if (this.ignored.has(word)) return true;
    return this.spelled.get(this.host.language())?.get(word);
  }

  /** Asks the dictionary about the words waiting, in one question, and marks what it says. */
  private async ask(): Promise<void> {
    const speller = this.speller;
    if (!speller || this.asking || !this.waiting.size) return;
    const language = this.host.language();
    const words = [...this.waiting];
    this.waiting.clear();
    this.asking = true;
    let known = this.spelled.get(language);
    if (!known) this.spelled.set(language, (known = new Map()));
    try {
      const answers = await speller.check(words, language);
      words.forEach((word, i) => known.set(word, answers[i] !== false));
    } catch {
      // A dictionary that cannot be had marks nothing, rather than every word.
      for (const word of words) known.set(word, true);
    } finally {
      this.asking = false;
    }
    if (speller !== this.speller || !this.host.connected()) return;
    this.host.redraw();
    if (this.waiting.size) void this.ask();
  }
}
