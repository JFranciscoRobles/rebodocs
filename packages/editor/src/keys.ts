// The hidden field the document is typed in: the keys that move, delete and
// format, text that a keyboard composes, as phones do, what a screen reader
// is told the caret moved over, and the clipboard. A screen reader's own mode,
// where the field holds the paragraph, is the editor's (`mirror`).

import {
  type Position,
  adjacentLine,
  comparePositions,
  deleteRange,
  docEnd,
  docStart,
  type Paragraph,
  type Run,
  revisionAt,
  footnoteNumbers,
  footnoteReferenceId,
  altText,
  noteLabels,
  endnoteReferenceId,
  linkAt,
  insertFragment,
  imageExtension,
  lineEndOffset,
  lineForPosition,
  listKindAt,
  locateCell,
  moveChar,
  moveWord,
  neighbourCell,
  offsetAtX,
  orderedRange,
  outsideField,
  paragraphLength,
  paragraphText,
  paragraphStyles,
  styleIdAt,
  textInRange,
  wordRangeAt,
  xAtOffset,
  clipHtml,
  clipText,
  parseClip,
  serializeClip,
} from '@rebodocs/core/internal';
import { styleName, t } from './i18n';
import { type Spoken, spokenChar, spokenText } from './a11y';
import { clipFromHtml, hasImages, readClipImages } from './paste';
import { IS_MAC } from './platform';

import type { Editor, Selection } from './editor';

/** What this editor puts on the clipboard for itself: the copied text, whole, with its formatting. */
const CLIP_TYPE = 'application/x-rebodocs+json';

/**
 * What the hidden field the keyboard writes to always holds, ahead of what is
 * typed: a character that shows nothing. An on-screen keyboard says nothing
 * of a Backspace in an empty field; with this in it, it takes the character
 * away, and that is how the key is known.
 */
const INPUT_MARK = '\u200B';

export class Keys {
  constructor(private readonly editor: Editor) {}

  /** Starts taking what the hidden field is given. */
  listen(): void {
    const field = this.editor.input;
    field.addEventListener('keydown', this.onKeyDown);
    field.addEventListener('input', this.onInput);
    field.addEventListener('compositionstart', () => (this.editor.composing = true));
    field.addEventListener('compositionend', this.onCompositionEnd);
    field.addEventListener('copy', this.onCopy);
    field.addEventListener('cut', this.onCut);
    field.addEventListener('paste', this.onPaste);
  }

  /** Set by the keys of a paste without formatting, for the paste that follows them. */
  private plainPaste = false;

  /** How the last key moved the caret, for saying what it moved over. */
  private moved: 'char' | 'word' | 'line' | 'all' | undefined;

  /** The page last said, so that a new one is said once. */
  private spokenPage = -1;

  /** What of the text in the hidden field is already in the document: a word still being composed, as far as it has got. */
  private typed = '';

  /** Where the caret was left by what was typed, which is where the rest of it goes. */
  private typedEnd: Position | undefined;

  private moveTo(pos: Position, extend: boolean): void {
    this.editor.setSelection(extend ? this.editor.selection.anchor : pos, pos);
  }

  private moveHorizontal(dir: -1 | 1, byWord: boolean, extend: boolean): void {
    if (!extend && !this.editor.collapsed) {
      this.moved = 'char';
      this.moveTo(dir < 0 ? this.editor.range.from : this.editor.range.to, false);
      return;
    }
    const focus = this.editor.selection.focus;
    this.moved = byWord ? 'word' : 'char';
    this.moveTo(byWord ? moveWord(this.editor.text, focus, dir) : moveChar(this.editor.text, focus, dir), extend);
  }

  private moveVertical(dir: -1 | 1, extend: boolean): void {
    const focus = this.editor.selection.focus;
    const shown = this.editor.mapOffset(focus, true);
    const line = lineForPosition(this.editor.flow, shown);
    const x = this.editor.goalX ?? xAtOffset(line, shown.offset, this.editor.measurer);
    const target = adjacentLine(this.editor.flow, line, x, dir);
    const pos = target ? this.editor.mapOffset({ para: target.para, offset: offsetAtX(target, x, this.editor.measurer) }, false) : dir < 0 ? docStart() : docEnd(this.editor.text);
    this.moved = 'line';
    this.moveTo(pos, extend);
    this.editor.goalX = x;
  }

  /** Selects the contents of the next (1) or previous (-1) table cell, as Tab does in Word. */
  private moveToCell(dir: -1 | 1): void {
    let cell = neighbourCell(this.editor.text, this.editor.selection.focus.para, dir);
    if (!cell && dir > 0) {
      // Tab in the last cell adds a row and goes on into it.
      this.editor.insertTableRow(true);
      cell = neighbourCell(this.editor.text, this.editor.selection.focus.para, dir);
    }
    if (!cell) return;
    this.moved = 'line';
    const end = { para: cell.to, offset: paragraphLength(this.editor.text.paragraphs[cell.to]) };
    this.editor.setSelection({ para: cell.from, offset: 0 }, end);
  }

  private moveToLineEdge(dir: -1 | 1, extend: boolean): void {
    const line = lineForPosition(this.editor.flow, this.editor.mapOffset(this.editor.selection.focus, true));
    this.moved = 'line';
    this.moveTo(this.editor.mapOffset({ para: line.para, offset: dir < 0 ? line.start : lineEndOffset(line) }, false), extend);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const before = this.editor.selection;
    this.moved = undefined;
    this.handleKey(e);
    if (this.moved) this.announceMove(before);
    this.moved = undefined;
  };

  private handleKey(e: KeyboardEvent): void {
    this.editor.pointer.hideNoteTip();
    if (e.isComposing || this.editor.composing) return;
    const mod = e.metaKey || e.ctrlKey;
    const byWord = e.altKey || (e.ctrlKey && !e.metaKey);
    let handled = true;
    // Ctrl+Shift+V pastes the text alone, as it pastes in Word and in browsers; the paste itself is the browser's.
    this.plainPaste = mod && e.shiftKey && e.code === 'KeyV';
    if (this.plainPaste && IS_MAC && !e.altKey) {
      // A Mac has no paste for ⌘⇧V: the text is read from the clipboard here.
      e.preventDefault();
      this.plainPaste = false;
      void this.editor.paste({ plain: true });
      return;
    }

    if ((IS_MAC ? e.metaKey : e.ctrlKey) && e.altKey && !e.shiftKey && e.code === 'KeyZ') {
      this.editor.screenReader = !this.editor.screenReader;
      e.preventDefault();
      return;
    }
    if (mod && e.altKey && e.code === 'KeyF') {
      // A note at the foot of the page, with the keys Word has for it.
      this.editor.insertFootnote();
      e.preventDefault();
      return;
    }
    if (mod && e.altKey && e.code === 'KeyD') {
      // And one at the end.
      this.editor.insertEndnote();
      e.preventDefault();
      return;
    }
    if (mod && e.shiftKey && !e.altKey && e.code === 'KeyE') {
      // Tracking changes on and off, with the keys Word has for it.
      this.editor.setTrackChanges(!this.editor.trackChanges);
      e.preventDefault();
      return;
    }
    if (mod && !e.altKey) {
      switch (e.key?.toLowerCase()) {
        case 'b':
          this.editor.toggleMark('bold');
          break;
        case 'i':
          this.editor.toggleMark('italic');
          break;
        case 'u':
          this.editor.toggleMark('underline');
          break;
        case 'k':
          if (this.editor.onLinkKey) this.editor.onLinkKey();
          else handled = false;
          break;
        case 'a':
          this.editor.selectAll();
          break;
        case 'z':
          if (e.shiftKey) this.editor.redo();
          else this.editor.undo();
          break;
        case 'y':
          this.editor.redo();
          break;
        case 'enter':
          this.editor.insertPageBreak();
          break;
        case 'arrowleft':
          if (e.metaKey) this.moveToLineEdge(-1, e.shiftKey);
          else this.moveHorizontal(-1, true, e.shiftKey);
          break;
        case 'arrowright':
          if (e.metaKey) this.moveToLineEdge(1, e.shiftKey);
          else this.moveHorizontal(1, true, e.shiftKey);
          break;
        case 'arrowup':
        case 'home':
          this.moveTo(docStart(), e.shiftKey);
          break;
        case 'arrowdown':
        case 'end':
          this.moveTo(docEnd(this.editor.text), e.shiftKey);
          break;
        case 'backspace':
          this.editor.deleteBackward(true);
          break;
        case 'delete':
          this.editor.deleteForward(true);
          break;
        default:
          handled = false;
      }
    } else {
      switch (e.key) {
        case 'ArrowLeft':
          this.moveHorizontal(-1, byWord, e.shiftKey);
          break;
        case 'ArrowRight':
          this.moveHorizontal(1, byWord, e.shiftKey);
          break;
        case 'ArrowUp':
          this.moveVertical(-1, e.shiftKey);
          break;
        case 'ArrowDown':
          this.moveVertical(1, e.shiftKey);
          break;
        case 'Home':
          this.moveToLineEdge(-1, e.shiftKey);
          break;
        case 'End':
          this.moveToLineEdge(1, e.shiftKey);
          break;
        case 'Backspace':
          this.editor.deleteBackward(byWord);
          break;
        case 'Delete':
          this.editor.deleteForward(byWord);
          break;
        case 'Enter':
          if (e.shiftKey) this.editor.insertLineBreak();
          else this.editor.insertParagraphBreak();
          break;
        case 'Escape':
          if (this.editor.area === 'body') handled = false;
          else this.editor.setArea('body');
          break;
        case 'Tab':
          // Restricted, from one stretch that may be changed to the next, as Word goes.
          if (this.editor.restricted && this.editor.nextEditable(e.shiftKey ? -1 : 1)) break;
          if (this.editor.text.paragraphs[this.editor.selection.focus.para].cell) this.moveToCell(e.shiftKey ? -1 : 1);
          else if (this.editor.tabChangesLevel()) this.editor.shiftListLevel(e.shiftKey ? -1 : 1);
          else this.editor.insertText('\t');
          break;
        default:
          handled = false;
      }
    }
    if (handled) e.preventDefault();
  }

  /**
   * Says what a key moved the caret over: the character, the word or the line
   * it is now at, or what it added to the selection or took from it; and,
   * before that, where it is when that changed: the page, a table cell, a
   * heading, a list, a link, a tracked change.
   */
  private announceMove(before: Selection): void {
    const { anchor, focus } = this.editor.selection;
    if (comparePositions(focus, before.focus) === 0 && comparePositions(anchor, before.anchor) === 0) return;
    const doc = this.editor.text;
    const parts: Spoken[] = [];
    /** Text of the document, in its language when it has one of its own. */
    const lang = this.editor.textLanguage;
    const own = (text: string): Spoken => (lang ? { text, lang } : text);
    if (this.editor.area === 'body') {
      const page = lineForPosition(this.editor.flow, this.editor.mapOffset(focus, true)).page;
      if (page !== this.spokenPage && this.spokenPage >= 0) parts.push(t('a11y.page', { page: this.editor.pageOf(page) + 1 }));
      this.spokenPage = page;
    }
    // Shift and an arrow that brings the focus back to the anchor takes the last of the selection away: that is said too.
    const selecting = comparePositions(anchor, focus) !== 0 || (comparePositions(before.anchor, before.focus) !== 0 && comparePositions(anchor, before.anchor) === 0);
    // While selecting, what is said is what was selected, not where it is.
    if (focus.para !== before.focus.para && !selecting) parts.push(...this.whereIs(focus.para, before.focus.para));
    // In the mode for screen readers, the text is the screen reader's to read, from the field: only where it is is said.
    const reader = !!this.editor.mirror;
    if (reader && selecting) {
      // Nothing is said of a selection: the screen reader says what it selected.
    } else if (selecting) {
      // By where the focus went: away from the anchor, or past it to the other side, is more selected. Pictures count, which the text leaves out.
      const side = comparePositions(anchor, focus);
      const step = comparePositions(focus, before.focus);
      const crossed = comparePositions(anchor, before.focus) !== 0 && Math.sign(comparePositions(anchor, before.focus)) !== Math.sign(side);
      const grew = side !== 0 && (comparePositions(anchor, before.anchor) !== 0 || crossed || (side < 0 ? step > 0 : step < 0));
      const range = orderedRange(before.focus, focus);
      const moved = range.from.para === range.to.para ? this.spokenSlice(doc.paragraphs[range.from.para], range.from.offset, range.to.offset) : textInRange(doc, range);
      // A character that is the mark between two paragraphs is the end of the first.
      const said = range.from.para !== range.to.para && moved === '\n' ? t('a11y.endOfParagraph') : this.moved === 'char' && moved.length <= 1 ? spokenChar(moved) : spokenText(moved);
      parts.push(t(grew ? 'a11y.selected' : 'a11y.unselected', { text: said }));
    } else {
      const text = paragraphText(doc.paragraphs[focus.para]);
      if (reader) {
        // What the caret is at is read from the field.
      } else if (this.moved === 'char') {
        // The marks the caret stepped over to get here are said too: going left, a note's number is behind it.
        const p = doc.paragraphs[focus.para];
        if (before.focus.para === focus.para && before.focus.offset > focus.offset) {
          const crossed = this.spokenSlice(p, focus.offset + 1, before.focus.offset).trim();
          if (crossed) parts.push(crossed);
        }
        const at = this.spokenAt(p, focus.offset);
        // A letter is the document's; a space or a picture is said in the words of the interface.
        parts.push(at === text[focus.offset] ? own(at) : at);
      } else if (this.moved === 'word') {
        const word = wordRangeAt(doc, focus);
        parts.push(word.to.offset > word.from.offset ? own(text.slice(word.from.offset, word.to.offset)) : spokenChar(text[focus.offset]));
      } else {
        const line = lineForPosition(this.editor.flow, this.editor.mapOffset(focus, true));
        const from = this.editor.mapOffset({ para: line.para, offset: line.start }, false).offset;
        const to = this.editor.mapOffset({ para: line.para, offset: line.end }, false).offset;
        const said = spokenText(this.spokenSlice(doc.paragraphs[focus.para], from, to));
        parts.push(said === t('a11y.blank') ? said : own(said));
      }
      const link = linkAt(doc, focus);
      const was = linkAt(doc, before.focus);
      if (link?.href && link.href !== was?.href) parts.push(t('a11y.link', { href: link.href }));
      const revision = revisionAt(doc.paragraphs, focus);
      const left = revisionAt(doc.paragraphs, before.focus);
      // Each call makes the change anew: it is the same one when it starts at the same place, of the same kind.
      const same = left && revision && left.type === revision.type && comparePositions(left.range.from, revision.range.from) === 0;
      if (revision && !same) {
        parts.push(t(revision.type === 'delete' ? 'a11y.removed' : revision.type === 'format' ? 'a11y.formatted' : 'a11y.inserted', { author: revision.author }));
      }
    }
    // Under what the screen reader reads from the field, not over it. A part that ends a sentence needs no other stop.
    const said: Spoken[] = [];
    for (const part of parts) {
      const last = said[said.length - 1];
      if (last !== undefined) said.push(/[.!?:…]$/.test(typeof last === 'string' ? last : last.text) ? ' ' : '. ');
      said.push(part);
    }
    this.editor.announcer.say(said, !reader);
  }

  /**
   * What an object of the text is called, read out: a picture with its
   * description, a text box, the number of a note at the foot of the page.
   * Undefined for the marks that are nothing to hear (where a comment starts
   * or ends, a bookmark).
   */
  private spokenObject(run: Run): string | undefined {
    const xml = run.props.object;
    if (!xml) return undefined;
    const note = footnoteReferenceId(xml);
    if (note !== undefined) return t('a11y.footnoteRef', { n: footnoteNumbers(this.editor.doc).get(note) ?? '' });
    const end = endnoteReferenceId(xml);
    if (end !== undefined) return t('a11y.endnoteRef', { n: noteLabels(this.editor.doc, 'endnote').get(end) ?? '' });
    if (!/<w:drawing\b|<w:pict\b/.test(xml)) return undefined;
    if (/<w:txbxContent\b/.test(xml)) return t('a11y.textBox');
    const alt = altText(xml);
    return alt ? t('a11y.picture', { alt }) : t('a11y.pictureNoAlt');
  }

  /** What is at `offset` of a paragraph, read out: a picture by its name; past marks that take no room, what they are and the character after them. */
  private spokenAt(p: Paragraph, offset: number): string {
    const said: string[] = [];
    let at = offset;
    let start = 0;
    for (const run of p.runs) {
      const end = start + run.text.length;
      if (at >= start && at < end) {
        if (!run.props.object) break;
        const name = this.spokenObject(run);
        // A picture in the line is what the caret is at; a mark the caret steps over is said, and so is what follows it.
        if (!run.props.anchor) return name ?? spokenChar(run.text[at - start]);
        if (name) said.push(name);
        at = end;
      }
      start = end;
    }
    said.push(spokenChar(paragraphText(p)[at]));
    return said.join(', ');
  }

  /** A stretch of a paragraph as it is read: each object by its name. */
  private spokenSlice(p: Paragraph, from: number, to: number): string {
    let out = '';
    let start = 0;
    for (const run of p.runs) {
      const end = start + run.text.length;
      if (end > from && start < to) {
        const name = run.props.object ? this.spokenObject(run) : undefined;
        out += run.props.object ? (name ? ` ${name} ` : '') : run.text.slice(Math.max(0, from - start), Math.min(run.text.length, to - start));
      }
      start = end;
    }
    return out;
  }

  /** What changed of where the caret is, from paragraph `was` to paragraph `para`: a table cell, a heading, a list. */
  private whereIs(para: number, was: number): string[] {
    const doc = this.editor.text;
    const out: string[] = [];
    const cell = locateCell(doc, para);
    const before = locateCell(doc, was);
    if (cell && (cell.tableIndex !== before?.tableIndex || cell.rowIndex !== before.rowIndex || cell.cellIndex !== before.cellIndex)) {
      out.push(t('a11y.cell', { row: cell.rowIndex + 1, column: cell.column + 1 }));
    } else if (!cell && before) out.push(t('a11y.leftTable'));
    const style = styleIdAt(doc, para);
    const styles = paragraphStyles(doc);
    if (style !== styleIdAt(doc, was) && style !== styles[0].id) {
      const found = styles.find((s) => s.id === style);
      if (found) out.push(styleName(found));
    }
    const list = listKindAt(doc, para);
    const level = doc.paragraphs[para].props.listLevel ?? 0;
    if (list && (list !== listKindAt(doc, was) || level !== (doc.paragraphs[was].props.listLevel ?? 0))) {
      const name = t(list === 'bullet' ? 'a11y.bulletList' : 'a11y.numberList');
      out.push(level ? `${name}, ${t('a11y.level', { level: level + 1 })}` : name);
    }
    return out;
  }

  private onInput = (): void => {
    if (this.editor.mirror) {
      this.editor.readerInput();
      return;
    }
    const raw = this.editor.input.value;
    const marked = raw.startsWith(INPUT_MARK);
    // The mark is gone and nothing else is there: it was taken away, which is a Backspace.
    if (!marked && !raw && !this.typed && !this.editor.composing) {
      this.resetInput();
      this.editor.deleteBackward();
      return;
    }
    const text = marked ? raw.slice(INPUT_MARK.length) : raw;
    // Enter, from a keyboard that writes it in the field and does not say the key: Shift and Enter never gets here.
    const entered = !this.editor.composing && text.endsWith('\n');
    this.compose(entered ? text.slice(0, -1) : text);
    if (!this.editor.composing) this.resetInput();
    if (entered) this.editor.insertParagraphBreak();
  };

  private onCompositionEnd = (): void => {
    this.editor.composing = false;
    this.onInput();
    // Some browsers say what was composed once more after it ended, in an input of their own: by the time
    // this runs they have, and the field was emptied twice over.
    window.setTimeout(() => {
      if (!this.editor.composing && !this.editor.mirror && this.editor.input.value !== INPUT_MARK) this.onInput();
    });
  };

  /**
   * Brings the document up to `text`, what the hidden field holds: a word is
   * shown as it is written, also by a keyboard that composes it, as those of
   * phones do, and changes with it when the keyboard corrects it.
   */
  private compose(text: string): void {
    let had = this.typed;
    // The caret went elsewhere meanwhile: what was written there is no longer this word.
    if (had && (!this.editor.collapsed || !this.typedEnd || comparePositions(this.editor.selection.focus, this.typedEnd) !== 0)) had = text;
    this.typed = text;
    if (text === had) return;
    let same = 0;
    while (same < had.length && same < text.length && had[same] === text[same]) same++;
    const gone = Math.min(had.length - same, this.editor.selection.focus.offset);
    const added = text.slice(same);
    if (!gone) {
      this.editor.insertText(added);
    } else {
      const to = this.editor.selection.focus;
      const from = { para: to.para, offset: to.offset - gone };
      const { field: _, ...props } = this.editor.pendingProps ?? this.editor.activeRunProps();
      const cut = deleteRange(this.editor.text, { from, to });
      const result = added ? insertFragment(cut, outsideField(cut, from), added, props) : { doc: cut, pos: from };
      this.editor.commit(result.doc, { anchor: result.pos, focus: result.pos }, 'type');
    }
    this.typedEnd = this.editor.selection.focus;
  }

  /** Leaves the hidden field with nothing typed in it. */
  resetInput(): void {
    this.typed = '';
    this.typedEnd = undefined;
    if (this.editor.mirror) this.editor.syncMirror();
    else if (this.editor.input.value !== INPUT_MARK) this.editor.input.value = INPUT_MARK;
  }

  private onCopy = (e: ClipboardEvent): void => {
    e.preventDefault();
    const clip = this.editor.selectedClip();
    if (!clip || !e.clipboardData) return;
    const data = serializeClip(clip);
    e.clipboardData.setData('text/plain', clipText(clip));
    e.clipboardData.setData('text/html', clipHtml(clip, data));
    e.clipboardData.setData(CLIP_TYPE, data);
  };

  private onCut = (e: ClipboardEvent): void => {
    this.onCopy(e);
    if (!this.editor.collapsed) this.editor.deleteBackward();
  };

  private onPaste = (e: ClipboardEvent): void => {
    e.preventDefault();
    const plain = this.plainPaste;
    this.plainPaste = false;
    const data = e.clipboardData;
    const text = data?.getData('text/plain') ?? '';
    if (!plain && data) {
      const clip = parseClip(data.getData(CLIP_TYPE)) ?? (data.types.includes('text/html') ? clipFromHtml(data.getData('text/html')) : undefined);
      // Its pictures are read first: fetched, or taken from the RTF Word puts beside the HTML.
      if (clip && hasImages(clip)) {
        const rtf = data.types.includes('text/rtf') ? data.getData('text/rtf') : undefined;
        const files = [...(data.files ?? [])];
        void readClipImages(clip, rtf, files).then((read) => this.editor.insertClip(read) || this.editor.insertText(text));
        return;
      }
      if (clip && this.editor.insertClip(clip)) return;
    }
    // A copied picture comes as a file; Word sends one of what was copied along with its text, which is what is wanted then.
    const picture = text ? undefined : [...(data?.files ?? [])].find((file) => imageExtension(file.type));
    if (picture) {
      void this.editor.insertImageFile(picture);
      return;
    }
    this.editor.insertText(text);
  };
}
