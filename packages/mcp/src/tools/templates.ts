// Templates: the variables of a document, and filling them.

import { fillVariables, findAllVariables, flattenValues, templateBlocks, type TemplateData, variableNames, variableProblems, variableUses } from '@rebodocs/core/internal';
import { type Args, type Tool, fail, optionalText } from './shared';

export const TEMPLATES: Tool[] = [
  {
    name: 'list_variables',
    title: 'List template variables',
    description: 'The template variables of the document, written between double braces: the name of each, how many times it is used and the formats it is given (capitals, a date, money…).',
    properties: {},
    writes: false,
    run(doc) {
      const names = variableNames(doc);
      const blocks = templateBlocks(doc);
      const KIND = { text: 'some text', row: 'a row of a table', paragraphs: 'paragraphs' };
      const blockLines = blocks.map(
        (block) =>
          `{{${block.inverted ? '^' : '#'}${block.name}}} — ${KIND[block.kind]}, ${block.inverted ? 'kept when the value is not there' : 'repeated for each item of a list, or kept for true'}`,
      );
      if (!names.length && !blocks.length)
        return {
          text: 'The document has no variables. One is written between double braces: {{cliente}}, or with a format, {{fecha | fecha larga}}. A block, {{#lines}} … {{/lines}}, is repeated for each item of a list.',
        };
      const formats = new Map<string, Set<string>>();
      for (const use of findAllVariables(doc)) {
        const set = formats.get(use.name) ?? new Set<string>();
        formats.set(use.name, set);
        for (const format of use.formats) set.add(format);
      }
      return {
        text: [
          ...names.map((name) => `${name} — used ${variableUses(doc, name)}×${formats.get(name)?.size ? `; formats: ${[...formats.get(name)!].join(', ')}` : ''}`),
          ...(blockLines.length ? ['Blocks:', ...blockLines] : []),
        ].join('\n'),
      };
    },
  },
  {
    name: 'fill_variables',
    title: 'Fill template variables',
    description:
      'Puts a value in place of each template variable that is given one, everywhere in the document (its headers, footers, notes and text boxes too), in the format the variable asks for, and writes out each block given one: {{#name}} … {{/name}} is repeated for each item of a list (a row of a table, paragraphs, or text), kept for true and taken out for false; {{^name}} … {{/name}} the other way round. Dates go as YYYY-MM-DD and numbers plain (1234.5): the format writes them out. Variables and blocks with no value stay as they are.',
    properties: {
      values: {
        type: 'object',
        description:
          'The value of each variable, by its name: { "cliente": "Ana Pérez", "fecha": "2026-10-12" }. Nested objects fill dotted names ({ "cliente": { "nombre": "Ana" } } fills {{cliente.nombre}}); a list fills a block, each item an object whose fields fill {{lines.item}}, {{lines.price}}…; true or false keeps a block or takes it out.',
        additionalProperties: true,
      },
      locale: {
        type: 'string',
        description: 'The language dates and numbers are written in, as a tag: "en-US", "es-MX", "de-DE". The language of the document when left out, or English when it says none.',
      },
      currency: { type: 'string', description: 'The code of the currency "moneda" writes: "EUR", "MXN". A dollar sign when left out.' },
    },
    required: ['values'],
    writes: true,
    idempotent: true,
    run(doc, args, context) {
      const given =
        args.values && typeof args.values === 'object' && !Array.isArray(args.values) ? (args.values as Args) : fail('"values" must be an object with the value of each variable by its name.');
      const values = given as TemplateData;
      const flat = flattenValues(values);
      const names = variableNames(doc);
      const blocks = templateBlocks(doc).map((block) => block.name);
      // A name is the document's when a variable or a block is called so, or has it before a dot.
      const known = [...names, ...blocks];
      const unknown = Object.keys(values).filter((name) => !known.some((other) => other === name || other.startsWith(`${name}.`)));
      const today = {
        ...(context.now ? { today: context.now } : {}),
        ...(optionalText(args, 'locale') ? { locale: optionalText(args, 'locale') } : {}),
        ...(optionalText(args, 'currency') ? { currency: optionalText(args, 'currency') } : {}),
      };
      const problems = variableProblems(doc, values, today).map(({ name, format, kind }) =>
        kind === 'format'
          ? `{{${name}}} asks for a format that does not exist, "${format}": it was ignored.`
          : `The value of {{${name}}}, "${flat[name]}", is not one "${format}" can write: it was put as given.`,
      );
      const next = fillVariables(doc, values, today);
      const left = variableNames(next);
      const blocksLeft = templateBlocks(next).map((block) => block.name);
      return {
        text: [
          `Filled ${names.length - left.length} of ${names.length} variables.`,
          blocks.length ? `Wrote out ${new Set(blocks).size - new Set(blocksLeft).size} of ${new Set(blocks).size} blocks.` : '',
          left.length ? `Still without a value: ${left.join(', ')}.` : '',
          blocksLeft.length ? `Blocks still without a value: ${[...new Set(blocksLeft)].join(', ')}.` : '',
          unknown.length ? `Not variables of this document: ${unknown.join(', ')}.` : '',
          ...problems,
        ]
          .filter(Boolean)
          .join('\n'),
        doc: next === doc ? undefined : next,
      };
    },
  },
];
