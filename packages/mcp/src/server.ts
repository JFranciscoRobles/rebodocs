// A Model Context Protocol server for documents: what an assistant talks to.
// It speaks JSON-RPC, a message a line, and offers the tools of `tools.ts` on
// two kinds of document: the DOCX files it is asked to open, kept in memory
// until they are saved, and the document open in an editor in the browser,
// which it reaches through the bridge. Node only; `main.ts` runs it.

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, isAbsolute, relative, resolve } from 'node:path';
import { type Doc, type FontFile, FontMeasurer, createDoc, embeddedFonts, exportDocx, exportMarkdown, importDocx, layoutDocument, readFont, renderPdf } from '@rebodocs/core';
import type { Bridge, EditorInfo } from './bridge';
import { EXPORT_TOOL } from './browser';
import { familiesOf, fontsFor } from './fonts';
import { TOOLS, type Tool, ToolError, findTool, runTool, toolProperties } from './tools';

export interface ServerOptions {
  /** The way to an editor in the browser, when there is one. */
  bridge?: Bridge;
  /** Folders to look for fonts in, before the ones of the system. */
  fontDirs?: string[];
  /** Folders files may be read from and written to; anywhere, when none is given. */
  roots?: string[];
  /** Where relative paths start. */
  cwd?: string;
  /** The address of the editor, said to the assistant when none is connected. */
  editorUrl?: string;
}

interface Message {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
}

/** A file that is open: the document as it is now, and as it was last read or written. */
interface OpenFile {
  path: string;
  doc: Doc;
  saved: Doc;
  /** False for a new document that has not been written anywhere yet. */
  onDisk: boolean;
}

const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
/** The name the document in the editor goes by. */
const LIVE = 'editor';

const DOCUMENT = {
  type: 'string',
  description: `Which document: the path of a file opened with open_document, or "${LIVE}" for the one open in the editor in the browser ("${LIVE}:2" for the second, when several editors are connected: list_documents names them). Left out, it is the last file opened, or the editor when no file is open.`,
};

const IMAGE_TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif' };

/** The tools that are about files and the editor, not about what is in a document. */
const OWN: Omit<Tool, 'run' | 'writes'>[] = [
  {
    name: 'open_document',
    description: 'Opens a Word file (.docx) to read it and change it. It is kept in memory: nothing is written until save_document. Gives its overview.',
    properties: { path: { type: 'string', description: 'The path of the .docx file.' } },
    required: ['path'],
  },
  {
    name: 'new_document',
    description: 'Starts an empty document, to write in and save. Gives it the path it will be saved to.',
    properties: { path: { type: 'string', description: 'Where it will be saved: a path ending in .docx.' } },
    required: ['path'],
  },
  {
    name: 'save_document',
    description: `Writes a document to a file: Word (.docx), PDF (.pdf) or Markdown (.md), by the ending of the path. A DOCX that was opened keeps everything that was not changed exactly as it was. With "${LIVE}" as the document, it saves what is open in the editor. It does not write over a file that is there unless "overwrite" is true: saving a copy under a new name is the safe way.`,
    properties: {
      document: DOCUMENT,
      path: { type: 'string', description: 'Where to write. Left out, the file the document was opened from.' },
      overwrite: { type: 'boolean', description: 'Write over a file that is already there. False when left out.' },
    },
  },
  {
    name: 'list_documents',
    description: 'The documents that can be worked on now: the files that are open, with whether each has changes not saved, and whether an editor is connected.',
    properties: {},
  },
  {
    name: 'close_document',
    description: 'Forgets a file that is open, with any changes that were not saved.',
    properties: { path: { type: 'string', description: 'The path of the file.' } },
    required: ['path'],
  },
];

export interface DocServer {
  /** Answers a message of the protocol; nothing for the ones that ask for no answer. */
  handle(message: Message): Promise<object | undefined>;
}

export function createDocServer(options: ServerOptions = {}): DocServer {
  const { bridge } = options;
  const cwd = options.cwd ?? process.cwd();
  const roots = (options.roots ?? []).map((root) => resolve(cwd, root));
  const files = new Map<string, OpenFile>();
  let current: string | undefined;

  class Refused extends Error {}
  const refuse = (message: string): never => {
    throw new Refused(message);
  };

  const pathOf = (given: unknown): string => {
    if (typeof given !== 'string' || !given.trim()) refuse('"path" must be the path of a file.');
    const path = resolve(cwd, given as string);
    const inside = (root: string) => {
      const rel = relative(root, path);
      return !!rel && !rel.startsWith('..') && !isAbsolute(rel);
    };
    if (roots.length && !roots.some(inside)) refuse(`"${path}" is outside the folders this server may use: ${roots.join(', ')}.`);
    return path;
  };

  // --- Pages, with no browser ---------------------------------------------------

  const fontCache = new Map<string, FontFile[]>();
  const fontsOf = (doc: Doc): FontFile[] => {
    // Reading the folders takes a while: once for each set of families.
    const key = [...familiesOf(doc)].sort().join('|');
    if (!fontCache.has(key)) fontCache.set(key, fontsFor(doc, options.fontDirs));
    return fontCache.get(key)!;
  };
  const pageOf = (doc: Doc) => {
    const own = doc.source ? embeddedFonts(doc.source).map((font) => readFont(font.bytes, font)).filter((font): font is FontFile => !!font) : [];
    const fonts = [...own, ...fontsOf(doc)];
    if (!fonts.length) throw new ToolError('No font files were found on this machine, so the pages of the document cannot be worked out.');
    const { lines, paraFirstLine } = layoutDocument(doc, new FontMeasurer(fonts));
    return (para: number) => (lines[paraFirstLine[para]]?.page ?? 0) + 1;
  };

  // --- Which document -----------------------------------------------------------

  const howToConnect = () =>
    !bridge
      ? 'This server was started without the way to the editor.'
      : bridge.problem
        ? `There is no way to the editor: ${bridge.problem}.`
        : `No editor is connected. Ask the person to open the editor${options.editorUrl ? ` (${options.editorUrl})` : ''} and switch on "AI" in the bar at the bottom of it.`;

  const editorName = (editor: EditorInfo, several: boolean) => `"${several ? `${LIVE}:${editor.id}` : LIVE}"${editor.name ? ` — ${editor.name}` : ''}`;

  /** The editor `given` names: the only one there is, or the one of that number. */
  const editorOf = async (given: string): Promise<EditorInfo> => {
    const editors = (await bridge?.editors()) ?? [];
    if (!editors.length) refuse(howToConnect());
    const number = /:(\d+)$/.exec(given)?.[1];
    if (number !== undefined) return editors.find((editor) => editor.id === Number(number)) ?? refuse(`There is no editor ${number}. Connected: ${editors.map((editor) => editorName(editor, true)).join(', ')}.`);
    if (editors.length > 1) refuse(`${editors.length} editors are connected: say which. ${editors.map((editor) => editorName(editor, true)).join(', ')}.`);
    return editors[0];
  };

  /** The document a tool is for: a file that is open, or an editor. */
  const target = async (given: unknown): Promise<OpenFile | EditorInfo> => {
    if (typeof given === 'string' && /^(editor|live)(:\d+)?$/.test(given.trim())) return editorOf(given.trim());
    if (typeof given === 'string' && given.trim()) {
      const path = resolve(cwd, given);
      return files.get(path) ?? refuse(`"${given}" is not open: open_document opens a file. Open now: ${[...files.keys()].join(', ') || 'none'}.`);
    }
    if (current && files.has(current)) return files.get(current)!;
    if ((await bridge?.editors())?.length) return editorOf(LIVE);
    return refuse(`No document is open. open_document opens a .docx file; or work on the one in the editor. ${howToConnect()}`);
  };
  const isFile = (on: OpenFile | EditorInfo): on is OpenFile => 'path' in on;

  // --- Saving -------------------------------------------------------------------

  const write = (doc: Doc, path: string, overwrite: boolean): string => {
    const kind = extname(path).toLowerCase();
    if (!['.docx', '.pdf', '.md'].includes(kind)) refuse(`The path must end in .docx, .pdf or .md, not "${kind || 'nothing'}".`);
    if (existsSync(path) && statSync(path).isDirectory()) refuse(`"${path}" is a folder.`);
    if (existsSync(path) && !overwrite) refuse(`"${path}" already exists. Save under another name, or, if the person wants it replaced, give "overwrite": true.`);
    if (kind === '.docx') {
      writeFileSync(path, exportDocx(doc));
      return `Saved ${path}.`;
    }
    if (kind === '.md') {
      writeFileSync(path, exportMarkdown(doc));
      return `Saved ${path}.`;
    }
    const fonts = fontsOf(doc);
    if (!fonts.length) refuse('No font files were found on this machine, so a PDF cannot be drawn.');
    const { pdf, layout, missingFonts } = renderPdf(doc, fonts, basename(path, kind));
    writeFileSync(path, pdf);
    const stood = [...missingFonts].map(([family, used]) => `"${family}" was set in "${used}"`).join('; ');
    return `Saved ${path}: ${layout.pages.length} pages.${stood ? ` Fonts this machine lacks: ${stood}; lines may break elsewhere than in Word.` : ''}`;
  };

  // --- The tools of the server itself -------------------------------------------

  const own: Record<string, (args: Record<string, unknown>) => Promise<string> | string> = {
    open_document(args) {
      const path = pathOf(args.path);
      if (extname(path).toLowerCase() !== '.docx') refuse('Only .docx files can be opened.');
      if (!existsSync(path)) refuse(`There is no file "${path}".`);
      let doc: Doc;
      try {
        doc = importDocx(new Uint8Array(readFileSync(path)));
      } catch (error) {
        return refuse(`"${path}" could not be read as a DOCX: ${error instanceof Error ? error.message : String(error)}`);
      }
      const had = files.get(path);
      files.set(path, { path, doc, saved: doc, onDisk: true });
      current = path;
      return `${had && had.doc !== had.saved ? 'Opened again from the file: the changes that were not saved are gone.' : 'Opened.'} It is the document the tools act on now.\n${findTool('get_overview')!.run(doc, {}, {}).text}`;
    },
    new_document(args) {
      const path = pathOf(args.path);
      if (extname(path).toLowerCase() !== '.docx') refuse('The path of a new document must end in .docx.');
      if (existsSync(path)) refuse(`"${path}" already exists: open it with open_document, or choose another name.`);
      const doc = createDoc();
      files.set(path, { path, doc, saved: doc, onDisk: false });
      current = path;
      return `New document, to be saved to ${path}. It is empty: insert_paragraphs with after_paragraph 0 writes in it. Styles: Normal, Title, Subtitle, Heading1, Heading2, Heading3.`;
    },
    async save_document(args) {
      const from = await target(args.document);
      const overwrite = args.overwrite === true;
      if (!isFile(from)) {
        if (args.path === undefined) refuse(`Say where to save the document of the editor with "path".`);
        const path = pathOf(args.path);
        const answer = await bridge!.call(from.id, EXPORT_TOOL, {});
        if (!answer.ok || !answer.data) refuse(`The editor did not give its document: ${answer.text || 'no answer'}`);
        return write(importDocx(new Uint8Array(Buffer.from(answer.data!, 'base64'))), path, overwrite);
      }
      const path = args.path === undefined ? from.path : pathOf(args.path);
      // A new document has nothing under it to write over.
      const said = write(from.doc, path, overwrite || (path === from.path && !from.onDisk));
      if (path === from.path) {
        from.saved = from.doc;
        from.onDisk = true;
      }
      return said;
    },
    async list_documents() {
      const open = [...files.values()].map((file) => `${file.path}${file.path === current ? ' (current)' : ''}${file.doc !== file.saved || !file.onDisk ? ' — changes not saved' : ''}`);
      const editors = (await bridge?.editors()) ?? [];
      const live = editors.length === 1 ? `An editor is connected: its document is ${editorName(editors[0], false)}.` : `${editors.length} editors are connected:\n${editors.map((editor) => editorName(editor, true)).join('\n')}`;
      return [open.length ? `Files open:\n${open.join('\n')}` : 'No files are open.', editors.length ? live : howToConnect()].join('\n');
    },
    close_document(args) {
      const path = resolve(cwd, String(args.path ?? ''));
      const file = files.get(path) ?? refuse(`"${path}" is not open.`);
      files.delete(path);
      if (current === path) current = [...files.keys()].pop();
      return `Closed.${file.doc !== file.saved ? ' Its changes were not saved.' : ''}`;
    },
  };

  const call = async (name: string, args: Record<string, unknown>): Promise<string> => {
    if (own[name]) return own[name](args);
    if (!findTool(name)) refuse(`There is no tool "${name}".`);
    const { document, ...rest } = args;
    const on = await target(document);
    // A picture is read here, where the file is: a page cannot open a path.
    if (name === 'insert_image' || (name === 'set_letterhead' && rest.path !== undefined && rest.remove !== true)) {
      const path = pathOf(rest.path);
      const type = IMAGE_TYPES[extname(path).toLowerCase()] ?? refuse('Only PNG, JPEG and GIF pictures can be put in a document.');
      if (!existsSync(path) || statSync(path).isDirectory()) refuse(`There is no file "${path}".`);
      Object.assign(rest, { type, data: readFileSync(path).toString('base64') });
    }
    if (name === 'compare_documents') {
      const path = pathOf(rest.path);
      if (!existsSync(path) || statSync(path).isDirectory()) refuse(`There is no file "${path}".`);
      Object.assign(rest, { data: readFileSync(path).toString('base64') });
    }
    if (!isFile(on)) {
      const answer = await bridge!.call(on.id, name, rest);
      if (!answer.ok) refuse(answer.text);
      return answer.text;
    }
    const result = runTool(on.doc, name, rest, { pageOf });
    if (result.doc) on.doc = result.doc;
    return result.text;
  };

  const listed = [
    ...OWN.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: { type: 'object', properties: tool.properties, required: tool.required ?? [] } })),
    ...TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: { type: 'object', properties: { ...toolProperties(tool), document: DOCUMENT }, required: tool.required ?? [] },
      annotations: { readOnlyHint: !tool.writes },
    })),
  ];

  const INSTRUCTIONS =
    'Tools to read and edit Word documents (.docx). Work on a file with open_document, or on the document a person has open in the editor in their browser by ' +
    `giving "${LIVE}" as the document. Paragraphs go by number: read_document shows them, and the numbers move when paragraphs are inserted or deleted, so read again ` +
    'before using a number after such a change. To change a text, give it exactly as it reads. The header and the footer are read and changed with "area". ' +
    'Changes to a file stay in memory until save_document; prefer saving a copy ' +
    'to writing over the original. To review a document without changing it, use add_note.';

  return {
    async handle(message) {
      const { id, method, params = {} } = message;
      const answer = (result: object) => (id === undefined || id === null ? undefined : { jsonrpc: '2.0', id, result });
      switch (method) {
        case 'initialize': {
          const asked = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
          return answer({
            protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
            capabilities: { tools: {} },
            serverInfo: { name: 'rebodocs', version: '0.9.1' },
            instructions: INSTRUCTIONS,
          });
        }
        case 'ping':
          return answer({});
        case 'tools/list':
          return answer({ tools: listed });
        case 'tools/call': {
          const name = String(params.name ?? '');
          const args = params.arguments && typeof params.arguments === 'object' ? (params.arguments as Record<string, unknown>) : {};
          try {
            return answer({ content: [{ type: 'text', text: await call(name, args) }] });
          } catch (error) {
            // What the assistant can put right is said to it as the result of the tool; anything else is a fault of the server.
            const known = error instanceof Refused || error instanceof ToolError;
            const text = error instanceof Error ? error.message : String(error);
            return answer({ content: [{ type: 'text', text: known ? text : `The tool failed: ${text}` }], isError: true });
          }
        }
        default:
          // Notifications ask for no answer; a request for something else gets told so.
          if (id === undefined || id === null) return undefined;
          return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
      }
    },
  };
}
