/**
 * Off-main-thread import: index the source in a Web Worker, then attach
 * copy-on-write cell views on the main thread.
 *
 * Worker script (bundle it as a module worker):
 *
 *   // excel.worker.ts
 *   import { exposeParseExcelWorker } from "@lofcz/tinysheet-excel";
 *   exposeParseExcelWorker();
 *
 * Main thread:
 *
 *   const worker = new Worker(new URL("./excel.worker.ts", import.meta.url), {
 *     type: "module",
 *   });
 *   const result = await parseExcelInWorker(worker, file);
 *   applyExcelImport(workbookRef.current, result); // as with parseExcel
 *
 * XLSX results carry source XML, compact row indexes and metadata; ordinary
 * cells are decoded only when requested. CSV results use transferred JSON by
 * default, or structured cloning with `transfer: "clone"`.
 */
import { parseExcelDocument, ParseExcelOptions } from "./parseExcel";
import type { ExcelImportResult } from "./types";
import { bindSourceImport, sourceTransferResult } from "./source";

export type ParseExcelWorkerRequest = {
  type: "tinysheet:parseExcel";
  id: number;
  input: Blob | ArrayBuffer;
  fileName?: string;
  options?: ParseExcelOptions;
  transfer?: "json" | "clone";
};

export type ParseExcelWorkerResponse =
  | {
      type: "tinysheet:parseExcel:result";
      id: number;
      /** UTF-8 JSON of the ExcelImportResult (transfer: "json"). */
      json?: ArrayBuffer;
      /** The result itself (transfer: "clone"). */
      result?: ExcelImportResult;
    }
  | { type: "tinysheet:parseExcel:error"; id: number; error: string };

type MessageScope = {
  addEventListener(type: "message", listener: (event: any) => void): void;
  postMessage(message: any, transfer?: ArrayBuffer[]): void;
};

/** An import result as one UTF-8 JSON buffer (for transferring). */
export function encodeExcelImportResult(
  result: ExcelImportResult
): ArrayBuffer {
  const bytes = new TextEncoder().encode(
    JSON.stringify(sourceTransferResult(result), (_key, value) =>
      value instanceof Uint32Array ? { $rows: Array.from(value) } : value
    )
  );
  return bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
    ? (bytes.buffer as ArrayBuffer)
    : (bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer);
}

export function decodeExcelImportResult(
  buffer: ArrayBuffer | Uint8Array
): ExcelImportResult {
  return bindSourceImport(
    JSON.parse(new TextDecoder().decode(buffer), (_key, value) =>
      value?.$rows ? Uint32Array.from(value.$rows) : value
    )
  );
}

/** Answer one parse request (what the worker runs for each message). */
export async function handleParseExcelRequest(
  request: ParseExcelWorkerRequest
): Promise<{ response: ParseExcelWorkerResponse; transfer: ArrayBuffer[] }> {
  try {
    const result = await parseExcelDocument(
      request.input,
      request.fileName,
      request.options ?? {}
    );
    if (result.source || request.transfer === "clone") {
      return {
        response: {
          type: "tinysheet:parseExcel:result",
          id: request.id,
          result: sourceTransferResult(result),
        },
        transfer: result.source
          ? [
              result.source.stringOffsets.buffer as ArrayBuffer,
              ...result.source.worksheets.flatMap((sheet) => [
                sheet.rows.buffer as ArrayBuffer,
                sheet.cells.buffer as ArrayBuffer,
                sheet.rowCellStarts.buffer as ArrayBuffer,
              ]),
            ]
          : [],
      };
    }
    const json = encodeExcelImportResult(result);
    return {
      response: { type: "tinysheet:parseExcel:result", id: request.id, json },
      transfer: [json],
    };
  } catch (e) {
    return {
      response: {
        type: "tinysheet:parseExcel:error",
        id: request.id,
        error: e instanceof Error ? e.message : String(e),
      },
      transfer: [],
    };
  }
}

/**
 * Serve parse requests in a worker (call once in the worker script).
 * `scope` defaults to the worker's global scope.
 */
export function exposeParseExcelWorker(scope?: MessageScope) {
  const target: MessageScope = scope ?? (globalThis as any);
  target.addEventListener("message", async (event: any) => {
    const request = event?.data as ParseExcelWorkerRequest;
    if (request?.type !== "tinysheet:parseExcel") return;
    const { response, transfer } = await handleParseExcelRequest(request);
    target.postMessage(response, transfer);
  });
}

type WorkerLike = {
  addEventListener(
    type: "message" | "error" | "messageerror",
    listener: (event: any) => void
  ): void;
  removeEventListener(
    type: "message" | "error" | "messageerror",
    listener: (event: any) => void
  ): void;
  postMessage(message: any, transfer?: ArrayBuffer[]): void;
};

let nextRequestId = 1;

export type ParseExcelInWorkerOptions = ParseExcelOptions & {
  /** CSV transport (default "json"). XLSX always transfers compact source indexes. */
  transfer?: "json" | "clone";
};

/**
 * Parse a file in a worker that called `exposeParseExcelWorker`. Resolves
 * with the same result as `parseExcel`. ArrayBuffer input is copied before
 * being transferred, so the caller's buffer stays usable.
 */
export function parseExcelInWorker(
  worker: WorkerLike,
  input: File | Blob | ArrayBuffer | Uint8Array,
  fileName?: string,
  options: ParseExcelInWorkerOptions = {}
): Promise<ExcelImportResult> {
  const id = nextRequestId++;
  const { transfer = "json", ...parseOptions } = options;
  let payload: Blob | ArrayBuffer;
  const transferList: ArrayBuffer[] = [];
  if (input instanceof ArrayBuffer) {
    payload = input.slice(0);
    transferList.push(payload);
  } else if (ArrayBuffer.isView(input)) {
    payload = input.buffer.slice(
      input.byteOffset,
      input.byteOffset + input.byteLength
    ) as ArrayBuffer;
    transferList.push(payload);
  } else {
    payload = input as Blob;
  }
  const name = fileName ?? (input as File)?.name;
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      worker.removeEventListener("message", listener);
      worker.removeEventListener("error", failed);
      worker.removeEventListener("messageerror", failed);
    };
    const failed = (event: any) => {
      cleanup();
      reject(new Error(event?.message || "Excel import worker failed"));
    };
    const listener = (event: any) => {
      const data = event?.data as ParseExcelWorkerResponse;
      if (!data || data.id !== id) return;
      if (
        data.type !== "tinysheet:parseExcel:result" &&
        data.type !== "tinysheet:parseExcel:error"
      )
        return;
      cleanup();
      if (data.type === "tinysheet:parseExcel:error") {
        reject(new Error(data.error));
      } else if (data.json) {
        try {
          resolve(decodeExcelImportResult(data.json));
        } catch (error) {
          reject(error);
        }
      } else {
        try {
          resolve(bindSourceImport(data.result));
        } catch (error) {
          reject(error);
        }
      }
    };
    worker.addEventListener("message", listener);
    worker.addEventListener("error", failed);
    worker.addEventListener("messageerror", failed);
    const request: ParseExcelWorkerRequest = {
      type: "tinysheet:parseExcel",
      id,
      input: payload,
      fileName: name,
      options: parseOptions,
      transfer,
    };
    try {
      worker.postMessage(request, transferList);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
