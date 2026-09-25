/**
 * xlsx -> TinySheet: pictures in cells (Excel 365 "Place in Cell" and
 * IMAGE() results), stored by Excel as rich values.
 *
 * A picture cell carries `vm="N"`: the N-th `valueMetadata` record of
 * xl/metadata.xml, whose `rc` points (for the XLRICHVALUE metadata type) at
 * a `futureMetadata` block naming a rich value (`xlrd:rvb i`). The rich
 * value (xl/richData/rdrichvalue.xml) follows a structure
 * (rdrichvaluestructure.xml):
 *
 * - `_localImage`: `_rvRel:LocalImageIdentifier` indexes
 *   richValueRel.xml, whose relationship targets the picture in xl/media;
 * - `_webimage`: `WebImageIdentifier` indexes rdRichValueWebImage.xml,
 *   whose `address` relationship is the picture's URL;
 *
 * and `Text` is the alt text. The reader turns such cells into TinySheet
 * picture cells (`img`, alt text as the value), keeping a formula
 * (=IMAGE(...)) when there is one.
 */
import type { SheetImportContext } from "./importFeatures";
import { partRelationships } from "./importFeatures";
import { IuploadfileList } from "../common/ICommon";
import { escapeCharacter, getcellrange } from "../common/method";

type CellPicture = { src: string; alt?: string; sizing?: number };

const cache = new WeakMap<IuploadfileList, (CellPicture | null)[]>();

function attrs(tag: string) {
  const out: Record<string, string> = {};
  const re = /([\w:]+)="([^"]*)"/g;
  let m = re.exec(tag);
  while (m) {
    out[m[1]] = escapeCharacter(m[2]);
    m = re.exec(tag);
  }
  return out;
}

/** Elements `<name ...>...</name>` (or self-closing) of a part, in order. */
function elements(xml: string, name: string) {
  const re = new RegExp(
    `<(?:\\w+:)?${name}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:\\w+:)?${name}>)`,
    "g"
  );
  const out: { attrs: Record<string, string>; body: string }[] = [];
  let m = re.exec(xml);
  while (m) {
    out.push({ attrs: attrs(m[1]), body: m[2] ?? "" });
    m = re.exec(xml);
  }
  return out;
}

/** The part a workbook relationship of `type` (suffix) points at. */
function workbookPart(files: IuploadfileList, suffix: RegExp) {
  return partRelationships(files, "xl/workbook.xml").find((rel) =>
    suffix.test(rel.type)
  )?.target;
}

/** Picture per value-metadata record (index vm - 1), null for others. */
function pictureTable(files: IuploadfileList): (CellPicture | null)[] {
  const cached = cache.get(files);
  if (cached) return cached;
  const table: (CellPicture | null)[] = [];
  cache.set(files, table);

  const metaPath =
    workbookPart(files, /\/sheetMetadata$/) ??
    (files["xl/metadata.xml"] ? "xl/metadata.xml" : undefined);
  const metadata = metaPath ? files[metaPath] : undefined;
  if (!metadata || !/XLRICHVALUE/.test(metadata)) return table;

  const typeNames = elements(metadata, "metadataType").map((t) => t.attrs.name);
  const richType = typeNames.indexOf("XLRICHVALUE") + 1;
  const future = elements(metadata, "futureMetadata").find(
    (f) => f.attrs.name === "XLRICHVALUE"
  );
  const richIndexes = future
    ? elements(future.body, "bk").map((bk) => {
        const rvb = /<(?:\w+:)?rvb\b[^>]*\bi="(\d+)"/.exec(bk.body);
        return rvb ? Number(rvb[1]) : -1;
      })
    : [];

  const valuesPath =
    workbookPart(files, /\/rdRichValue$/) ?? "xl/richData/rdrichvalue.xml";
  const structuresPath =
    workbookPart(files, /\/rdRichValueStructure$/) ??
    "xl/richData/rdrichvaluestructure.xml";
  const relPath =
    workbookPart(files, /\/richValueRel$/) ?? "xl/richData/richValueRel.xml";
  const webPath =
    workbookPart(files, /\/rdRichValueWebImage$/) ??
    "xl/richData/rdRichValueWebImage.xml";

  const structures = elements(files[structuresPath] ?? "", "s").map((s) => ({
    type: s.attrs.t,
    keys: elements(s.body, "k").map((k) => k.attrs.n),
  }));
  const values = elements(files[valuesPath] ?? "", "rv").map((rv) => ({
    s: Number(rv.attrs.s),
    v: elements(rv.body, "v").map((v) => escapeCharacter(v.body)),
  }));

  // local pictures: richValueRel.xml entries -> media data URLs
  const relIds = elements(files[relPath] ?? "", "rel").map(
    (r) => r.attrs["r:id"]
  );
  const relTargets = new Map(
    partRelationships(files, relPath).map((r) => [r.id, r.target])
  );
  const localSources = relIds.map((id) => {
    const target = relTargets.get(id);
    const data = target ? files[target] : undefined;
    return typeof data === "string" && /^data:image\//.test(data) ? data : null;
  });
  // web pictures: rdRichValueWebImage.xml address relationships
  const webRels = new Map(
    partRelationships(files, webPath).map((r) => [r.id, r.target])
  );
  const webSources = elements(files[webPath] ?? "", "webImageSrd").map(
    (srd) => {
      const address = /<(?:\w+:)?address\b[^>]*\br:id="([^"]*)"/.exec(srd.body);
      const url = address ? webRels.get(address[1]) : undefined;
      return url && /^https?:\/\//i.test(url) ? url : null;
    }
  );

  const pictureOf = (index: number): CellPicture | null => {
    const rv = values[index];
    const structure = rv && structures[rv.s];
    if (!structure) return null;
    const get = (key: string) => {
      const i = structure.keys.indexOf(key);
      return i >= 0 ? rv.v[i] : undefined;
    };
    let src: string | null = null;
    if (structure.type === "_localImage") {
      src = localSources[Number(get("_rvRel:LocalImageIdentifier"))] ?? null;
    } else if (structure.type === "_webimage") {
      src = webSources[Number(get("WebImageIdentifier"))] ?? null;
    }
    if (!src) return null;
    const picture: CellPicture = { src };
    const alt = get("Text");
    if (alt) picture.alt = alt;
    const sizing = Number(get("ImageSizing"));
    if (sizing === 1 || sizing === 2) picture.sizing = sizing;
    return picture;
  };

  const records = elements(metadata, "valueMetadata")[0];
  if (!records) return table;
  elements(records.body, "bk").forEach((bk) => {
    const rc = /<(?:\w+:)?rc\b([^>]*)\/?>/.exec(bk.body);
    const a = rc ? attrs(rc[1]) : {};
    const index =
      Number(a.t) === richType ? (richIndexes[Number(a.v)] ?? -1) : -1;
    table.push(index >= 0 ? pictureOf(index) : null);
  });
  return table;
}

/** Picture cells of one sheet (cells with a `vm` pointing at a picture). */
export function readCellImages(ctx: SheetImportContext) {
  const xml = ctx.files[ctx.sheetFile];
  if (!xml || xml.indexOf(" vm=") < 0) return;
  const table = pictureTable(ctx.files);
  if (table.length === 0) return;
  const byKey = new Map<string, any>();
  ctx.sheet.celldata.forEach((cell) => byKey.set(`${cell.r}_${cell.c}`, cell));
  const re = /<(?:\w+:)?c\b([^>]*\bvm="(\d+)"[^>]*)>/g;
  let m = re.exec(xml);
  while (m) {
    const picture = table[Number(m[2]) - 1];
    const ref = /\br="([^"]+)"/.exec(m[1])?.[1];
    const range = picture && ref ? getcellrange(ref) : null;
    if (picture && range) {
      const r = range.row[0];
      const c = range.column[0];
      let entry = byKey.get(`${r}_${c}`);
      if (!entry) {
        entry = { r, c, v: {} };
        ctx.sheet.celldata.push(entry);
        byKey.set(`${r}_${c}`, entry);
      }
      if (entry.v == null || typeof entry.v !== "object") entry.v = {};
      const v = entry.v as any;
      const alt = picture.alt ?? "";
      v.img = { ...picture };
      v.v = alt;
      v.m = alt;
      const fa = v.ct?.fa && v.ct.t !== "e" ? v.ct.fa : "General";
      v.ct = { fa, t: "g" };
    }
    m = re.exec(xml);
  }
}
