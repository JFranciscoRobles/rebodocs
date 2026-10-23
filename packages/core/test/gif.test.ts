import { describe, expect, it } from 'vitest';
import { createDoc, insertImage, renderPdf } from '../src/internal';
import { decodeGif } from '../src/png';

// A letterhead of 153 × 198 made into a GIF by macOS (sips): a blue band at the top, a red one at the foot, white between.
const GIF = Uint8Array.from(
  atob(
    'R0lGODdhmQDGAKIAAAAAALQeHh9OjP///wAAAAAAAAAAAAAAACH5BAkAAAQALAAAAACZAMYAAAP/KLrc/jDKSau9OOvNu/9gKI5kaZ5oqq5s675wLM90bd94ru987//AoHBILBqPyKRyyWw6n9CodEqtWq/YbG3A7Xq/4LB4TC6bz+i0es1uu9/wuHxOr9vv+Lx+z+/7/4CBgoOEhYaHiImKi4yNjo+QkZKTlJWWl5iZmpucnZ6foKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr/AwcLDxMXGx8jJysvMzc7P0NHS09TV1tfY2drb3N3e3+Dh4uPk5ebn6Onq6+zt7u/w8fLz9PX29/j5+vv8/f7/AAMKHEiwoMGDCBMqXMiwocOHECNKnEixosWLGDNq3MixYKPHjyBDihxJsqTJkyhTqlzJsqXLlzBjypxJs6bNmzhz6tyJLYDPn0CDCh1KtKjRo0iTKl3KtKnTp1CjSp1KtarVq1izat3KtavXr2DDih1LtqzZs2jTql3Ltq3bt28TAAA7',
  ),
  (c) => c.charCodeAt(0),
);
const pixel = (image: { width: number; rgb: Uint8Array }, x: number, y: number) => [...image.rgb.subarray((y * image.width + x) * 3, (y * image.width + x) * 3 + 3)];

describe('GIF pictures', () => {
  it('are read to their pixels, the first frame', () => {
    const image = decodeGif(GIF)!;
    expect([image.width, image.height]).toEqual([153, 198]);
    expect(pixel(image, 10, 5)).toEqual([31, 78, 140]);
    expect(pixel(image, 10, 100)).toEqual([255, 255, 255]);
    expect(pixel(image, 10, 195)).toEqual([180, 30, 30]);
    expect(decodeGif(new TextEncoder().encode('GIF89a not one'))).toBeUndefined();
  });

  it('go into a PDF made on a server, and one that cannot be read is counted', () => {
    const at = { para: 0, offset: 0 };
    const good = insertImage(createDoc(), at, { bytes: GIF, type: 'image/gif', width: 76, height: 99 }).doc;
    const made = renderPdf(good, [], 'gif');
    expect(made.missingPictures).toBe(0);
    expect(new TextDecoder('latin1').decode(made.pdf)).toContain('/Subtype /Image');
    const bad = insertImage(createDoc(), at, { bytes: new TextEncoder().encode('GIF89a broken'), type: 'image/gif', width: 10, height: 10 }).doc;
    expect(renderPdf(bad, [], 'gif').missingPictures).toBe(1);
  });
});
