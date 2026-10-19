// The texts of the application itself: its menus and its questions. What the
// editor already says (Open, Save, Print...) comes from the editor.

import { getLocale } from '@rebodocs/editor';

const es = {
  file: 'Archivo',
  edit: 'Edición',
  view: 'Ver',
  window: 'Ventana',
  newDocument: 'Nuevo documento',
  exportPdf: 'Exportar como PDF…',
  closeWindow: 'Cerrar ventana',
  about: 'Acerca de Rebodocs',
  hide: 'Ocultar Rebodocs',
  hideOthers: 'Ocultar otros',
  showAll: 'Mostrar todo',
  quit: 'Salir de Rebodocs',
  undo: 'Deshacer',
  redo: 'Rehacer',
  find: 'Buscar…',
  replace: 'Reemplazar…',
  zoomIn: 'Acercar',
  zoomOut: 'Alejar',
  actualSize: 'Tamaño real',
  fitWidth: 'Ajustar al ancho',
  fitPage: 'Página completa',
  minimize: 'Minimizar',
  maximize: 'Zoom',
  fullscreen: 'Pantalla completa',
  untitled: 'Documento sin título',
  pdf: 'Documento PDF',
  unsaved: '“{name}” tiene cambios sin guardar. Si cierras, se perderán.',
  closeAnyway: 'Cerrar sin guardar',
  cancel: 'Cancelar',
};

const en: typeof es = {
  file: 'File',
  edit: 'Edit',
  view: 'View',
  window: 'Window',
  newDocument: 'New document',
  exportPdf: 'Export as PDF…',
  closeWindow: 'Close window',
  about: 'About Rebodocs',
  hide: 'Hide Rebodocs',
  hideOthers: 'Hide others',
  showAll: 'Show all',
  quit: 'Quit Rebodocs',
  undo: 'Undo',
  redo: 'Redo',
  find: 'Find…',
  replace: 'Replace…',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  actualSize: 'Actual size',
  fitWidth: 'Fit to width',
  fitPage: 'Whole page',
  minimize: 'Minimize',
  maximize: 'Zoom',
  fullscreen: 'Enter full screen',
  untitled: 'Untitled document',
  pdf: 'PDF document',
  unsaved: '“{name}” has changes that are not saved. Closing loses them.',
  closeAnyway: 'Close without saving',
  cancel: 'Cancel',
};

export type TextKey = keyof typeof es;

/** The text in the language of the editor, with `{name}` and the like put in. */
export function text(key: TextKey, values: Record<string, string> = {}): string {
  const texts = getLocale() === 'es' ? es : en;
  return texts[key].replace(/\{(\w+)\}/g, (_, name: string) => values[name] ?? '');
}
