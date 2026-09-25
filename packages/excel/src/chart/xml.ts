/**
 * Minimal XML tree parser for DrawingML chart parts. Namespace prefixes are
 * dropped (`c:barChart` and a default-namespace `barChart` both become
 * `barChart`), which is what chart readers want: Excel and openpyxl disagree
 * on prefixes.
 */
export type XmlNode = {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

export function decodeXmlEntities(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n =
        code[1] === "x" || code[1] === "X"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code] ?? whole;
  });
}

function localName(name: string) {
  const i = name.indexOf(":");
  return i >= 0 ? name.slice(i + 1) : name;
}

export function parseXml(xml: string): XmlNode {
  const root: XmlNode = { name: "#root", attrs: {}, children: [], text: "" };
  const stack: XmlNode[] = [root];
  const cleaned = xml
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, t: string) =>
      t.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    );
  const token = /<(\/?)([^\s/>]+)([^>]*?)(\/?)>|([^<]+)/g;
  const attrRe = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null = token.exec(cleaned);
  while (m) {
    const parent = stack[stack.length - 1];
    if (m[5] != null) {
      parent.text += decodeXmlEntities(m[5]);
    } else if (m[1]) {
      if (stack.length > 1) stack.pop();
    } else {
      const node: XmlNode = {
        name: localName(m[2]),
        attrs: {},
        children: [],
        text: "",
      };
      let a: RegExpExecArray | null = attrRe.exec(m[3]);
      while (a) {
        node.attrs[localName(a[1])] = decodeXmlEntities(a[3] ?? a[4] ?? "");
        a = attrRe.exec(m[3]);
      }
      attrRe.lastIndex = 0;
      parent.children.push(node);
      if (!m[4]) stack.push(node);
    }
    m = token.exec(cleaned);
  }
  return root;
}

/** First descendant along a path of local names (`child(n, "tx", "v")`). */
export function child(
  node: XmlNode | undefined,
  ...path: string[]
): XmlNode | undefined {
  let cur = node;
  for (let i = 0; i < path.length && cur; i += 1) {
    cur = cur.children.find((c) => c.name === path[i]);
  }
  return cur;
}

export function children(node: XmlNode | undefined, name: string): XmlNode[] {
  return node ? node.children.filter((c) => c.name === name) : [];
}

/** Depth-first search for the first node named `name`. */
export function find(
  node: XmlNode | undefined,
  name: string
): XmlNode | undefined {
  if (!node) return undefined;
  for (let i = 0; i < node.children.length; i += 1) {
    const c = node.children[i];
    if (c.name === name) return c;
    const hit = find(c, name);
    if (hit) return hit;
  }
  return undefined;
}

export function findAll(node: XmlNode | undefined, name: string): XmlNode[] {
  const out: XmlNode[] = [];
  const walk = (n: XmlNode) => {
    n.children.forEach((c) => {
      if (c.name === name) out.push(c);
      walk(c);
    });
  };
  if (node) walk(node);
  return out;
}

/** `val` attribute of a child element. */
export function val(node: XmlNode | undefined, ...path: string[]) {
  return child(node, ...path)?.attrs.val;
}

export function escapeXmlText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
