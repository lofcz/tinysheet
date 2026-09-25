import JSZip from "jszip";
import { IuploadfileList } from "../common/ICommon";
import { normalizeSpreadsheetNamespace } from "./xmlScan";
import {
  workBookFile,
  stylesFile,
  sharedStringsFile,
  theme1File,
  calcChainFile,
  workbookRels,
} from "../common/constant";

const REL_TYPES: [RegExp, string][] = [
  [/\/styles$/, stylesFile],
  [/\/sharedStrings$/, sharedStringsFile],
  [/\/theme$/, theme1File],
  [/\/calcChain$/, calcChainFile],
];

function relationshipTargets(xml: string | undefined) {
  const out: { type: string; target: string }[] = [];
  (typeof xml === "string"
    ? (xml.match(/<Relationship\b[^>]*>/g) ?? [])
    : []
  ).forEach((tag) => {
    const type = /\bType\s*=\s*["']([^"']*)["']/.exec(tag)?.[1];
    const target = /\bTarget\s*=\s*["']([^"']*)["']/.exec(tag)?.[1];
    if (type && target && !/TargetMode\s*=\s*["']External/i.test(tag)) {
      out.push({ type, target });
    }
  });
  return out;
}

function resolveFrom(base: string, target: string) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/").filter(Boolean);
  target.split("/").forEach((seg) => {
    if (seg === "..") parts.pop();
    else if (seg !== "." && seg !== "") parts.push(seg);
  });
  return parts.join("/");
}

/**
 * The importer reads the main parts from their usual paths
 * (xl/workbook.xml, xl/styles.xml, ...). Packages that store them elsewhere
 * or with other letter case (allowed: parts are found through the
 * relationships and names are case-insensitive) get aliases at the usual
 * paths.
 */
export function resolvePackageParts(files: IuploadfileList): IuploadfileList {
  const lower = new Map<string, string>();
  Object.keys(files).forEach((name) => {
    if (!lower.has(name.toLowerCase())) lower.set(name.toLowerCase(), name);
  });
  const find = (path: string) => lower.get(path.toLowerCase());
  const alias = (expected: string, actual: string | undefined) => {
    if (!actual || actual === expected || files[expected] != null) return;
    files[expected] = files[actual];
  };

  // the workbook part: _rels/.rels -> officeDocument
  const rootRels = files[find("_rels/.rels") ?? "_rels/.rels"];
  const office = relationshipTargets(rootRels).find((r) =>
    /\/officeDocument$/.test(r.type)
  );
  const workbookPath = office
    ? find(resolveFrom("", office.target))
    : find(workBookFile);
  alias(workBookFile, workbookPath);
  if (!workbookPath) return files;

  const slash = workbookPath.lastIndexOf("/");
  const dir = workbookPath.slice(0, slash);
  const relsPath = find(`${dir}/_rels/${workbookPath.slice(slash + 1)}.rels`);
  alias(workbookRels, relsPath);
  const rels = relationshipTargets(files[relsPath ?? ""]);
  REL_TYPES.forEach(([type, expected]) => {
    const rel = rels.find((r) => type.test(r.type));
    if (rel) alias(expected, find(resolveFrom(dir, rel.target)));
  });
  return files;
}

const IMAGE_TYPES: Record<string, 1> = {
  png: 1,
  jpeg: 1,
  jpg: 1,
  gif: 1,
  bmp: 1,
  tif: 1,
  webp: 1,
};

export class HandleZip {
  uploadFile: File | Blob | ArrayBuffer | Uint8Array;
  workBook: JSZip;

  constructor(file: File | Blob | ArrayBuffer | Uint8Array) {
    this.uploadFile = file;
  }

  /**
   * Every part of the package: XML and other text as strings (SpreadsheetML
   * namespace prefixes removed), images as data URLs, EMF as ArrayBuffer.
   * Unreadable entries are skipped instead of failing the whole import.
   */
  async unzipFile(): Promise<IuploadfileList> {
    const zip = await JSZip.loadAsync(this.uploadFile as any);
    const fileList: IuploadfileList = <IuploadfileList>{};
    const entries = Object.values(zip.files).filter((entry) => !entry.dir);
    const results: any[] = new Array(entries.length);
    await Promise.all(
      entries.map(async (zipEntry, index) => {
        const fileName = zipEntry.name;
        const dot = fileName.lastIndexOf(".");
        const suffix = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
        let fileType: JSZip.OutputType = "string";
        if (Object.prototype.hasOwnProperty.call(IMAGE_TYPES, suffix)) {
          fileType = "base64";
        } else if (suffix == "emf") {
          fileType = "arraybuffer";
        }
        let data: any;
        try {
          data = await zipEntry.async(fileType);
        } catch (e) {
          return;
        }
        if (fileType == "base64") {
          data = "data:image/" + suffix + ";base64," + data;
        } else if (
          fileType == "string" &&
          (suffix == "xml" || suffix == "rels")
        ) {
          data = normalizeSpreadsheetNamespace(data);
        }
        results[index] = data;
      })
    );
    // keep the zip's order (lookups by partial name take the first match)
    entries.forEach((entry, index) => {
      if (results[index] !== undefined) {
        fileList[entry.name] = results[index] as string; // EMF: ArrayBuffer
      }
    });
    return resolvePackageParts(fileList);
  }
}
