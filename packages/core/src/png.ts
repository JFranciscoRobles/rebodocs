// Reading pictures without a browser, as far as a PDF needs: the pixels of a
// PNG, and the size of a JPEG, which goes into a PDF as it is.

import { unzlibSync } from 'fflate';
import type { Media } from './model';
import type { PdfImage } from './pdf';

/** The size of a JPEG, from its frame header. */
export function jpegSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
  for (let at = 2; at + 9 < bytes.length; ) {
    if (bytes[at] !== 0xff) return undefined;
    const marker = bytes[at + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: (bytes[at + 5] << 8) + bytes[at + 6], width: (bytes[at + 7] << 8) + bytes[at + 8] };
    }
    at += 2 + (bytes[at + 2] << 8) + bytes[at + 3];
  }
  return undefined;
}

/** The pixels of a PNG. Undefined for one of a kind not handled: fewer than eight bits to the sample. */
export function decodePng(bytes: Uint8Array): Required<Pick<PdfImage, 'width' | 'height' | 'rgb' | 'alpha'>> | undefined {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(0) !== 0x89504e47) return undefined;
    let width = 0;
    let height = 0;
    let depth = 0;
    let type = 0;
    let interlaced = false;
    let palette: Uint8Array | undefined;
    let transparency: Uint8Array | undefined;
    const data: Uint8Array[] = [];
    for (let at = 8; at + 8 <= bytes.length; ) {
      const length = view.getUint32(at);
      const tag = String.fromCharCode(bytes[at + 4], bytes[at + 5], bytes[at + 6], bytes[at + 7]);
      const body = bytes.subarray(at + 8, at + 8 + length);
      if (tag === 'IHDR') {
        width = view.getUint32(at + 8);
        height = view.getUint32(at + 12);
        depth = body[8];
        type = body[9];
        interlaced = body[12] === 1;
      } else if (tag === 'PLTE') palette = body;
      else if (tag === 'tRNS') transparency = body;
      else if (tag === 'IDAT') data.push(body);
      else if (tag === 'IEND') break;
      at += 12 + length;
    }
    const channels = [1, 0, 3, 1, 2, 0, 4][type];
    if (!width || !height || !channels || (depth !== 8 && depth !== 16) || (type === 3 && !palette)) return undefined;
    const packed = new Uint8Array(data.reduce((n, chunk) => n + chunk.length, 0));
    let offset = 0;
    for (const chunk of data) {
      packed.set(chunk, offset);
      offset += chunk.length;
    }
    const raw = unzlibSync(packed);
    const bpp = (channels * depth) / 8;
    const pixels = new Uint8Array(width * height * bpp);
    /** Undoes the filters of `rows` rows of `columns` pixels starting at `at` in the data; returns them and where they end. */
    const rowsAt = (at: number, columns: number, rows: number) => {
      const stride = columns * bpp;
      const out = new Uint8Array(rows * stride);
      // Each row says how it was written against the pixel to its left and the row above.
      for (let y = 0; y < rows; y++) {
        const filter = raw[at + y * (stride + 1)];
        const from = at + y * (stride + 1) + 1;
        const to = y * stride;
        for (let x = 0; x < stride; x++) {
          const left = x >= bpp ? out[to + x - bpp] : 0;
          const up = y ? out[to + x - stride] : 0;
          const corner = y && x >= bpp ? out[to + x - stride - bpp] : 0;
          let predicted = 0;
          if (filter === 1) predicted = left;
          else if (filter === 2) predicted = up;
          else if (filter === 3) predicted = (left + up) >> 1;
          else if (filter === 4) {
            const p = left + up - corner;
            const a = Math.abs(p - left);
            const b = Math.abs(p - up);
            const c = Math.abs(p - corner);
            predicted = a <= b && a <= c ? left : b <= c ? up : corner;
          }
          out[to + x] = (raw[from + x] + predicted) & 0xff;
        }
      }
      return { out, end: at + rows * (stride + 1) };
    };
    if (!interlaced) {
      pixels.set(rowsAt(0, width, height).out);
    } else {
      // An interlaced picture comes in seven passes, each a coarser grid of the whole: where it starts and how it steps.
      let at = 0;
      for (const [x0, y0, dx, dy] of [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]]) {
        const columns = Math.ceil((width - x0) / dx);
        const rows = Math.ceil((height - y0) / dy);
        if (columns <= 0 || rows <= 0) continue;
        const pass = rowsAt(at, columns, rows);
        at = pass.end;
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < columns; x++) {
            const from = (y * columns + x) * bpp;
            pixels.set(pass.out.subarray(from, from + bpp), ((y0 + y * dy) * width + x0 + x * dx) * bpp);
          }
        }
      }
    }
    const rgb = new Uint8Array(width * height * 3);
    const alpha = new Uint8Array(width * height).fill(255);
    const step = depth / 8;
    for (let i = 0; i < width * height; i++) {
      // Of a sample of two bytes, the first is the one that counts.
      const sample = (channel: number) => pixels[(i * channels + channel) * step];
      if (type === 3) {
        const index = sample(0);
        rgb.set(palette!.subarray(index * 3, index * 3 + 3), i * 3);
        if (transparency && index < transparency.length) alpha[i] = transparency[index];
      } else if (type === 0 || type === 4) {
        rgb.fill(sample(0), i * 3, i * 3 + 3);
        if (type === 4) alpha[i] = sample(1);
      } else {
        rgb[i * 3] = sample(0);
        rgb[i * 3 + 1] = sample(1);
        rgb[i * 3 + 2] = sample(2);
        if (type === 6) alpha[i] = sample(3);
      }
    }
    return { width, height, rgb, alpha };
  } catch {
    return undefined;
  }
}

/** A picture of a document as a PDF takes it; undefined for the kinds that cannot be read here. */
export function pdfImage(media: Media): PdfImage | undefined {
  if (media.type === 'image/jpeg') {
    const size = jpegSize(media.bytes);
    return size && { ...size, jpeg: media.bytes };
  }
  return media.type === 'image/png' ? decodePng(media.bytes) : undefined;
}
