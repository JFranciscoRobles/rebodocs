# Templates and variables

A variable is text between double braces: `{{client}}`. That is all a template is, so any DOCX can be one, and Word shows it as it is. You can write the template in Word, in the editor, or both.

```
Received from {{client | capital}} the amount of {{amount | currency}}
on {{date | dateLong}}.
```

A variable takes the formatting of the text it stands in: a bold `{{client}}` is filled with a bold name.

## In the editor

- Variables are highlighted in the text.
- The **Variables** tab of the side panel lists them, each with a field for its value. "Fill document" replaces them all, in the text, the header and the footer, as one step to undo.
- Select a word and turn it into a variable from the bar beside the selection, or insert one from the toolbar.

## In code

```ts
import { importDocx, variableNames, fillVariables, exportDocx } from '@rebodocs/core';

const doc = importDocx(template);
variableNames(doc);                       // ['client', 'amount', 'date']

const filled = fillVariables(doc, {
  client: 'ana pérez',
  amount: '2500',
  date: '2026-10-13',
});
const docx = exportDocx(filled);
```

A variable with no value given is left as it is, braces and all, so a document can be filled in steps.

In the editor: `editor.variables`, `editor.insertVariable(name)`, `editor.fillVariables(values)`.

## From the command line

```bash
npm run generate -- template.docx --list                 # the variables it has
npm run generate -- template.docx data.json -o out.docx
npm run generate -- template.docx data.json -o out.pdf --fonts ./fonts
```

The output is DOCX, PDF or Markdown, by its extension. The data can be nested; names are joined with a dot:

```json
{ "client": { "name": "Ana Pérez" }, "amount": 2500 }
```

fills `{{client.name}}` and `{{amount}}`.

## Formats

After the name, a variable can say how its value is to be written. Formats are applied one after another: `{{date | dateLong | upper}}`.

| Format | Value | Written as |
| --- | --- | --- |
| `upper` | `ana pérez` | `ANA PÉREZ` |
| `lower` | `ANA PÉREZ` | `ana pérez` |
| `capital` | `ana pérez` | `Ana Pérez` |
| `bold`, `italic`, `underline` | any | the value, with that formatting |
| `number` | `1234567.5` | `1,234,567.5` |
| `number: 2` | `1234.5` | `1,234.50` |
| `currency` | `2500` | `$2,500.00` |
| `date` | `2026-10-13` | `13/10/2026` |
| `date: yyyy-MM-dd` | `13/10/2026` | `2026-10-13` |
| `dateLong` | `2026-10-13` | `13 de octubre de 2026` |
| `dateFull` | `2026-10-13` | `martes, 13 de octubre de 2026` |

A date value is `2026-10-13`, `13/10/2026` (day first), or `hoy` for today. In a pattern, `d`, `dd`, `dddd`, `M`, `MM`, `MMM`, `MMMM`, `yy` and `yyyy` are replaced and every other word is kept.

> The formats were made for Spanish documents, and it shows. Month and weekday names come out in Spanish, `currency` always writes `$`, and the editor writes the formats by their Spanish names (`mayúsculas`, `fecha larga`, `moneda`), which are read as well as the English ones above. Dates and currency by locale are on the [roadmap](/docs/status/).

A format that cannot be applied (a date format on something that is not a date) leaves the value as it was. `variableProblems(doc, values)` lists those before you fill.

## Signatures

`editor.insertSignatures(['Adviser', 'Client'])` puts a block of signature lines at the caret, as a table without borders: a title, a line and a name under each. Use variables for the names and they fill with the rest.
