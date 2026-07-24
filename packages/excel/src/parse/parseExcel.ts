import * as ExcelJS from "@protobi/exceljs";
import { FortuneFile } from "../ToFortuneSheet/FortuneFile";
import { HandleZip } from "../ToFortuneSheet/HandleZip";
import type { ExcelImportResult, ExcelImportSizing } from "./types";

async function toArrayBuffer(
  file: File | Blob | ArrayBuffer,
  fileName?: string
): Promise<{ buffer: ArrayBuffer; name: string }> {
  if (file instanceof ArrayBuffer) {
    return { buffer: file, name: fileName || "workbook.xlsx" };
  }

  const blob = file as Blob & { name?: string };
  const name = fileName || blob.name || "workbook.xlsx";

  if (
    (blob as File).type === "text/csv" ||
    name.toLowerCase().endsWith(".csv")
  ) {
    const csvText = await blob.text();
    const rows = csvText.split("\n").map((row) => row.split(","));
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sheet1");
    rows.forEach((row) => {
      worksheet.addRow(row);
    });
    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
    return {
      buffer,
      name: name.replace(/\.csv$/i, ".xlsx"),
    };
  }

  return { buffer: await blob.arrayBuffer(), name };
}

/**
 * Parse an Excel/CSV file into Prospera sheets without mounting a Workbook.
 * Chart images include `chartSpec` for later hydration after formula calc.
 */
export async function parseExcel(
  file: File | Blob | ArrayBuffer,
  fileName?: string
): Promise<ExcelImportResult> {
  const { buffer, name } = await toArrayBuffer(file, fileName);
  const files = await new HandleZip(new File([buffer], name)).unzipFile();
  const fortuneFile = new FortuneFile(files, name);
  fortuneFile.Parse();
  const serialized = fortuneFile.serialize();
  const sheets = serialized.sheets as ExcelImportResult["sheets"];

  const sizing: ExcelImportSizing[] = sheets.map((sheet) => ({
    id: sheet.id as string,
    columnlen: sheet.config?.columnlen,
    rowlen: sheet.config?.rowlen,
  }));

  return { sheets, sizing };
}
