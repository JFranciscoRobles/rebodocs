# Desktop

Rebodocs as a desktop application, with [Tauri](https://tauri.app). Each
window is one document, a `.docx` file of the disk.

```bash
npm run desktop         # from the root: compiles and opens the application
npm run build:desktop   # the installer: .app and .dmg on a Mac, .msi and .exe on Windows
```

It needs Rust, from [rustup.rs](https://rustup.rs), and what Tauri asks of
each system: Xcode's command line tools on a Mac, WebView2 and the C++ build
tools on Windows. The first run compiles for a few minutes; the next ones
take seconds.

## What it does

- **Files of the disk.** Open (⌘O), Save (⌘S) and Save as (⌘⇧S) with the
  dialogs of the system. Saving writes to a file beside the document first
  and puts it in its place after, so a failure halfway leaves the old one.
- **A window per document.** ⌘N opens an empty one. A document opened from
  a window that already has one goes into a window of its own.
- **Changes are not lost by closing.** A window with changes asks first,
  also when the whole application is quit from the menu.
- **A native menu**: File, Edit, View, and Window on a Mac, in the language
  of the editor. Edit has **Paste as text** (⌘⇧V).
- **Export as PDF** to a file, and the other exports of the side menu.
- **Documents from the system.** A `.docx` dropped on the window opens; a
  picture dropped on it goes in where the caret is. Once built, the
  application is offered for `.docx` files in the Finder or the Explorer
  ("Open with"), without taking the place of Word as the one they open with.

## What is where

- `src/main.ts`: the window. The editor and its interface, as in the
  playground, and what Tauri adds: the menu, the dialogs, the files.
- `src/texts.ts`: the texts of the menu and of the questions, in Spanish and
  English; the rest comes from the editor.
- `src-tauri/src/lib.rs`: what the pages cannot do. Reading and writing
  files (the bytes go as they are, not as JSON), opening a window for a
  document, and keeping the documents the system asks to open until a
  window takes them.
- `src-tauri/tauri.conf.json`: the name, the icon, the `.docx` association.
- `src-tauri/capabilities/default.json`: what the windows may ask of Tauri.

`npm run web -w @rebodocs/desktop` serves the pages alone, at
`http://localhost:5178`; without Tauri around them they show, but files and
the menu do not work.

## Where it can improve

- **Tried on a Mac only.** Windows and Linux compile the same code, but the
  menu, the dialogs and opening with a double click have not been tried there.
  On Windows a second double click starts a second process; the
  `single-instance` plugin of Tauri would send it to the first.
- **Printing** opens the print dialog of the system through Tauri, since
  `window.print()` does nothing in the web view of a Mac. The paper is the
  one chosen in the dialog, not the size of the document's pages: a
  document in A4 printed on Letter is cut or shrunk. Printing the PDF the
  engine makes would follow the page exactly.
- **On a Mac the application quits with its last window**, as on Windows,
  rather than staying in the Dock.
- **Recent documents** are not kept, nor the size and place of the windows.
- **No signing.** The installers are not signed or notarized: a Mac warns
  before opening one downloaded from elsewhere.
