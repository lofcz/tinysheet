/**
 * Write TinySheet shapes and text boxes (`sheet.shapes`) into an xlsx
 * package as DrawingML: `xdr:sp` (preset geometry, fill, outline, shadow,
 * rich text), `xdr:cxnSp` for lines and connectors and `xdr:grpSp` for
 * groups, each in a `twoCellAnchor` (shapes move and size with cells).
 *
 * exceljs cannot write shapes, so the anchors are added to the written zip,
 * in the same drawing part as the sheet's pictures and charts.
 */
import JSZip from "jszip";
import {
  anchorsToBox,
  boxToAnchors,
  configGeometry,
  isLineShape,
  Shape,
  ShapeAnchor,
  ShapeBox,
  ShapeText,
  ShapeTextRun,
  Sheet,
  unionBox,
} from "@lofcz/tinysheet-core";
import { escapeXmlText as esc } from "../chart/xml";
import { appendDrawingAnchors, worksheetParts } from "../common/drawingPackage";

export const EMU_PER_PX = 9525;

const emu = (px: number) => Math.round(px * EMU_PER_PX);

function hex(color: string | undefined, fallback: string) {
  const c = color && /^#?[0-9a-f]{6}$/i.test(color) ? color : fallback;
  return c.replace("#", "").toUpperCase();
}

function colorXml(color: string, alpha?: number) {
  const a =
    alpha != null && alpha < 1
      ? `<a:alpha val="${Math.round(Math.max(0, alpha) * 100000)}"/>`
      : "";
  return `<a:srgbClr val="${hex(color, "000000")}"${
    a ? `>${a}</a:srgbClr>` : "/>"
  }`;
}

function anchorCell(tag: string, a: ShapeAnchor) {
  return `<xdr:${tag}><xdr:col>${a.c}</xdr:col><xdr:colOff>${emu(
    a.dx
  )}</xdr:colOff><xdr:row>${a.r}</xdr:row><xdr:rowOff>${emu(
    a.dy
  )}</xdr:rowOff></xdr:${tag}>`;
}

function xfrmXml(shape: Shape | null, box: ShapeBox, child?: ShapeBox) {
  const attrs: string[] = [];
  if (shape?.rot) attrs.push(`rot="${Math.round(shape.rot * 60000)}"`);
  if (shape?.flipH) attrs.push('flipH="1"');
  if (shape?.flipV) attrs.push('flipV="1"');
  const open = attrs.length ? `<a:xfrm ${attrs.join(" ")}>` : "<a:xfrm>";
  const ch = child
    ? `<a:chOff x="${emu(child.left)}" y="${emu(
        child.top
      )}"/><a:chExt cx="${emu(child.width)}" cy="${emu(child.height)}"/>`
    : "";
  return `${open}<a:off x="${emu(box.left)}" y="${emu(
    box.top
  )}"/><a:ext cx="${emu(box.width)}" cy="${emu(box.height)}"/>${ch}</a:xfrm>`;
}

function geometryXml(shape: Shape) {
  const gd = Object.entries(shape.adj ?? {})
    .map(
      ([name, v]) => `<a:gd name="${esc(name)}" fmla="val ${Math.round(v)}"/>`
    )
    .join("");
  return `<a:prstGeom prst="${esc(
    shape.prst
  )}"><a:avLst>${gd}</a:avLst></a:prstGeom>`;
}

const DASH_XML: Record<string, string> = {
  solid: "solid",
  dash: "dash",
  dot: "dot",
  dashDot: "dashDot",
  lgDash: "lgDash",
  sysDash: "sysDash",
  sysDot: "sysDot",
};

function spPrXml(shape: Shape, box: ShapeBox) {
  let out = xfrmXml(shape, box) + geometryXml(shape);
  const line = isLineShape(shape);
  if (!line && shape.fill) {
    out += `<a:solidFill>${colorXml(
      shape.fill.color,
      shape.fill.transparency != null ? 1 - shape.fill.transparency : undefined
    )}</a:solidFill>`;
  } else {
    out += "<a:noFill/>";
  }
  if (shape.line) {
    const l = shape.line;
    out += `<a:ln w="${emu(l.width)}"><a:solidFill>${colorXml(
      l.color
    )}</a:solidFill>`;
    if (l.dash && l.dash !== "solid" && DASH_XML[l.dash])
      out += `<a:prstDash val="${DASH_XML[l.dash]}"/>`;
    if (l.head && l.head !== "none") out += `<a:headEnd type="${l.head}"/>`;
    if (l.tail && l.tail !== "none") out += `<a:tailEnd type="${l.tail}"/>`;
    out += "</a:ln>";
  } else {
    out += "<a:ln><a:noFill/></a:ln>";
  }
  if (shape.shadow) {
    out +=
      '<a:effectLst><a:outerShdw blurRad="38100" dist="25400" dir="2700000" algn="tl" rotWithShape="0">' +
      '<a:srgbClr val="000000"><a:alpha val="40000"/></a:srgbClr></a:outerShdw></a:effectLst>';
  }
  return `<xdr:spPr>${out}</xdr:spPr>`;
}

/** Default text colour: TinySheet draws shape text white on filled shapes. */
function defaultTextColor(shape: Shape) {
  return shape.textBox || !shape.fill ? "#000000" : "#FFFFFF";
}

function rPrXml(
  tag: "rPr" | "endParaRPr",
  run: Omit<ShapeTextRun, "text">,
  fallbackColor: string
) {
  const attrs = ['lang="en-US"'];
  if (run.size) attrs.push(`sz="${Math.round(run.size * 100)}"`);
  if (run.b) attrs.push('b="1"');
  if (run.i) attrs.push('i="1"');
  if (run.u) attrs.push('u="sng"');
  if (run.strike) attrs.push('strike="sngStrike"');
  let inner = `<a:solidFill>${colorXml(
    run.color ?? fallbackColor
  )}</a:solidFill>`;
  if (run.font) {
    const face = esc(run.font);
    inner += `<a:latin typeface="${face}"/><a:cs typeface="${face}"/>`;
  }
  return `<a:${tag} ${attrs.join(" ")}>${inner}</a:${tag}>`;
}

function txBodyXml(shape: Shape) {
  const text: ShapeText = shape.text ?? { paragraphs: [{ runs: [] }] };
  const anchor = text.anchor ?? (shape.textBox ? "t" : "ctr");
  const wrap = text.wrap === false ? "none" : "square";
  const defaults = text.defaults ?? {};
  const baseColor = defaults.color ?? defaultTextColor(shape);
  const paragraphs = text.paragraphs.length
    ? text.paragraphs
    : [{ runs: [] as ShapeTextRun[] }];
  const ps = paragraphs
    .map((p) => {
      const algn = p.align ?? (shape.textBox ? "l" : "ctr");
      let runs = "";
      p.runs.forEach((r) => {
        const { text: value, ...fmt } = r;
        const merged = { ...defaults, ...fmt };
        value.split("\n").forEach((part, i) => {
          if (i > 0) runs += `<a:br>${rPrXml("rPr", merged, baseColor)}</a:br>`;
          if (part !== "")
            runs += `<a:r>${rPrXml("rPr", merged, baseColor)}<a:t>${esc(
              part
            )}</a:t></a:r>`;
        });
      });
      return `<a:p><a:pPr algn="${algn}"/>${runs}${rPrXml(
        "endParaRPr",
        defaults,
        baseColor
      )}</a:p>`;
    })
    .join("");
  return (
    `<xdr:txBody><a:bodyPr vertOverflow="clip" horzOverflow="clip" wrap="${wrap}" rtlCol="0" anchor="${anchor}"/>` +
    `<a:lstStyle/>${ps}</xdr:txBody>`
  );
}

function shapeXml(shape: Shape, box: ShapeBox, id: number) {
  const name = esc(shape.name || `Shape ${id}`);
  const descr = shape.alt ? ` descr="${esc(shape.alt)}"` : "";
  if (isLineShape(shape)) {
    return (
      `<xdr:cxnSp macro=""><xdr:nvCxnSpPr><xdr:cNvPr id="${id}" name="${name}"${descr}/><xdr:cNvCxnSpPr/></xdr:nvCxnSpPr>` +
      `${spPrXml(shape, box)}</xdr:cxnSp>`
    );
  }
  return (
    `<xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="${id}" name="${name}"${descr}/>` +
    `<xdr:cNvSpPr${shape.textBox ? ' txBox="1"' : ""}/></xdr:nvSpPr>` +
    `${spPrXml(shape, box)}${txBodyXml(shape)}</xdr:sp>`
  );
}

function twoCellAnchor(from: ShapeAnchor, to: ShapeAnchor, body: string) {
  return `<xdr:twoCellAnchor>${anchorCell("from", from)}${anchorCell(
    "to",
    to
  )}${body}<xdr:clientData/></xdr:twoCellAnchor>`;
}

/**
 * Drawing anchors for a sheet's shapes, numbering object ids from
 * `firstId`. Shapes sharing a group id become one `xdr:grpSp`.
 */
export function shapesToAnchorsXml(sheet: Sheet, firstId: number): string {
  const shapes = sheet.shapes ?? [];
  const geo = configGeometry(
    sheet.config,
    sheet.defaultRowHeight ?? 19,
    sheet.defaultColWidth ?? 73
  );
  let id = firstId;
  let out = "";
  const done = new Set<string>();
  shapes.forEach((shape) => {
    if (done.has(shape.id)) return;
    if (!shape.group) {
      done.add(shape.id);
      const box = anchorsToBox(geo, shape.from, shape.to);
      out += twoCellAnchor(shape.from, shape.to, shapeXml(shape, box, id));
      id += 1;
      return;
    }
    const members = shapes.filter((s) => s.group === shape.group);
    members.forEach((s) => done.add(s.id));
    const boxes = members.map((s) => anchorsToBox(geo, s.from, s.to));
    const union = unionBox(boxes)!;
    const groupId = id;
    id += 1;
    let children = "";
    members.forEach((s, i) => {
      children += shapeXml(s, boxes[i], id);
      id += 1;
    });
    const { from, to } = boxToAnchors(geo, union);
    out += twoCellAnchor(
      from,
      to,
      `<xdr:grpSp><xdr:nvGrpSpPr><xdr:cNvPr id="${groupId}" name="Group ${groupId}"/><xdr:cNvGrpSpPr/></xdr:nvGrpSpPr>` +
        `<xdr:grpSpPr>${xfrmXml(
          null,
          union,
          union
        )}</xdr:grpSpPr>${children}</xdr:grpSp>`
    );
  });
  return out;
}

/**
 * Add every sheet's shapes to an xlsx buffer written by exceljs (sheets are
 * matched by name). Anchors join the sheet's existing drawing part.
 */
/** Add the sheets' shapes to the drawing parts of an open xlsx package. */
export async function addShapesToZip(zip: JSZip, sheets: Sheet[]) {
  if (!sheets.some((s) => s.shapes?.length)) return;
  let types = await zip.file("[Content_Types].xml")?.async("string");
  if (!types) return;
  const parts = await worksheetParts(zip);
  // One sheet at a time: sheets share the content types and numbering.
  /* eslint-disable no-await-in-loop */
  for (const sheet of sheets) {
    const path = parts.get(sheet.name);
    if (!sheet.shapes?.length || !path) continue;
    types = await appendDrawingAnchors(
      zip,
      path,
      (firstId) => shapesToAnchorsXml(sheet, firstId),
      types
    );
  }
  /* eslint-enable no-await-in-loop */
  zip.file("[Content_Types].xml", types);
}

/** Add the sheets' shapes to a written xlsx buffer. */
export async function addShapesToXlsx(
  buffer: ArrayBuffer | Uint8Array,
  sheets: Sheet[]
): Promise<ArrayBuffer | Uint8Array> {
  if (!sheets.some((s) => s.shapes?.length)) return buffer;
  const zip = await JSZip.loadAsync(buffer);
  await addShapesToZip(zip, sheets);
  return zip.generateAsync({
    type: buffer instanceof Uint8Array ? "uint8array" : "arraybuffer",
    compression: "DEFLATE",
  });
}
