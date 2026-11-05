import type { SheetExportContext } from "./buildWorkbook";
import { cellAddress, toExcelFormula } from "../common/formulaText";

const DATA_IMAGE_RE = /^data:image\/([a-z0-9.+-]+)(?:;[a-z0-9=.+-]+)*;base64,/i;

function quote(s: string) {
  return `"${s.replace(/"/g, '""')}"`;
}

export function writeCellImages(ctx: SheetExportContext) {
  const { data, worksheet } = ctx;
  for (let r = 0; r < data.length; r += 1) {
    const row = data[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c += 1) {
      const cell = row[c];
      const img = cell?.img;
      if (!img || typeof img.src !== "string") continue;
      const { mc } = cell!;
      if (mc && (mc.r !== r || mc.c !== c)) continue;
      if (cell!.f != null && String(cell!.f).trim() !== "") {
        // Excel draws IMAGE() results once it recalculates
        ctx.workbook.fullCalcOnLoad = true;
        continue;
      }
      const alt = img.alt == null ? "" : String(img.alt);
      const target = worksheet.getCell(cellAddress(r, c));
      if (DATA_IMAGE_RE.test(img.src)) {
        const match = DATA_IMAGE_RE.exec(img.src)!;
        const subtype = match[1].toLowerCase();
        const extension =
          subtype === "svg+xml" ? "svg" : subtype === "jpg" ? "jpeg" : subtype;
        const binary = atob(img.src.slice(match[0].length).replace(/\s/g, ""));
        const buffer = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        const id = ctx.workbook.addImage({ buffer, extension });
        worksheet.addCellImage(id, cellAddress(r, c), alt);
      } else {
        const args = [quote(img.src)];
        if (alt || (img.sizing && img.sizing !== 0)) args.push(quote(alt));
        if (img.sizing) {
          args.push(String(img.sizing));
          if (img.sizing === 3)
            args.push(String(img.h ?? ""), String(img.w ?? ""));
        }
        const { formula } = toExcelFormula(`=IMAGE(${args.join(",")})`);
        target.value = { formula, result: alt } as any;
        ctx.workbook.fullCalcOnLoad = true;
      }
    }
  }
}
