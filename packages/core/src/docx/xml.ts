// Minimal XML reader/writer helpers, enough for OOXML parts.

export interface XmlNode {
  /** Qualified tag name, or '#text' for character data. */
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
  /**
   * Offsets into the parsed source: the node spans [start, end) and its content
   * spans [openEnd, closeStart). A self-closing tag has an empty content span.
   */
  start: number;
  openEnd: number;
  closeStart: number;
  end: number;
}

export function createNode(name: string, attrs: Record<string, string> = {}): XmlNode {
  return { name, attrs, children: [], text: '', start: 0, openEnd: 0, closeStart: 0, end: 0 };
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeEntities(text: string): string {
  if (!text.includes('&')) return text;
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (match, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return ENTITIES[body] ?? match;
  });
}

export function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function tagEnd(src: string, from: number): number {
  let quote = '';
  for (let i = from; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      return i;
    }
  }
  return src.length;
}

function skipPast(src: string, marker: string, from: number): number {
  const at = src.indexOf(marker, from);
  return at < 0 ? src.length : at + marker.length;
}

/** Parses a document and returns a synthetic '#root' node holding the top-level nodes. */
export function parseXml(src: string): XmlNode {
  const root: XmlNode = { ...createNode('#root'), closeStart: src.length, end: src.length };
  const stack: XmlNode[] = [root];
  const top = () => stack[stack.length - 1];
  const addText = (text: string, start: number, end: number) => {
    if (text) top().children.push({ ...createNode('#text'), text, start, openEnd: start, closeStart: end, end });
  };

  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt < 0) {
      addText(decodeEntities(src.slice(i)), i, src.length);
      break;
    }
    if (lt > i) addText(decodeEntities(src.slice(i, lt)), i, lt);

    if (src.startsWith('<!--', lt)) {
      i = skipPast(src, '-->', lt);
    } else if (src.startsWith('<![CDATA[', lt)) {
      const end = skipPast(src, ']]>', lt);
      addText(src.slice(lt + 9, end - 3), lt, end);
      i = end;
    } else if (src.startsWith('<?', lt)) {
      i = skipPast(src, '?>', lt);
    } else if (src.startsWith('<!', lt)) {
      i = skipPast(src, '>', lt);
    } else {
      const gt = tagEnd(src, lt);
      const tag = src.slice(lt + 1, gt);
      i = gt + 1;
      if (tag[0] === '/') {
        if (stack.length > 1) {
          const closed = stack.pop()!;
          closed.closeStart = lt;
          closed.end = i;
        }
        continue;
      }
      const selfClosing = tag.endsWith('/');
      const body = selfClosing ? tag.slice(0, -1) : tag;
      const name = /^[^\s]+/.exec(body)?.[0] ?? '';
      const attrs: Record<string, string> = {};
      for (const m of body.slice(name.length).matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
        attrs[m[1]] = decodeEntities(m[2] ?? m[3] ?? '');
      }
      // An element left unclosed runs to the end of the source.
      const node: XmlNode = selfClosing
        ? { ...createNode(name, attrs), start: lt, openEnd: i, closeStart: i, end: i }
        : { ...createNode(name, attrs), start: lt, openEnd: i, closeStart: src.length, end: src.length };
      top().children.push(node);
      if (!selfClosing) stack.push(node);
    }
  }
  return root;
}

export function child(node: XmlNode | undefined, name: string): XmlNode | undefined {
  return node?.children.find((c) => c.name === name);
}

export function childrenOf(node: XmlNode | undefined, name: string): XmlNode[] {
  return node ? node.children.filter((c) => c.name === name) : [];
}

export function textOf(node: XmlNode): string {
  let out = '';
  for (const c of node.children) if (c.name === '#text') out += c.text;
  return out;
}

function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function serializeXml(node: XmlNode): string {
  if (node.name === '#text') return escapeText(node.text);
  let attrs = '';
  for (const [key, value] of Object.entries(node.attrs)) attrs += ` ${key}="${escapeXml(value)}"`;
  if (!node.children.length) return `<${node.name}${attrs}/>`;
  return `<${node.name}${attrs}>${node.children.map(serializeXml).join('')}</${node.name}>`;
}

/** Parses a fragment that holds a single element. */
export function parseElement(src: string): XmlNode | undefined {
  return parseXml(src).children.find((c) => c.name !== '#text');
}
