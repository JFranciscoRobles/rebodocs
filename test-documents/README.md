# Test documents

Documents made up for the purpose, to measure the editor's layout against
Microsoft Word's, each beside the PDF Word for Mac made of it
(`<name>.word.pdf`). None comes from a real document: the text is invented and
the pictures are blocks of one colour, so anyone can run the comparison, and
only macOS with Word is needed to make a PDF again.

```sh
npm run word-check                                  # every document, against expected.json
npm run word-compare -- test-documents/<name>.docx  # one, with the lines that differ
```

Comparing needs Google Chrome and `pdftotext` (`brew install poppler`). It lays
each document out in the playground and reads Word's PDF line by line: the
pages that start and end on the same text, and the lines Word wrote that the
editor has at the same height, within 4 points.

`expected.json` holds what each document came to. `word-check` fails when one
has fewer pages or lines where Word puts them; when one has more, it says so,
and `node tools/word-compare.mjs test-documents --update` keeps the new numbers.

## What there is

| Files | Made by | What they measure |
| --- | --- | --- |
| `contract-*` | `npm run contract-cases` | Contracts in Times New Roman, Georgia, Verdana and Arial: justified text, lists, long tables, sections, columns, text kept together, endnotes, and `contract-arial-tables`, tables in every way Word makes them. |
| `float-*` | `npm run float-cases` | Floating pictures: which side the text goes down, how near, from where they are placed, in a table and in a header; and `float-brochure`, a brochure of two pages. |
| `probe-*` | by hand, kept as files | One rule of Word each, with one value varied: kerning, the foot of the page, space at the top, endnotes at the end of each section and their numbers, footnotes numbered again on each page. |

## Adding one

Make it in code, in `tools/contract-cases.ts` or `tools/float-cases.ts`, never
from a document of your own: real documents have names and amounts in them.
Then have Word make its PDF and keep its numbers:

```sh
npm run contract-cases -- <case>
npm run word-compare -- test-documents/contract-<case>.docx --word
node tools/word-compare.mjs test-documents --update
```

Writing a case again changes its file: make Word's PDF of it again too. `--word`
opens Word if it is not open and closes it after; a Word already open is left as
it is.
