/**
 * Defined names in xlsx files <-> TinySheet's model (`sheet.definedNames`,
 * see core/src/modules/names.ts).
 *
 * xlsx stores names in xl/workbook.xml:
 *   <definedName name="Rate">0.2</definedName>
 *   <definedName name="Local" localSheetId="1">Sheet2!$A$1</definedName>
 *   <definedName name="Fn">_xlfn.LAMBDA(_xlpm.x,_xlpm.x*2)</definedName>
 * Built-in names (`_xlnm.Print_Area`, `_xlnm._FilterDatabase`, ...) are
 * skipped.
 */

export type DefinedNameModel = {
  name: string;
  refersTo: string;
  local?: boolean;
  comment?: string;
  hidden?: boolean;
};

export type XlsxDefinedName = {
  name: string;
  /** index into the workbook's <sheets> list for sheet-scoped names */
  localSheetId?: number;
  hidden?: boolean;
  comment?: string;
  /** formula text without "=" as stored in the file */
  text: string;
};

function unescapeXml(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&amp;/g, "&");
}

/** Apply `fn` to the parts of a formula outside string literals. */
function mapOutsideStrings(text: string, fn: (part: string) => string) {
  return text
    .split(/("(?:[^"]|"")*")/)
    .map((part, i) => (i % 2 === 1 ? part : fn(part)))
    .join("");
}

/** `_xlfn.LAMBDA(_xlpm.x, _xlpm.x*2)` -> `LAMBDA(x, x*2)` */
export function stripFutureFunctionPrefixes(text: string) {
  return mapOutsideStrings(text, (part) =>
    part.replace(/_xlfn\.(_xlws\.)?/gi, "").replace(/_xlpm\./gi, "")
  );
}

const FUTURE_FUNCTIONS = ["LAMBDA", "LET"];

/** `LAMBDA(x, x*2)` -> `_xlfn.LAMBDA(_xlpm.x, _xlpm.x*2)` (Excel's file form) */
export function addFutureFunctionPrefixes(text: string) {
  if (!/\b(LAMBDA|LET)\s*\(/i.test(text)) return text;
  // parameter / variable names: LAMBDA(a, b, body), LET(a, 1, b, 2, body)
  const params = new Set<string>();
  const callRe = /\b(LAMBDA|LET)\s*\(/gi;
  let m: RegExpExecArray | null = callRe.exec(text);
  while (m) {
    const isLet = m[1].toUpperCase() === "LET";
    let depth = 0;
    let arg = 0;
    let start = callRe.lastIndex;
    for (let i = callRe.lastIndex; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === '"') {
        i = text.indexOf('"', i + 1);
        if (i < 0) break;
      } else if (ch === "(" || ch === "{") depth += 1;
      else if (ch === ")" || ch === "}") {
        if (depth === 0) break;
        depth -= 1;
      } else if (ch === "," && depth === 0) {
        const name = text.slice(start, i).trim();
        if (
          (!isLet || arg % 2 === 0) &&
          /^[A-Za-z_][A-Za-z0-9_.]*$/.test(name)
        ) {
          params.add(name.toUpperCase());
        }
        arg += 1;
        start = i + 1;
      }
    }
    m = callRe.exec(text);
  }
  return mapOutsideStrings(text, (part) =>
    part.replace(
      /(^|[^A-Za-z0-9_.!$'])([A-Za-z_][A-Za-z0-9_.]*)(?=\s*(\()?)/g,
      (all, lead: string, ident: string, paren?: string) => {
        const upper = ident.toUpperCase();
        if (paren && FUTURE_FUNCTIONS.includes(upper)) {
          return `${lead}_xlfn.${ident}`;
        }
        if (!paren && params.has(upper)) return `${lead}_xlpm.${ident}`;
        return all;
      }
    )
  );
}

/**
 * Converts the definedName entries of an xlsx file into per-sheet model
 * entries. `sheetNames` lists the workbook's sheets in <sheets> order.
 * Workbook-scoped names go to the first sheet.
 */
export function importDefinedNames(
  names: XlsxDefinedName[],
  sheetNames: string[]
): Map<string, DefinedNameModel[]> {
  const out = new Map<string, DefinedNameModel[]>();
  names.forEach((n) => {
    if (!n.name || /^_xlnm\./i.test(n.name)) return;
    const text = stripFutureFunctionPrefixes(unescapeXml(n.text ?? "").trim());
    if (!text) return;
    const local = n.localSheetId != null && !Number.isNaN(n.localSheetId);
    const sheetName = local ? sheetNames[n.localSheetId!] : sheetNames[0];
    if (sheetName == null) return;
    const entry: DefinedNameModel = { name: n.name, refersTo: `=${text}` };
    if (local) entry.local = true;
    if (n.hidden) entry.hidden = true;
    if (n.comment) entry.comment = unescapeXml(n.comment);
    const list = out.get(sheetName) ?? [];
    list.push(entry);
    out.set(sheetName, list);
  });
  return out;
}

/** Reads the <definedName> elements of xl/workbook.xml. */
export function readDefinedNamesXml(workbookXml: string): XlsxDefinedName[] {
  const out: XlsxDefinedName[] = [];
  const re = /<definedName\b([^>]*?)(?:\/>|>([\s\S]*?)<\/definedName>)/g;
  let m: RegExpExecArray | null = re.exec(workbookXml);
  while (m) {
    const attrs: Record<string, string> = {};
    const attrRe = /([A-Za-z_:][A-Za-z0-9_:.-]*)\s*=\s*"([^"]*)"/g;
    let a: RegExpExecArray | null = attrRe.exec(m[1]);
    while (a) {
      attrs[a[1]] = unescapeXml(a[2]);
      a = attrRe.exec(m[1]);
    }
    if (attrs.name) {
      out.push({
        name: attrs.name,
        localSheetId:
          attrs.localSheetId != null
            ? parseInt(attrs.localSheetId, 10)
            : undefined,
        hidden: attrs.hidden === "1" || attrs.hidden === "true",
        comment: attrs.comment,
        text: m[2] ?? "",
      });
    }
    m = re.exec(workbookXml);
  }
  return out;
}

/**
 * The definedName models ExcelJS writes for the names of `sheets`
 * (TinySheet sheets); `worksheetNames` lists the exported worksheets in
 * order (for localSheetId).
 */
export function exportDefinedNames(
  sheets: { name: string; definedNames?: DefinedNameModel[] }[],
  worksheetNames: string[]
): { name: string; localSheetId?: number; ranges: string[] }[] {
  const out: { name: string; localSheetId?: number; ranges: string[] }[] = [];
  const seen = new Set<string>();
  sheets.forEach((sheet) => {
    (sheet.definedNames ?? []).forEach((d) => {
      if (!d?.name || !d.refersTo) return;
      let text = d.refersTo.trim();
      if (text.startsWith("=")) text = text.slice(1);
      text = addFutureFunctionPrefixes(text);
      const localSheetId = d.local
        ? worksheetNames.indexOf(sheet.name)
        : undefined;
      if (d.local && localSheetId! < 0) return;
      const key = `${d.name.toUpperCase()}|${localSheetId ?? ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(
        localSheetId != null
          ? { name: d.name, localSheetId, ranges: [text] }
          : { name: d.name, ranges: [text] }
      );
    });
  });
  return out;
}

/**
 * Adds the defined names of `sheets` to an ExcelJS workbook. ExcelJS only
 * models names that are cell ranges, so the model it writes is extended
 * instead (its xform writes the text verbatim, XML-escaped).
 */
export function setDefinedNames(
  workbook: any,
  sheets: { name: string; definedNames?: DefinedNameModel[] }[]
) {
  const names = exportDefinedNames(
    sheets,
    (workbook.worksheets ?? []).map((ws: any) => ws.name)
  );
  if (names.length === 0) return;
  const original = workbook._definedNames;
  if (!original) return;
  // eslint-disable-next-line no-underscore-dangle
  workbook._definedNames = Object.create(original, {
    model: {
      get: () => [...(original.model ?? []), ...names],
      set: (value: any) => {
        original.model = value;
      },
    },
  });
}
