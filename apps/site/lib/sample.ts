// The receipt the demos of the site open, in each language of the site: made
// by scripts/demo.ts into public/, with the name it is given in the editor.

import type { L } from './i18n';

export const SAMPLE: L<{ file: string; name: string }> = {
  en: { file: '/demo.docx', name: 'receipt.docx' },
  es: { file: '/demo-es.docx', name: 'recibo.docx' },
  zh: { file: '/demo-zh.docx', name: '收据.docx' },
};
