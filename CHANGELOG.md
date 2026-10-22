# Changelog

Every package of Rebodocs is released at the same version. Before 1.0, a
minor version (0.x.0) may change the API; such changes are listed under
**Changed** with what to do about them.

## 0.9.0

### Added

- **Spell checking.** `createSpellChecker({ dictionaries })` reads Hunspell
  dictionaries in a worker (with nspell) and the editor draws a red wave under
  words spelled wrong, on the pages in view, in the language of the text.
  Suggestions, *Ignore* and *Add to dictionary* come in the bar beside the
  selection: right click, tap, or a tap of ⌘ (Ctrl) with the caret in the
  word. `spellcheck` prop on `DocsEditor` and `DocsProvider`;
  `editor.spellChecker`, `misspelling`, `spellingSuggestions()`,
  `replaceMisspelling()`, `ignoreMisspelling()`, `addMisspelling()`. No
  dictionaries are bundled.
- **Dark theme.** `theme: 'light' | 'dark' | 'auto'` on `DocsEditor` and
  `DocsProvider`, `editor.theme`, `handle.setTheme()`, and `applyTheme()` for
  an interface assembled by hand. Bars and menus shown outside the editor take
  it too; the pages stay white. `features.theme` puts the choice in the menu.
- **Long documents.** Only the pages near the view are drawn; the rest are
  empty boxes of their size, drawn as they scroll into view. Printing draws
  them all.
- **A new default interface.** Islands on a warm canvas: two rows of tools,
  the side panel on the right, the zoom floating over the pages, and the menu
  as a screen of its own. Other layouts through `features`: `toolbar`
  (`'tabs'`, `'row'`), `panel` (`'left'`, `'rail'`), `statusBar` (`'chips'`,
  `'bar'`), `menu` (`'card'`).
- The document menu stays inside the editor's box (`within` on
  `createSidebar`), instead of covering the whole window.
- `unsaved` prop: a draft the application kept opens as having unsaved changes.
- `handle.name`; the handle and `ref` are given on every mount.

### Changed

- **`DocsEditor` looks different by default** (see above). To keep a single
  row of tools, the panel on the left and a status bar under the pages:
  `features={{ toolbar: 'row', panel: 'left', statusBar: 'bar', menu: 'card' }}`.
- **Language defaults are English, or the document's**, no longer Spanish:
  the interface (the first of the browser's languages it speaks, else
  English), `formatValue`, `formatText`, `fillVariables` and the words of page
  numbers. Pass `locale`, `language` or `{ locale: 'es-MX' }` where Spanish is
  wanted regardless of the browser or the file.
- **`versions` moved from `DocsProvider` to `DocsEditor` and `mountDocs`**,
  where it was always used. `DocsProvider` never read it.
- Changing `features` makes the editor again with the document as it is,
  unsaved changes included; before, they were lost.

### Fixed

- The `ref` of `DocsEditor` was never set.
- `setPageNumbering` wrote Spanish words in documents of other languages.
- The description of documentation pages dropped any text in parentheses.
- `word-compare` did not decode `&apos;` and numeric entities.

### Documentation

- The documentation site was rewritten page by page, each claim checked
  against the code. `/llms.txt`, `/llms-full.txt` and a Markdown file per page
  for language models.
- `THIRD_PARTY_NOTICES.md` restored, with WordCraft's notice, and published
  inside each package.
