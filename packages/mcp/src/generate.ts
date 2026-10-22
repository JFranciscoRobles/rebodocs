// Fills a template from the command line, with no browser:
//
//   npx -p @rebodocs/mcp rebodocs-generate template.docx data.json -o out.pdf [--fonts folder]
//   npx -p @rebodocs/mcp rebodocs-generate template.docx --list
//
// In the repository, `npm run generate -- …` runs it from its source. The
// output is a DOCX, a PDF or Markdown, by its extension. For a PDF the
// document is laid out with font files: the ones in the folders given with
// --fonts, then the ones of the system.

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { type FormatOptions, type TemplateData, exportDocx, exportMarkdown, fillVariables, flattenValues, importDocx, renderPdf, templateBlocks, variableNames, variableProblems } from '@rebodocs/core';
import { fontsFor } from './fonts';

const USAGE = `Usage: rebodocs-generate template.docx [data.json] -o out.(docx|pdf|md) [--fonts folder] [--locale en-US] [--currency EUR]
       rebodocs-generate template.docx --list`;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
const flag = (name: string) => {
  const values: string[] = [];
  for (let i = args.indexOf(name); i >= 0; i = args.indexOf(name)) values.push(...args.splice(i, 2).slice(1));
  return values;
};
if (args.includes('--help') || args.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}
const list = args.includes('--list');
if (list) args.splice(args.indexOf('--list'), 1);
const [output] = flag('-o');
const fontDirs = flag('--fonts');
const [locale] = flag('--locale');
const [currency] = flag('--currency');
const [templatePath, dataPath] = args;
if (!templatePath || (!list && !output)) fail(USAGE);

const template = importDocx(new Uint8Array(readFileSync(templatePath)));
const names = variableNames(template);
if (list) {
  console.log([...names, ...templateBlocks(template).map((block) => `${block.inverted ? '^' : '#'}${block.name} (block: ${block.kind})`)].join('\n'));
  process.exit(0);
}

// Nested objects fill dotted names; lists fill blocks, {{#lines}} … {{/lines}}.
const values: TemplateData = dataPath ? JSON.parse(readFileSync(dataPath, 'utf8')) : {};
const flat = flattenValues(values);
const options: FormatOptions = { ...(locale ? { locale } : {}), ...(currency ? { currency } : {}) };
const doc = fillVariables(template, values, options);
const left = [...new Set([...variableNames(doc), ...templateBlocks(doc).map((block) => `#${block.name}`)])];
if (left.length) console.warn(`Variables without a value, left as they are: ${left.join(', ')}`);
for (const { name, format, kind } of variableProblems(template, values, options)) {
  console.warn(kind === 'format' ? `{{${name}}} asks for a format there is not, "${format}": it was ignored.` : `The value of {{${name}}} ("${flat[name]}") is not one "${format}" can write: it was put as given.`);
}

const kind = extname(output).toLowerCase();
if (kind === '.docx') {
  writeFileSync(output, exportDocx(doc));
} else if (kind === '.md') {
  writeFileSync(output, exportMarkdown(doc));
} else if (kind === '.pdf') {
  const fonts = fontsFor(doc, fontDirs);
  if (!fonts.length) fail('No .ttf, .otf or .ttc font was found: give a folder that has some with --fonts.');
  const { pdf, layout, missingFonts, missingPictures } = renderPdf(doc, fonts, basename(output, kind));
  writeFileSync(output, pdf);
  for (const [family, used] of missingFonts) console.warn(`No font for "${family}": "${used}" stood in, so lines may break elsewhere.`);
  if (missingPictures) console.warn(`${missingPictures} ${missingPictures === 1 ? 'picture' : 'pictures'} of a kind a PDF is not made with here (only PNG and JPEG) left out.`);
  console.log(`${layout.pages.length} ${layout.pages.length === 1 ? 'page' : 'pages'}`);
} else {
  fail(`Cannot write "${kind}": use .docx, .pdf or .md.`);
}
console.log(`Wrote ${output}`);
