// Letterheads drawn on a canvas, the size of a Letter page, for the demos:
// a band with the name at the top, the address at the foot, and a faint
// pattern across the sheet. Each part can be left out or made taller.

/** A Letter page, in points. */
export const PAGE = { width: 612, height: 792 };

export interface Design {
  /** How tall the band at the top is, in points; 0 for none. */
  top: number;
  /** How tall the address at the foot is, in points; 0 for none. */
  bottom: number;
  /** A faint pattern over the whole page, which is not in the way of the text. */
  pattern: boolean;
  /** The colour of the band and the address. */
  color: string;
  name: string;
}

export const DESIGNS: Record<'studio' | 'clinic' | 'pattern', Design> = {
  studio: { top: 92, bottom: 54, pattern: false, color: '#1f4e8c', name: 'NORTE STUDIO' },
  clinic: { top: 140, bottom: 0, pattern: true, color: '#1a7f5a', name: 'Clínica Robles' },
  pattern: { top: 0, bottom: 0, pattern: true, color: '#8a5a00', name: '' },
};

/** Draws `design` on `canvas`, `scale` pixels to the point. */
export function drawLetterhead(canvas: HTMLCanvasElement, design: Design, scale = 2): void {
  canvas.width = PAGE.width * scale;
  canvas.height = PAGE.height * scale;
  const g = canvas.getContext('2d')!;
  g.setTransform(scale, 0, 0, scale, 0, 0);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, PAGE.width, PAGE.height);
  if (design.pattern) {
    // Light enough to read through: under the text, it is not in the way.
    g.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    g.lineWidth = 1;
    for (let x = -PAGE.height; x < PAGE.width; x += 18) {
      g.beginPath();
      g.moveTo(x, PAGE.height);
      g.lineTo(x + PAGE.height, 0);
      g.stroke();
    }
  }
  if (design.top > 0) {
    g.fillStyle = design.color;
    g.fillRect(0, 0, PAGE.width, design.top);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(54, design.top / 2, Math.min(18, design.top / 3), 0, Math.PI * 2);
    g.fill();
    g.font = `700 ${Math.min(22, design.top / 3)}px system-ui, sans-serif`;
    g.textBaseline = 'middle';
    g.fillText(design.name, 84, design.top / 2);
  }
  if (design.bottom > 0) {
    const y = PAGE.height - design.bottom;
    g.fillStyle = design.color;
    g.fillRect(48, y + 10, PAGE.width - 96, 1.5);
    g.font = '400 10px system-ui, sans-serif';
    g.textBaseline = 'top';
    g.fillText('Av. Reforma 222, piso 9 · Ciudad de México · +52 55 5555 0100 · hola@example.com', 48, y + 20);
  }
}

/** A design as a PNG file. */
export function letterheadFile(design: Design): Promise<Blob> {
  const canvas = document.createElement('canvas');
  drawLetterhead(canvas, design);
  return new Promise((done, fail) => canvas.toBlob((blob) => (blob ? done(blob) : fail(new Error('no picture'))), 'image/png'));
}
