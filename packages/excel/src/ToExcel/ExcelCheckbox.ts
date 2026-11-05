import { cellAddress } from "../common/formulaText";
import type { SheetExportContext } from "./buildWorkbook";
export const FEATURE_BAG_PATH = "xl/featurePropertyBag/featurePropertyBag.xml";

export function collectCheckboxes(ctx: SheetExportContext) {
  ctx.data.forEach((row, r) =>
    row?.forEach((cell, c) => {
      if (cell?.cb) ctx.worksheet.addCheckbox(cellAddress(r, c));
    })
  );
}

function splitXfs(inner: string): string[] {
  return [...(inner.match(/<xf\b[^>]*\/>|<xf\b[^>]*>[\s\S]*?<\/xf>/g) ?? [])];
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

type Bag = { type: string; body: string };

function parseBags(xml: string): Bag[] {
  const out: Bag[] = [];
  const re = /<(?:\w+:)?bag\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?bag>)/g;
  let m = re.exec(xml);
  while (m) {
    out.push({
      type: /\btype="([^"]*)"/.exec(m[1])?.[1] ?? "",
      body: m[2] ?? "",
    });
    m = re.exec(xml);
  }
  return out;
}

function bagIds(body: string) {
  return [...body.matchAll(/<(?:\w+:)?bagId\b[^>]*>\s*(\d+)\s*</g)].map((x) =>
    Number(x[1])
  );
}

/**
 * Indexes of the `cellXfs` formats that are checkboxes, from styles.xml and
 * the feature property bag part (empty when either is missing).
 */
export function checkboxXfIndexes(
  stylesXml: string | undefined,
  bagXml: string | undefined
): Set<number> {
  const out = new Set<number>();
  if (!stylesXml || !bagXml) return out;
  const bags = parseBags(bagXml);
  const mapper = bags.find((b) => b.type === "XFComplements");
  const mappedList =
    /<(?:\w+:)?a\b[^>]*k="MappedFeaturePropertyBags"[^>]*>([\s\S]*?)<\/(?:\w+:)?a>/.exec(
      mapper?.body ?? ""
    )?.[1];
  const mapped = mappedList ? bagIds(mappedList) : [];
  const reachesCheckbox = (start: number) => {
    const seen = new Set<number>();
    const stack = [start];
    while (stack.length) {
      const i = stack.pop()!;
      if (seen.has(i) || !bags[i]) continue;
      seen.add(i);
      if (bags[i].type === "Checkbox") return true;
      stack.push(...bagIds(bags[i].body));
    }
    return false;
  };
  const cellXfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml);
  if (!cellXfs) return out;
  splitXfs(cellXfs[1]).forEach((xf, index) => {
    const i = /<(?:\w+:)?xfComplement\b[^>]*\bi="(\d+)"/.exec(xf)?.[1];
    if (i == null) return;
    const bag = mapped[Number(i)];
    if (bag != null && reachesCheckbox(bag)) out.add(index);
  });
  return out;
}

function decodeAddress(a: string) {
  const m = /^([A-Z]+)(\d+)$/.exec(a);
  if (!m) return null;
  let c = 0;
  for (let i = 0; i < m[1].length; i += 1) c = c * 26 + m[1].charCodeAt(i) - 64;
  return { r: Number(m[2]) - 1, c: c - 1 };
}

/** The checkbox cells of a worksheet part, given the checkbox formats. */
export function checkboxCellsOf(sheetXml: string, xfs: Set<number>) {
  const out: { r: number; c: number }[] = [];
  if (xfs.size === 0) return out;
  const re = /<c\b([^>]*)>/g;
  let m = re.exec(sheetXml);
  while (m) {
    const s = /\ss="(\d+)"/.exec(m[1])?.[1];
    const r = /\sr="([A-Z]+\d+)"/.exec(m[1])?.[1];
    if (s != null && r && xfs.has(Number(s))) {
      const pos = decodeAddress(r);
      if (pos) out.push(pos);
    }
    m = re.exec(sheetXml);
  }
  return out;
}
