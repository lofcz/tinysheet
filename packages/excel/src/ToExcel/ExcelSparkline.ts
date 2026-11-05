import { cellAddress } from "../common/formulaText";
import { DEFAULT_SPARKLINE_COLORS } from "@lofcz/tinysheet-core";
import type { SparklineGroup } from "@lofcz/ts-xlsx/core";
import type { SheetExportContext } from "./buildWorkbook";
import { colorToArgb } from "../common/units";

export function writeSparklines(ctx: SheetExportContext) {
  for (const group of ctx.sheet.sparklineGroups ?? []) {
    const { id: _id, colors, sparklines, ...options } = group;
    const resolved = Object.fromEntries(
      Object.entries({ ...DEFAULT_SPARKLINE_COLORS, ...colors })
        .map(([key, value]) => [key, colorToArgb(value as string)])
        .filter(([, value]) => !!value)
    );
    const items = (sparklines ?? [])
      .filter(
        (item: any) => Number.isInteger(item.r) && Number.isInteger(item.c)
      )
      .map((item: any) => ({
        ref: cellAddress(item.r, item.c),
        formula: item.f || "#REF!",
      }));
    if (items.length)
      ctx.worksheet.addSparklineGroup({
        ...options,
        colors: resolved,
        sparklines: items,
      } as SparklineGroup);
  }
}
