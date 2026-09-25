/**
 * Off-main-thread import: run `parseExcel` in a Web Worker and hand the
 * result back as one transferable buffer.
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
 * The parsed workbook is sent as UTF-8 JSON in an ArrayBuffer that is
 * transferred, not copied (structured-cloning a million cell objects costs
 * about as much as parsing them); the main thread only runs JSON.parse.
 * Pass `transfer: "clone"` to post the result object instead. One worker
 * can serve any number of concurrent requests.
 */
import { parseExcel, ParseExcelOptions } from "./parseExcel";
import type { ExcelImportResult } from "./types";

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
  postMessage(message: any, transfer?: Transferable[]): void;
};

/** An import result as one UTF-8 JSON buffer (for transferring). */
export function encodeExcelImportResult(
  result: ExcelImportResult
): ArrayBuffer {
  const bytes = new TextEncoder().encode(JSON.stringify(result));
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
  return JSON.parse(new TextDecoder().decode(buffer));
}

/** Answer one parse request (what the worker runs for each message). */
export async function handleParseExcelRequest(
  request: ParseExcelWorkerRequest
): Promise<{ response: ParseExcelWorkerResponse; transfer: Transferable[] }> {
  try {
    const result = await parseExcel(
      request.input,
      request.fileName,
      request.options
    );
    if (request.transfer === "clone") {
      return {
        response: {
          type: "tinysheet:parseExcel:result",
          id: request.id,
          result,
        },
        transfer: [],
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

type WorkerLike = MessageScope & {
  removeEventListener(type: "message", listener: (event: any) => void): void;
};

let nextRequestId = 1;

export type ParseExcelInWorkerOptions = ParseExcelOptions & {
  /** How the result comes back (default "json": one transferred buffer). */
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
  const transferList: Transferable[] = [];
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
    const listener = (event: any) => {
      const data = event?.data as ParseExcelWorkerResponse;
      if (!data || data.id !== id) return;
      if (
        data.type !== "tinysheet:parseExcel:result" &&
        data.type !== "tinysheet:parseExcel:error"
      )
        return;
      worker.removeEventListener("message", listener);
      if (data.type === "tinysheet:parseExcel:error") {
        reject(new Error(data.error));
      } else if (data.json) {
        resolve(decodeExcelImportResult(data.json));
      } else {
        resolve(data.result);
      }
    };
    worker.addEventListener("message", listener);
    const request: ParseExcelWorkerRequest = {
      type: "tinysheet:parseExcel",
      id,
      input: payload,
      fileName: name,
      options: parseOptions,
      transfer,
    };
    worker.postMessage(request, transferList);
  });
}
