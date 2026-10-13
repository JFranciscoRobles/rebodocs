// Fills a template from the command line, with no browser:
//
//   npm run generate -- plantilla.docx datos.json -o salida.pdf
//   npm run generate -- plantilla.docx --list
//
// The output is a DOCX, a PDF or Markdown, by its extension. For a PDF the
// document is laid out with font files: the ones in the folders given with
// --fonts, then the ones of the system.

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { exportDocx, exportMarkdown, fillVariables, importDocx, renderPdf, variableNames, variableProblems } from '../packages/core/src/index';
import { fontsFor } from '../packages/mcp/src/fonts';

/** `{ cliente: { nombre: "Ana" } }` as `{ "cliente.nombre": "Ana" }`: the names variables go by. */
function flatten(data: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const [key, value] of Object.entries(data)) flatten(value, prefix ? `${prefix}.${key}` : key, out);
  } else if (prefix && data !== null && data !== undefined) {
    out[prefix] = String(data);
  }
  return out;
}

const args = process.argv.slice(2);
const flag = (name: string) => {
  const values: string[] = [];
  for (let i = args.indexOf(name); i >= 0; i = args.indexOf(name)) values.push(...args.splice(i, 2).slice(1));
  return values;
};
const list = args.includes('--list');
if (list) args.splice(args.indexOf('--list'), 1);
const [output] = flag('-o');
const fontDirs = flag('--fonts');
const [templatePath, dataPath] = args;
if (!templatePath || (!list && !output)) fail('Uso: npm run generate -- plantilla.docx [datos.json] -o salida.(docx|pdf|md) [--fonts carpeta]\n     npm run generate -- plantilla.docx --list');

const template = importDocx(new Uint8Array(readFileSync(templatePath)));
const names = variableNames(template);
if (list) {
  console.log(names.join('\n'));
  process.exit(0);
}

const values = dataPath ? flatten(JSON.parse(readFileSync(dataPath, 'utf8'))) : {};
const doc = fillVariables(template, values);
const left = names.filter((name) => values[name] === undefined);
if (left.length) console.warn(`Variables sin valor, que quedan como están: ${left.join(', ')}`);
for (const { name, format, kind } of variableProblems(template, values)) {
  console.warn(kind === 'format' ? `Formato desconocido en {{${name}}}: "${format}". Se ignora.` : `El valor de {{${name}}} ("${values[name]}") no sirve para "${format}": se pone tal cual.`);
}

const kind = extname(output).toLowerCase();
if (kind === '.docx') {
  writeFileSync(output, exportDocx(doc));
} else if (kind === '.md') {
  writeFileSync(output, exportMarkdown(doc));
} else if (kind === '.pdf') {
  const fonts = fontsFor(doc, fontDirs);
  if (!fonts.length) fail('No se encontró ninguna fuente .ttf; indica una carpeta con --fonts.');
  const { pdf, layout, missingFonts } = renderPdf(doc, fonts, basename(output, kind));
  writeFileSync(output, pdf);
  for (const [family, used] of missingFonts) console.warn(`Sin fuente para "${family}": se usó "${used}", y las líneas pueden cortar en otro sitio.`);
  console.log(`${layout.pages.length} páginas`);
} else {
  fail(`No sé escribir "${kind}": usa .docx, .pdf o .md`);
}
console.log(`Escrito ${output}`);
