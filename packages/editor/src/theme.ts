// The dark theme that comes with the editor: the same CSS variables every
// piece is coloured with, set to dark values, and the few colours that are not
// variables made to read on a dark background. The pages stay white: they are
// the document as it prints.

export type Theme = 'light' | 'dark' | 'auto';

/** The variables of the dark theme. Any of them can still be set on the element, over these. */
export const DARK_THEME: Record<string, string> = {
  '--dx-canvas': '#1c1b19',
  '--dx-page-shadow': '0 1px 2px rgba(0,0,0,.45), 0 12px 30px -12px rgba(0,0,0,.6)',
  '--dx-ruler': '#242321',
  '--dx-ruler-line': '#3d3b37',
  '--dx-ruler-margin': '#3d3b37',
  '--dx-ruler-text': '#55524d',
  '--dx-ruler-ink': '#cfccc5',
  '--dx-ruler-on': '#8ab4f8',
  '--dx-ui-bar': '#242321',
  '--dx-ui-bg': '#2c2b28',
  '--dx-ui-ink': '#ecebe7',
  '--dx-ui-muted': '#b1ada5',
  '--dx-ui-line': '#3d3b37',
  '--dx-ui-hover': '#363431',
  '--dx-ui-active': '#1f3a63',
  '--dx-ui-active-line': '#4b74b8',
  '--dx-ui-accent': '#8ab4f8',
  '--dx-ui-accent-hover': '#aecbfa',
  '--dx-ui-on-accent': '#0b1d3a',
};

/** What is not coloured by a variable: the tints of the menu, the red of what is taken out or wrong, the dark tips. */
const DARK_RULES: [string, string][] = [
  ['.dx-side-icon,.dx-side-badge.dx-docx', 'background:#1f3a63;color:#a8c7fa'],
  ['.dx-side-badge.dx-pdf', 'background:#4a2533;color:#f2a7c3'],
  ['.dx-side-badge.dx-md', 'background:#352a4a;color:#cbb5f0'],
  ['.dx-side-badge.dx-print', 'background:#213a29;color:#9fd3ad'],
  ['.dx-side-dirty', 'background:#4a3a12;color:#f5d77a'],
  ['.dx-side-chip.dx-danger,.dx-pn-preview.dx-pn-bad,.dx-pn-msg.dx-pn-bad,.dx-pn-chg .dx-pn-quote s,.dx-vv-legend s', 'color:#f2b8b5'],
  ['.dx-vv-legend u', 'color:#9fd3ad'],
  ['.dx-bb button.dx-bb-danger:hover,.dx-pn-by button:hover', 'background:#4a2522;color:#f2b8b5'],
  ['.dx-tb-tip', 'background:#ecebe7;color:#1c1b19'],
  ['.dx-tb-title.dx-dirty::before', 'color:#f28b82'],
];

const STYLE_ID = 'dx-theme-style';

/** Rules for a theme given by a class, on the element or on one around it. */
function themed(scope: string): string {
  const vars = Object.entries(DARK_THEME)
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
  const rules = DARK_RULES.map(([selectors, css]) => {
    const each = selectors.split(',').flatMap((one) => [`${scope} ${one}`, `${scope}${one}`]);
    return `${each.join(',')}{${css}}`;
  }).join('\n');
  return `${scope}{color-scheme:dark;${vars}}\n${rules}`;
}

export function injectThemeStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  // Before the other styles of the page, so that variables an application sets win over these.
  style.textContent = `${themed('.dx-theme-dark')}\n@media (prefers-color-scheme:dark){\n${themed('.dx-theme-auto')}\n}`;
  document.head.prepend(style);
}

/** Gives `element` the theme: dark, light, or the one the system is set to ('auto'). */
export function applyTheme(element: HTMLElement, theme: Theme): void {
  injectThemeStyle();
  element.classList.toggle('dx-theme-dark', theme === 'dark');
  element.classList.toggle('dx-theme-auto', theme === 'auto');
}

/** The ink that reads on a colour given as hex RGB (without '#'): black or white, whichever stands out more from it. */
export function inkOn(hex: string): '#000' | '#fff' {
  const channel = (at: number) => {
    const v = parseInt(hex.slice(at, at + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const light = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  // Contrast with black is (L + .05) / .05, with white 1.05 / (L + .05): black wins above L ≈ .179.
  return (light + 0.05) / 0.05 >= 1.05 / (light + 0.05) ? '#000' : '#fff';
}
