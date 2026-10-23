import type { FontMetrics, FontSpec, TextMeasurer } from '@rebodocs/core/internal';

const PX_TO_PT = 0.75;
const CACHE_LIMIT = 50_000;
/**
 * Size, in points, at which font metrics are read. At text sizes the browser
 * rounds them to whole pixels, which is several percent of a line; metrics
 * scale with the size, so they are read large and scaled down. Large enough
 * that what is left adds up to nothing on a page: read at 200 pt, a line of
 * Arial 11 came out 0.015 pt taller than the font file says, 0.6 pt over a
 * page, which sent two lines Word keeps on it to the next; at 2000, 0.002.
 */
const METRICS_SIZE = 2000;
/**
 * Size, in points, at which widths are measured, for the same reason: at the
 * size of text the browser rounds the advance of each letter down a little,
 * some 0.05% of a line, which is enough for a word Word sends to the next line
 * to fit on this one. Measured against the font files, a line of 432 pt in
 * Georgia 11 came out 0.2 pt short; measured large and scaled down, 0.002 pt.
 */
const WIDTH_SIZE = 1000;

/** CSS font-family list for a document font, with a generic fallback. */
export function cssFontFamily(name: string): string {
  const generic = /courier|consolas|mono/i.test(name) ? 'monospace' : /times|georgia|garamond|cambria|palatino|book|serif/i.test(name) && !/sans/i.test(name) ? 'serif' : 'sans-serif';
  return `"${name.replace(/["\\]/g, '')}", ${generic}`;
}

export function cssFont(font: FontSpec): string {
  return `${font.italic ? 'italic ' : ''}${font.bold ? 'bold ' : ''}${font.size}pt ${cssFontFamily(font.family)}`;
}

/** Measures text with a canvas, using the same fonts the renderer paints with. */
export class CanvasMeasurer implements TextMeasurer {
  private ctx: CanvasRenderingContext2D;
  /** Off-screen element that tells how tall the browser makes a line of a font. */
  private probe: HTMLElement;
  private currentFont = '';
  private widths = new Map<string, number>();
  private fontMetrics = new Map<string, FontMetrics>();

  constructor() {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    // Word does not kern text unless a document asks for it; the painted text does the same.
    ctx.fontKerning = 'none';
    this.probe = document.createElement('span');
    this.probe.textContent = 'Hg';
    this.probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;line-height:normal';
    document.body.appendChild(this.probe);
  }

  /**
   * Height of a single-spaced line: ascent, descent and the line gap the font
   * asks for, which is what Word spaces lines by. The canvas reports the first
   * two only.
   */
  private lineHeight(css: string): number {
    this.probe.style.font = css;
    this.probe.style.lineHeight = 'normal';
    return this.probe.getBoundingClientRect().height * PX_TO_PT;
  }

  /** Forgets everything measured, for when the fonts behind the names change. */
  reset(): void {
    this.widths.clear();
    this.fontMetrics.clear();
    this.currentFont = '';
  }

  /** Whether the browser has a font of this family, as opposed to falling back to another. */
  hasFont(family: string): boolean {
    const sample = 'mmmmmmmmmmlli';
    const width = (css: string) => {
      this.use(css);
      return this.ctx.measureText(sample).width;
    };
    const name = `"${family.replace(/["\\]/g, '')}"`;
    // A font that is missing measures like whatever stands in for it, with either fallback.
    return width(`72px ${name}, monospace`) !== width('72px monospace') || width(`72px ${name}, serif`) !== width('72px serif');
  }

  private use(font: string, kern = false): void {
    const key = `${font}|${kern}`;
    if (key !== this.currentFont) {
      this.ctx.font = font;
      // Word kerns where the document says so; the browser's pairs are its own, close to the font's for most.
      this.ctx.fontKerning = kern ? 'normal' : 'none';
      this.currentFont = key;
    }
  }

  width(text: string, font: FontSpec): number {
    // Widths scale with the size: one measure, large, for every size of a font.
    const css = cssFont({ ...font, size: WIDTH_SIZE });
    const key = `${css}|${font.kern ? 'k' : ''}\n${text}`;
    let width = this.widths.get(key);
    if (width === undefined) {
      this.use(css, !!font.kern);
      width = this.ctx.measureText(text).width * PX_TO_PT;
      if (this.widths.size >= CACHE_LIMIT) this.widths.clear();
      this.widths.set(key, width);
    }
    return (width * font.size) / WIDTH_SIZE;
  }

  /** The kerning of a letter after another measured apart, as the browser kerns them: the two together, less each alone. */
  pair(left: string, right: string, font: FontSpec): number {
    if (!font.kern || !left || !right) return 0;
    return this.width(left + right, font) - this.width(left, font) - this.width(right, font);
  }

  metrics(font: FontSpec): FontMetrics {
    const key = cssFont(font);
    let metrics = this.fontMetrics.get(key);
    if (!metrics) {
      const css = cssFont({ ...font, size: METRICS_SIZE });
      const scale = font.size / METRICS_SIZE;
      this.use(css);
      const m = this.ctx.measureText('Hg');
      const ascent = m.fontBoundingBoxAscent !== undefined ? m.fontBoundingBoxAscent * PX_TO_PT * scale : font.size * 0.9;
      const descent = m.fontBoundingBoxDescent !== undefined ? m.fontBoundingBoxDescent * PX_TO_PT * scale : font.size * 0.25;
      // The line gap goes half above and half below, which is where a span as tall as the line puts its text.
      const gap = Math.max(0, this.lineHeight(css) * scale - (ascent + descent)) / 2;
      metrics = { ascent: ascent + gap, descent: descent + gap, lineGap: gap * 2 };
      this.fontMetrics.set(key, metrics);
    }
    return metrics;
  }
}
