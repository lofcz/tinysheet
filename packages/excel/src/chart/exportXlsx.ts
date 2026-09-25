/**
 * Write TinySheet chart objects into an xlsx package as native DrawingML
 * charts (xl/charts/chartN.xml + drawing anchors).
 *
 * exceljs (including the @protobi fork) has no API for creating charts; it
 * only round-trips chart parts it read from a file. So the workbook is first
 * written by exceljs and the chart parts are then added to the zip:
 * chart XML, a drawing (or extra anchors in the drawing exceljs wrote for
 * images), the relationships and the content-type overrides.
 */
import JSZip from "jszip";
import {
  Chart,
  chartPaletteColor,
  chartRangeToText,
  ChartRange,
  readChartRange,
  resolveChartModel,
  Sheet,
} from "@lofcz/tinysheet-core";
import { escapeXmlText as esc } from "./xml";

const NS_C = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_R =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_XDR =
  "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
const REL_CHART =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart";
const REL_DRAWING =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing";
const CT_CHART =
  "application/vnd.openxmlformats-officedocument.drawingml.chart+xml";
const CT_DRAWING = "application/vnd.openxmlformats-officedocument.drawing+xml";
const EMU_PER_PX = 9525;

type SheetsCtx = { luckysheetfile: Sheet[] };

function hex(color: string | undefined, fallback: string) {
  const c = color && /^#?[0-9a-f]{6}$/i.test(color) ? color : fallback;
  return c.replace("#", "").toUpperCase();
}

function solidFill(color: string) {
  return `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>`;
}

function richTitle(text: string, size = 1400) {
  return (
    `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}" b="0"/></a:pPr>` +
    `<a:r><a:rPr lang="en-US" sz="${size}" b="0"/><a:t>${esc(
      text
    )}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`
  );
}

function numCache(values: (number | null)[]) {
  let pts = "";
  values.forEach((v, i) => {
    if (v != null && Number.isFinite(v))
      pts += `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`;
  });
  return `<c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${pts}`;
}

function strCache(values: string[]) {
  let pts = "";
  values.forEach((v, i) => {
    pts += `<c:pt idx="${i}"><c:v>${esc(v ?? "")}</c:v></c:pt>`;
  });
  return `<c:ptCount val="${values.length}"/>${pts}`;
}

function numSource(
  ctx: SheetsCtx,
  range: ChartRange | null | undefined,
  values: (number | null)[]
) {
  if (range) {
    return `<c:numRef><c:f>${esc(
      chartRangeToText(ctx, range)
    )}</c:f><c:numCache>${numCache(values)}</c:numCache></c:numRef>`;
  }
  return `<c:numLit>${numCache(values)}</c:numLit>`;
}

function strSource(
  ctx: SheetsCtx,
  range: ChartRange | null | undefined,
  values: string[]
) {
  if (range) {
    return `<c:strRef><c:f>${esc(
      chartRangeToText(ctx, range)
    )}</c:f><c:strCache>${strCache(values)}</c:strCache></c:strRef>`;
  }
  return `<c:strLit>${strCache(values)}</c:strLit>`;
}

const DLBLS_OFF =
  '<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/>';
const DLBLS_ON =
  '<c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/>';

/** DrawingML chart part for one chart. */
export function chartToXml(ctx: SheetsCtx, chart: Chart): string {
  const model = resolveChartModel(ctx, chart);
  const { type } = chart;
  const grouping = chart.grouping ?? "clustered";
  const pie = type === "pie" || type === "doughnut";
  const scatter = type === "scatter";
  const vary = pie || !!chart.varyColors;
  const catRange = chart.series.find((s) => s.categories)?.categories;
  const catNumeric =
    !!catRange && readChartRange(ctx, catRange).every((c) => !c.text);

  let series = "";
  chart.series.forEach((s, i) => {
    const m = model.series[i];
    const color = hex(s.color, chartPaletteColor(i));
    let x = `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>`;
    if (s.nameRef && !s.name) {
      x += `<c:tx>${strSource(ctx, s.nameRef, [m.name])}</c:tx>`;
    } else {
      x += `<c:tx><c:v>${esc(m.name)}</c:v></c:tx>`;
    }
    if (type === "line" || (scatter && chart.scatterLines)) {
      x += `<c:spPr><a:ln w="28575" cap="rnd">${solidFill(
        color
      )}<a:round/></a:ln></c:spPr>`;
    } else if (scatter) {
      x += `<c:spPr><a:ln w="25400"><a:noFill/></a:ln></c:spPr>`;
    } else {
      x += `<c:spPr>${solidFill(color)}${
        pie
          ? '<a:ln w="12700"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln>'
          : ""
      }</c:spPr>`;
    }
    if (type === "column" || type === "bar")
      x += '<c:invertIfNegative val="0"/>';
    if (type === "line" || scatter) {
      x +=
        chart.markers === false
          ? '<c:marker><c:symbol val="none"/></c:marker>'
          : `<c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr>${solidFill(
              color
            )}</c:spPr></c:marker>`;
    }
    if (vary && m.pointColors) {
      m.pointColors.forEach((pc, p) => {
        x += `<c:dPt><c:idx val="${p}"/>${
          pie
            ? '<c:bubble3D val="0"/>'
            : '<c:invertIfNegative val="0"/><c:bubble3D val="0"/>'
        }<c:spPr>${solidFill(hex(pc, chartPaletteColor(p)))}</c:spPr></c:dPt>`;
      });
    }
    const { categories } = model;
    if (scatter) {
      const xs = m.xValues ?? m.values.map((_, p) => p + 1);
      x += `<c:xVal>${
        catNumeric || !s.categories
          ? numSource(ctx, s.categories, xs)
          : strSource(ctx, s.categories, categories)
      }</c:xVal>`;
      x += `<c:yVal>${numSource(ctx, s.values, m.values)}</c:yVal>`;
      x += '<c:smooth val="0"/>';
    } else {
      if (s.categories || categories.length) {
        x += `<c:cat>${
          catNumeric
            ? numSource(
                ctx,
                s.categories,
                categories.map((c) => (c === "" ? null : Number(c)))
              )
            : strSource(ctx, s.categories, categories)
        }</c:cat>`;
      }
      x += `<c:val>${numSource(ctx, s.values, m.values)}</c:val>`;
      if (type === "line") x += '<c:smooth val="0"/>';
    }
    x += "</c:ser>";
    series += x;
  });

  const dLbls = `<c:dLbls>${chart.dataLabels ? DLBLS_ON : DLBLS_OFF}</c:dLbls>`;
  const xmlGrouping =
    (type === "line" || type === "area") && grouping === "clustered"
      ? "standard"
      : grouping;
  let group = "";
  const axIds = '<c:axId val="500000001"/><c:axId val="500000002"/>';
  switch (type) {
    case "column":
    case "bar":
      group =
        `<c:barChart><c:barDir val="${type === "bar" ? "bar" : "col"}"/>` +
        `<c:grouping val="${grouping}"/><c:varyColors val="${
          vary ? 1 : 0
        }"/>${series}${dLbls}<c:gapWidth val="150"/>${
          grouping === "clustered" ? "" : '<c:overlap val="100"/>'
        }${axIds}</c:barChart>`;
      break;
    case "line":
      group = `<c:lineChart><c:grouping val="${xmlGrouping}"/><c:varyColors val="0"/>${series}${dLbls}<c:marker val="${
        chart.markers === false ? 0 : 1
      }"/>${axIds}</c:lineChart>`;
      break;
    case "area":
      group = `<c:areaChart><c:grouping val="${xmlGrouping}"/><c:varyColors val="0"/>${series}${dLbls}${axIds}</c:areaChart>`;
      break;
    case "pie":
      group = `<c:pieChart><c:varyColors val="1"/>${series}${dLbls}<c:firstSliceAng val="0"/></c:pieChart>`;
      break;
    case "doughnut":
      group = `<c:doughnutChart><c:varyColors val="1"/>${series}${dLbls}<c:firstSliceAng val="0"/><c:holeSize val="50"/></c:doughnutChart>`;
      break;
    default:
      group = `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${series}${dLbls}${axIds}</c:scatterChart>`;
  }

  const gridlines = chart.gridlines !== false ? "<c:majorGridlines/>" : "";
  const axisTitle = (t?: string) =>
    t && t.trim() ? richTitle(t.trim(), 1000) : "";
  const scaling = (withBounds: boolean) => {
    let out = '<c:scaling><c:orientation val="minMax"/>';
    if (withBounds && chart.valueAxis?.max != null)
      out += `<c:max val="${chart.valueAxis.max}"/>`;
    if (withBounds && chart.valueAxis?.min != null)
      out += `<c:min val="${chart.valueAxis.min}"/>`;
    return `${out}</c:scaling>`;
  };
  const common =
    '<c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>';
  const majorUnit =
    chart.valueAxis?.majorUnit != null
      ? `<c:majorUnit val="${chart.valueAxis.majorUnit}"/>`
      : "";
  const catPos = type === "bar" ? "l" : "b";
  const valPos = type === "bar" ? "b" : "l";
  const valueFormat =
    grouping === "percentStacked" && !scatter ? "0%" : "General";
  let axes = "";
  if (scatter) {
    axes =
      `<c:valAx><c:axId val="500000001"/>${scaling(
        false
      )}<c:delete val="0"/><c:axPos val="b"/>${axisTitle(
        chart.categoryAxisTitle
      )}<c:numFmt formatCode="General" sourceLinked="1"/>${common}<c:crossAx val="500000002"/><c:crosses val="autoZero"/><c:crossBetween val="midCat"/></c:valAx>` +
      `<c:valAx><c:axId val="500000002"/>${scaling(
        true
      )}<c:delete val="0"/><c:axPos val="l"/>${gridlines}${axisTitle(
        chart.valueAxisTitle
      )}<c:numFmt formatCode="General" sourceLinked="1"/>${common}<c:crossAx val="500000001"/><c:crosses val="autoZero"/><c:crossBetween val="midCat"/>${majorUnit}</c:valAx>`;
  } else if (!pie) {
    axes =
      `<c:catAx><c:axId val="500000001"/>${scaling(
        false
      )}<c:delete val="0"/><c:axPos val="${catPos}"/>${axisTitle(
        chart.categoryAxisTitle
      )}<c:numFmt formatCode="General" sourceLinked="1"/>${common}<c:crossAx val="500000002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
      `<c:valAx><c:axId val="500000002"/>${scaling(
        true
      )}<c:delete val="0"/><c:axPos val="${valPos}"/>${gridlines}${axisTitle(
        chart.valueAxisTitle
      )}<c:numFmt formatCode="${valueFormat}" sourceLinked="${
        valueFormat === "General" ? 1 : 0
      }"/>${common}<c:crossAx val="500000001"/><c:crosses val="autoZero"/><c:crossBetween val="${
        type === "area" ? "midCat" : "between"
      }"/>${majorUnit}</c:valAx>`;
  }

  const legendPos = { right: "r", left: "l", top: "t", bottom: "b" } as const;
  const legend =
    chart.legend === "none"
      ? ""
      : `<c:legend><c:legendPos val="${
          legendPos[chart.legend ?? "right"]
        }"/><c:overlay val="0"/></c:legend>`;
  const title = chart.title?.trim();

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}">` +
    `<c:roundedCorners val="0"/><c:chart>${
      title ? richTitle(title) : ""
    }<c:autoTitleDeleted val="${
      title ? 0 : 1
    }"/><c:plotArea><c:layout/>${group}${axes}</c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>` +
    `<c:spPr>${solidFill("FFFFFF")}<a:ln w="9525">${solidFill(
      "D9D9D9"
    )}</a:ln></c:spPr></c:chartSpace>`
  );
}

// ---------------------------------------------------------------------------
// Anchors
// ---------------------------------------------------------------------------

type CellOffset = { index: number; offsetPx: number };

/** Sheet pixel offset (zoom 1, grid lines included) → cell + offset. */
export function pixelToCell(
  px: number,
  sizes: (i: number) => number,
  hidden: (i: number) => boolean,
  max = 20000
): CellOffset {
  let pos = 0;
  for (let i = 0; i < max; i += 1) {
    if (!hidden(i)) {
      const size = sizes(i) + 1;
      if (px < pos + size) {
        return {
          index: i,
          offsetPx: Math.max(0, Math.min(sizes(i), px - pos)),
        };
      }
      pos += size;
    }
  }
  return { index: max, offsetPx: 0 };
}

function anchorFor(sheet: Sheet, chart: Chart) {
  const cfg = sheet.config || {};
  const colW = (c: number) =>
    Number(cfg.columnlen?.[c] ?? sheet.defaultColWidth ?? 73);
  const rowH = (r: number) =>
    Number(cfg.rowlen?.[r] ?? sheet.defaultRowHeight ?? 19);
  const colHidden = (c: number) => cfg.colhidden?.[c] != null;
  const rowHidden = (r: number) => cfg.rowhidden?.[r] != null;
  return {
    from: {
      col: pixelToCell(chart.left, colW, colHidden),
      row: pixelToCell(chart.top, rowH, rowHidden),
    },
    to: {
      col: pixelToCell(chart.left + chart.width, colW, colHidden),
      row: pixelToCell(chart.top + chart.height, rowH, rowHidden),
    },
  };
}

function anchorXml(sheet: Sheet, chart: Chart, rid: string, shapeId: number) {
  const a = anchorFor(sheet, chart);
  const cell = (tag: string, c: CellOffset, r: CellOffset) =>
    `<xdr:${tag}><xdr:col>${c.index}</xdr:col><xdr:colOff>${Math.round(
      c.offsetPx * EMU_PER_PX
    )}</xdr:colOff><xdr:row>${r.index}</xdr:row><xdr:rowOff>${Math.round(
      r.offsetPx * EMU_PER_PX
    )}</xdr:rowOff></xdr:${tag}>`;
  const name = esc(chart.title?.trim() || `Chart ${shapeId}`);
  return (
    `<xdr:twoCellAnchor editAs="oneCell">${cell(
      "from",
      a.from.col,
      a.from.row
    )}${cell("to", a.to.col, a.to.row)}` +
    `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${shapeId}" name="${name}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
    `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>` +
    `<a:graphic><a:graphicData uri="${NS_C}"><c:chart xmlns:c="${NS_C}" xmlns:r="${NS_R}" r:id="${rid}"/></a:graphicData></a:graphic>` +
    `</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`
  );
}

// ---------------------------------------------------------------------------
// Package plumbing
// ---------------------------------------------------------------------------

function attr(tag: string, name: string) {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1] : undefined;
}

function decodeAttr(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function relsOf(xml: string) {
  const out: { id: string; target: string; type: string }[] = [];
  (xml.match(/<Relationship\b[^>]*>/g) || []).forEach((tag) => {
    out.push({
      id: attr(tag, "Id") ?? "",
      target: attr(tag, "Target") ?? "",
      type: attr(tag, "Type") ?? "",
    });
  });
  return out;
}

function nextRid(xml: string) {
  let max = 0;
  relsOf(xml).forEach((r) => {
    const n = parseInt(r.id.replace(/\D/g, ""), 10);
    if (Number.isFinite(n) && n > max) max = n;
  });
  return `rId${max + 1}`;
}

function addRel(xml: string | null, id: string, type: string, target: string) {
  const base =
    xml ??
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  return base.replace(
    "</Relationships>",
    `<Relationship Id="${id}" Type="${type}" Target="${target}"/></Relationships>`
  );
}

function resolvePath(from: string, target: string) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = from.split("/");
  parts.pop();
  target.split("/").forEach((p) => {
    if (p === "..") parts.pop();
    else if (p !== ".") parts.push(p);
  });
  return parts.join("/");
}

function relsPathFor(part: string) {
  const i = part.lastIndexOf("/");
  return `${part.slice(0, i)}/_rels/${part.slice(i + 1)}.rels`;
}

const AFTER_DRAWING = [
  "legacyDrawing",
  "legacyDrawingHF",
  "drawingHF",
  "picture",
  "oleObjects",
  "controls",
  "webPublishItems",
  "tableParts",
  "extLst",
];

function insertDrawingElement(sheetXml: string, rid: string) {
  let xml = sheetXml;
  const rootTag = xml.match(/<worksheet\b[^>]*>/);
  if (rootTag && !/xmlns:r=/.test(rootTag[0])) {
    xml = xml.replace(
      rootTag[0],
      rootTag[0].replace("<worksheet", `<worksheet xmlns:r="${NS_R}"`)
    );
  }
  const el = `<drawing r:id="${rid}"/>`;
  for (let i = 0; i < AFTER_DRAWING.length; i += 1) {
    const idx = xml.search(new RegExp(`<${AFTER_DRAWING[i]}[\\s/>]`));
    if (idx >= 0) return xml.slice(0, idx) + el + xml.slice(idx);
  }
  return xml.replace("</worksheet>", `${el}</worksheet>`);
}

function addOverride(types: string, part: string, contentType: string) {
  if (types.includes(`PartName="/${part}"`)) return types;
  return types.replace(
    "</Types>",
    `<Override PartName="/${part}" ContentType="${contentType}"/></Types>`
  );
}

/**
 * Add native chart parts for every sheet's `charts` to an xlsx buffer written
 * by exceljs. Sheets are matched by name.
 */
export async function addChartsToXlsx(
  buffer: ArrayBuffer | Uint8Array,
  sheets: Sheet[]
): Promise<ArrayBuffer | Uint8Array> {
  if (!sheets.some((s) => s.charts?.length)) return buffer;
  const zip = await JSZip.loadAsync(buffer);
  if (!(await addChartsToZip(zip, sheets))) return buffer;
  return zip.generateAsync({
    type: buffer instanceof Uint8Array ? "uint8array" : "arraybuffer",
    compression: "DEFLATE",
  });
}

/**
 * Add the chart parts to an opened package (the "charts" zip
 * post-processor). `sheetForName` maps a written sheet name to its sheet
 * (names can differ from `sheet.name` once made valid for Excel); by
 * default sheets are matched by name. Returns whether anything was added.
 */
export async function addChartsToZip(
  zip: JSZip,
  sheets: Sheet[],
  sheetForName?: (name: string) => Sheet | undefined
): Promise<boolean> {
  if (!sheets.some((s) => s.charts?.length)) return false;
  const ctx: SheetsCtx = { luckysheetfile: sheets };
  const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  const workbookRels = await zip
    .file("xl/_rels/workbook.xml.rels")
    ?.async("string");
  let types = await zip.file("[Content_Types].xml")?.async("string");
  if (!workbookXml || !workbookRels || !types) return false;
  const wbRels = relsOf(workbookRels);

  const existing = Object.keys(zip.files);
  let chartNo = existing.filter((f) =>
    /^xl\/charts\/chart\d+\.xml$/.test(f)
  ).length;
  let drawingNo = existing.filter((f) =>
    /^xl\/drawings\/drawing\d+\.xml$/.test(f)
  ).length;

  const sheetTags = workbookXml.match(/<sheet\b[^>]*>/g) || [];
  // Parts are read and rewritten one sheet at a time on purpose: every
  // sheet may add to the same content types and numbering.
  /* eslint-disable no-await-in-loop */
  for (let s = 0; s < sheetTags.length; s += 1) {
    const tag = sheetTags[s];
    const name = decodeAttr(attr(tag, "name") ?? "");
    const rid = attr(tag, "r:id");
    const sheet = sheetForName?.(name) ?? sheets.find((x) => x.name === name);
    const rel = wbRels.find((r) => r.id === rid);
    if (!sheet?.charts?.length || !rel) continue;
    const sheetPath = resolvePath("xl/workbook.xml", rel.target);
    const sheetRelsPath = relsPathFor(sheetPath);
    let sheetXml = await zip.file(sheetPath)?.async("string");
    if (!sheetXml) continue;
    let sheetRels = (await zip.file(sheetRelsPath)?.async("string")) ?? null;

    // Reuse the drawing exceljs wrote for images, or create one.
    let drawingPath: string | undefined;
    const drawingTag = sheetXml.match(/<drawing\b[^>]*>/);
    if (drawingTag && sheetRels) {
      const drawingRid = attr(drawingTag[0], "r:id");
      const drawingRel = relsOf(sheetRels).find((r) => r.id === drawingRid);
      if (drawingRel) drawingPath = resolvePath(sheetPath, drawingRel.target);
    }
    let drawingXml = drawingPath
      ? await zip.file(drawingPath)?.async("string")
      : undefined;
    if (!drawingPath || !drawingXml) {
      drawingNo += 1;
      drawingPath = `xl/drawings/drawing${drawingNo}.xml`;
      drawingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_A}"></xdr:wsDr>`;
      const newRid = nextRid(sheetRels ?? "");
      sheetRels = addRel(
        sheetRels,
        newRid,
        REL_DRAWING,
        `../drawings/drawing${drawingNo}.xml`
      );
      sheetXml = insertDrawingElement(sheetXml, newRid);
      types = addOverride(types, drawingPath, CT_DRAWING);
    }
    const drawingRelsPath = relsPathFor(drawingPath);
    let drawingRels =
      (await zip.file(drawingRelsPath)?.async("string")) ?? null;

    let anchors = "";
    for (let i = 0; i < sheet.charts.length; i += 1) {
      const chart = sheet.charts[i];
      chartNo += 1;
      const chartPath = `xl/charts/chart${chartNo}.xml`;
      zip.file(chartPath, chartToXml(ctx, chart));
      types = addOverride(types, chartPath, CT_CHART);
      const chartRid = nextRid(drawingRels ?? "");
      drawingRels = addRel(
        drawingRels,
        chartRid,
        REL_CHART,
        `../charts/chart${chartNo}.xml`
      );
      anchors += anchorXml(sheet, chart, chartRid, 1000 + i);
    }
    drawingXml = drawingXml.replace(
      /<\/xdr:wsDr>\s*$/,
      `${anchors}</xdr:wsDr>`
    );
    zip.file(drawingPath, drawingXml);
    zip.file(drawingRelsPath, drawingRels!);
    zip.file(sheetPath, sheetXml);
    if (sheetRels) zip.file(sheetRelsPath, sheetRels);
  }
  /* eslint-enable no-await-in-loop */
  zip.file("[Content_Types].xml", types);
  return true;
}
