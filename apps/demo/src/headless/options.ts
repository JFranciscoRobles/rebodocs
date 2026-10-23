export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48];
export const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/** The options of a list, with the value there is now among them when it is not one. */
export function withCurrent(options: number[], current: number): number[] {
  return options.includes(current) ? options : [...options, current].sort((a, b) => a - b);
}

/** The editor's hex RGB without '#' as what a colour input takes. */
export function hex(color: string, fallback: string): string {
  return /^[0-9a-f]{6}$/i.test(color) ? `#${color}` : fallback;
}

export const LINE_HEIGHTS = [1, 1.15, 1.5, 2];
/** A step of indent, in points: half an inch. */
export const INDENT_STEP = 36;
/** The colours Word has for a highlight; it keeps no other. */
export const HIGHLIGHTS = ['FFFF00', '00FF00', '00FFFF', 'FF00FF', '0000FF', 'FF0000', '000080', '008080', '008000', '800080', '800000', '808000', '808080', 'C0C0C0', '000000'];
/** Soft colours to put behind table cells. */
export const CELL_SHADES = ['F2F2F2', 'D9D9D9', 'BFBFBF', 'FFF2CC', 'FFE699', 'FCE4D6', 'F8CBAD', 'E2EFDA', 'C6E0B4', 'DDEBF7', 'BDD7EE', 'D9E1F2', 'B4C6E7', 'EAD1DC', 'D9D2E9', 'FFFFFF'];
