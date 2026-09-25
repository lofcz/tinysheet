/* eslint-disable max-classes-per-file */
/**
 * Chunked row storage for large sheets.
 *
 * A sheet's cells are a matrix of rows (`sheet.data[r][c]`) kept in the
 * immutable (immer) context. Editing one cell of a plain matrix makes immer
 * copy, walk and freeze the whole outer array of rows: at a million rows every
 * edit costs hundreds of milliseconds. Sheets with at least
 * {@link getChunkedRowThreshold} rows therefore keep their rows in blocks of
 * {@link ROW_CHUNK_SIZE} under a hidden (non-enumerable, symbol-keyed) sheet
 * property, `sheet[ROW_CHUNKS]`: a list of chunks, each an array of rows. An
 * edit copies the list of chunks, one chunk and one row, which immer drafts
 * and patches natively.
 *
 * `sheet.data` stays the public face: a matrix view that indexes like a 2D
 * array (`data[r][c]`, `length`, iteration, the Array.prototype methods,
 * `JSON.stringify`) and is materialised lazily (`materializeMatrix`) where a
 * real array is needed. The view is not an array (`Array.isArray` is false)
 * and immer never drafts it:
 *
 * - Outside of a state update it reads the chunks it was made for, which are
 *   immutable: every committed state has its own view.
 * - Inside an update (`produceWithHistory`, undo/redo, see `runDataSession`)
 *   it resolves to the draft of its sheet's chunk list, so `data[r]` is an
 *   immer draft of the row and writes (`data[r][c] = v`, `data[r] = row`,
 *   `data.splice(...)`) behave exactly as they do on an immer draft of a plain
 *   matrix.
 * - After the update `reconcileChunkedSheets` gives every changed sheet a view
 *   of its new chunks (and converts large plain matrices that were assigned),
 *   and `publicDataPatches` rewrites the chunk patches to the public
 *   `["luckysheetfile", i, "data", r, c, ...]` paths used by undo/redo, the
 *   formula cache and `onOp`.
 */
import { isDraft, original } from "immer";
import type { Patch } from "immer";
import type { Cell, CellMatrix } from "../types";
import { peek } from "./dependencyGraph";

type Row = (Cell | null)[];
type Chunk = Row[];
type ChunkList = Chunk[];

export const ROW_CHUNK_BITS = 10;
/** Rows per chunk. */
export const ROW_CHUNK_SIZE = 1 << ROW_CHUNK_BITS;
const MASK = ROW_CHUNK_SIZE - 1;

/** Hidden sheet property holding the chunk list of a chunked sheet. */
export const ROW_CHUNKS: unique symbol = Symbol.for(
  "tinysheet.rowChunks"
) as any;
const MATRIX = Symbol.for("tinysheet.matrix");
/** `ROW_CHUNKS` as a patch path element. */
const CHUNK_KEY: any = ROW_CHUNKS;
/** Read by `peek` (dependencyGraph.ts): the draft-free view of a matrix. */
const PEEK_VIEW = Symbol.for("tinysheet.peekView");

function envThreshold() {
  try {
    // Node only (tests, benchmarks): no @types/node in a browser library
    const v = (
      globalThis as { process?: { env?: Record<string, string | undefined> } }
    ).process?.env?.TINYSHEET_CHUNK_ROWS;
    if (v != null && v !== "" && Number.isFinite(Number(v))) return Number(v);
  } catch (e) {
    // no process in the browser
  }
  return 8192;
}

let chunkedRowThreshold = envThreshold();

/** Sheets with at least this many rows use chunked storage. */
export function getChunkedRowThreshold() {
  return chunkedRowThreshold;
}

/** Tests and benchmarks: change the size at which sheets become chunked. */
export function setChunkedRowThreshold(rows: number) {
  chunkedRowThreshold = Math.max(0, rows);
}

class MatrixState {
  chunks: ChunkList;

  /** id of the sheet the view belongs to; undefined for a fresh matrix */
  sheetId: string | undefined;

  /** a view of committed chunks owned by a sheet (see viewFor) */
  adopted: boolean;

  view!: CellMatrix;

  peekView?: CellMatrix;

  materialized?: Row[];

  /** row count of `chunks` (immutable), computed once */
  length = -1;

  constructor(
    chunks: ChunkList,
    sheetId: string | undefined,
    adopted: boolean
  ) {
    this.chunks = chunks;
    this.sheetId = sheetId;
    this.adopted = adopted;
  }
}

class MatrixTarget {
  st: MatrixState;

  constructor(st: MatrixState) {
    this.st = st;
  }
}

/* ------------------------------------------------------------------------ */
/* Sessions: a state update in progress                                      */
/* ------------------------------------------------------------------------ */

type Entry = {
  /** the sheet holding the view (an immer draft, or a new plain object) */
  sheet: any;
  /** its chunk list: an immer draft, a plain list we own, or read-only */
  list: any;
  writable: boolean;
  /** `list` is a new plain array made by a structural change */
  owned: boolean;
};

export class DataSession {
  root: any;

  entries = new Map<MatrixState, Entry | null>();

  /** sheet id -> the view whose sheet's chunk list was drafted/replaced */
  truth = new Map<string, MatrixState>();

  constructor(root: any) {
    this.root = root;
  }
}

const sessions: DataSession[] = [];

function currentSession(): DataSession | undefined {
  return sessions.length > 0 ? sessions[sessions.length - 1] : undefined;
}

/**
 * Runs `fn` (a recipe working on the immer draft `draft` of a context) so
 * that matrix views resolve to the draft (see the module comment).
 */
export function runDataSession<T>(session: DataSession, fn: () => T): T {
  sessions.push(session);
  try {
    return fn();
  } finally {
    const i = sessions.lastIndexOf(session);
    if (i >= 0) sessions.splice(i, 1);
  }
}

function defineChunks(obj: any, list: ChunkList) {
  Object.defineProperty(obj, ROW_CHUNKS, {
    value: list,
    enumerable: false,
    writable: true,
    configurable: true,
  });
}

function entryFor(s: DataSession, st: MatrixState): Entry | null {
  if (!st.adopted) return null;
  const known = s.entries.get(st);
  if (known !== undefined) return known;
  let e: Entry | null = null;
  const files = s.root?.luckysheetfile;
  if (files) {
    const n = files.length;
    for (let i = 0; i < n; i += 1) {
      const sheet = files[i];
      if (sheet && sheet.data === st.view) {
        const cur = sheet[ROW_CHUNKS];
        const drafted = cur != null && isDraft(cur);
        if (drafted && original(cur) === st.chunks) {
          e = { sheet, list: cur, writable: true, owned: false };
          if (sheet.id != null) s.truth.set(sheet.id, st);
        } else {
          // the view was assigned in this update without its chunks: its
          // rows are read-only, as those of an assigned plain matrix are
          e = { sheet, list: st.chunks, writable: false, owned: false };
        }
        break;
      }
    }
  }
  s.entries.set(st, e);
  return e;
}

/* ------------------------------------------------------------------------ */
/* Reading                                                                   */
/* ------------------------------------------------------------------------ */

function listLength(list: any): number {
  const l = peek(list);
  const n = l.length;
  if (n === 0) return 0;
  return (n - 1) * ROW_CHUNK_SIZE + peek(l[n - 1]).length;
}

function committedLength(st: MatrixState) {
  if (st.length < 0) {
    const l = st.chunks;
    const n = l.length;
    st.length = n === 0 ? 0 : (n - 1) * ROW_CHUNK_SIZE + l[n - 1].length;
  }
  return st.length;
}

function lengthOf(st: MatrixState) {
  if (sessions.length > 0 && st.adopted) {
    const e = sessions[sessions.length - 1].entries.get(st);
    if (e) return listLength(e.list);
  }
  return committedLength(st);
}

function getRow(st: MatrixState, r: number): Row | undefined {
  if (sessions.length > 0 && st.adopted) {
    const e = entryFor(sessions[sessions.length - 1], st);
    if (e) {
      const chunk = e.list[r >> ROW_CHUNK_BITS];
      return chunk === undefined ? undefined : chunk[r & MASK];
    }
  }
  const chunk = st.chunks[r >> ROW_CHUNK_BITS];
  return chunk === undefined ? undefined : chunk[r & MASK];
}

/** Latest row without creating drafts (read-only). */
function peekRow(st: MatrixState, r: number): Row | undefined {
  const s = currentSession();
  let list: any = st.chunks;
  if (s && st.adopted) {
    const e = s.entries.get(st);
    if (e) list = e.list;
  }
  const chunk = peek(peek(list)[r >> ROW_CHUNK_BITS]);
  return chunk === undefined ? undefined : peek(chunk[r & MASK]);
}

/* ------------------------------------------------------------------------ */
/* Writing (inside a session only)                                           */
/* ------------------------------------------------------------------------ */

function modificationError(): never {
  throw new TypeError(
    "Cannot modify the cells of a committed sheet outside of a state update"
  );
}

function writableEntry(st: MatrixState): { s: DataSession; e: Entry } {
  const s = currentSession();
  const e = s ? entryFor(s, st) : null;
  if (!s || !e || !e.writable) modificationError();
  return { s, e };
}

function chunkRows(rows: Row[]): ChunkList {
  const list: ChunkList = [];
  for (let i = 0; i < rows.length; i += ROW_CHUNK_SIZE) {
    list.push(rows.slice(i, i + ROW_CHUNK_SIZE));
  }
  return list;
}

/** The latest rows of chunks [from, end) (drafts stay drafts). */
function latestRows(list: any, from: number): Row[] {
  const l = peek(list);
  const rows: Row[] = [];
  for (let ci = from; ci < l.length; ci += 1) {
    const chunk = peek(l[ci]);
    for (let ri = 0; ri < chunk.length; ri += 1) rows.push(chunk[ri]);
  }
  return rows;
}

function setList(s: DataSession, st: MatrixState, e: Entry, list: any[]) {
  if (isDraft(e.sheet)) {
    e.sheet[ROW_CHUNKS] = list;
  } else {
    defineChunks(e.sheet, list);
  }
  e.list = list;
  e.owned = true;
  e.writable = true;
  if (e.sheet.id != null) s.truth.set(e.sheet.id, st);
}

/**
 * Replaces rows [start, start + deleteCount) by `items` (Array#splice), by
 * giving the sheet a new chunk list: the chunks before `start` are kept, the
 * rest is re-chunked. Rows that already are drafts stay drafts; the others
 * (like rows moved in an immer draft of a plain array) are plain values.
 */
function spliceRows(
  st: MatrixState,
  start: number,
  deleteCount: number,
  items: Row[]
): Row[] {
  const { s, e } = writableEntry(st);
  const len = listLength(e.list);
  const from = Math.min(Math.max(start, 0), len);
  const del = Math.min(Math.max(deleteCount, 0), len - from);
  const firstChunk = from >> ROW_CHUNK_BITS;
  const tail = latestRows(e.list, firstChunk);
  const offset = from - (firstChunk << ROW_CHUNK_BITS);
  const removed = tail.slice(offset, offset + del);
  const rest = tail.slice(0, offset).concat(items, tail.slice(offset + del));
  const list = peek(e.list).slice(0, firstChunk).concat(chunkRows(rest));
  setList(s, st, e, list);
  return removed;
}

/** Replaces every row with `fn(rows)` (reverse, sort, fill, ...). */
function rewriteRows(st: MatrixState, fn: (rows: Row[]) => Row[] | void) {
  const { s, e } = writableEntry(st);
  const rows = latestRows(e.list, 0);
  const next = (fn(rows) as Row[] | undefined) ?? rows;
  setList(s, st, e, chunkRows(next));
}

function setRow(st: MatrixState, r: number, value: any): boolean {
  const s = currentSession();
  const e = s ? entryFor(s, st) : null;
  if (!s || !e || !e.writable) return false;
  const len = listLength(e.list);
  if (r < len) {
    const ci = r >> ROW_CHUNK_BITS;
    let chunk = e.list[ci];
    if (e.owned && !isDraft(chunk) && Object.isFrozen(chunk)) {
      // a committed chunk kept in a list made by a structural change
      chunk = chunk.slice();
      e.list[ci] = chunk;
    }
    chunk[r & MASK] = value;
    return true;
  }
  const pad: Row[] = new Array(r - len);
  pad.push(value);
  spliceRows(st, len, 0, pad);
  return true;
}

function setLength(st: MatrixState, n: number): boolean {
  if (!Number.isInteger(n) || n < 0)
    throw new RangeError("Invalid array length");
  const s = currentSession();
  const e = s ? entryFor(s, st) : null;
  if (!s || !e || !e.writable) return false;
  const len = listLength(e.list);
  if (n < len) spliceRows(st, n, len - n, []);
  else if (n > len) spliceRows(st, len, 0, new Array(n - len));
  return true;
}

/* ------------------------------------------------------------------------ */
/* The view                                                                  */
/* ------------------------------------------------------------------------ */

function stateOf(value: any): MatrixState {
  const st = value?.[MATRIX];
  if (!st) throw new TypeError("not a sheet matrix");
  return st;
}

function toIndex(p: string): number {
  // canonical array indexes only ("7", not "07" or "7.0")
  const v = +p;
  if (
    v >= 0 &&
    v <= 4294967294 &&
    Math.floor(v) === v &&
    (p.length === 1 || p.charCodeAt(0) !== 48) &&
    p.charCodeAt(p.length - 1) >= 48
  ) {
    return v;
  }
  return -1;
}

/** Latest rows as a real array (rows are shared, not copied). */
function snapshotRows(st: MatrixState): Row[] {
  const s = currentSession();
  if (!(s && st.adopted && s.entries.get(st))) {
    if (!st.materialized) {
      const rows: Row[] = [];
      for (let ci = 0; ci < st.chunks.length; ci += 1) {
        const chunk = st.chunks[ci];
        for (let ri = 0; ri < chunk.length; ri += 1) rows.push(chunk[ri]);
      }
      st.materialized = rows;
    }
    return st.materialized;
  }
  const n = lengthOf(st);
  const rows: Row[] = new Array(n);
  for (let r = 0; r < n; r += 1) rows[r] = peekRow(st, r) as Row;
  return rows;
}

// Read-only iteration methods, reading rows the way `view[r]` does (so
// callbacks get drafts inside an update, like on an immer draft).
const methods: Record<string, (...args: any[]) => any> = {
  forEach(this: any, fn: (row: Row, r: number, a: any) => void, thisArg?: any) {
    const st = stateOf(this);
    const n = lengthOf(st);
    for (let r = 0; r < n; r += 1) fn.call(thisArg, getRow(st, r)!, r, this);
  },
  map(this: any, fn: (row: Row, r: number, a: any) => any, thisArg?: any) {
    const st = stateOf(this);
    const n = lengthOf(st);
    const out = new Array(n);
    for (let r = 0; r < n; r += 1) {
      out[r] = fn.call(thisArg, getRow(st, r)!, r, this);
    }
    return out;
  },
  slice(this: any, begin?: number, end?: number) {
    const st = stateOf(this);
    const n = lengthOf(st);
    let a = begin == null ? 0 : Math.trunc(begin);
    let b = end == null ? n : Math.trunc(end);
    if (a < 0) a = Math.max(n + a, 0);
    if (b < 0) b = Math.max(n + b, 0);
    a = Math.min(a, n);
    b = Math.min(b, n);
    const out: Row[] = [];
    for (let r = a; r < b; r += 1) out.push(getRow(st, r)!);
    return out;
  },
  some(this: any, fn: (row: Row, r: number, a: any) => any, thisArg?: any) {
    const st = stateOf(this);
    const n = lengthOf(st);
    for (let r = 0; r < n; r += 1) {
      if (fn.call(thisArg, getRow(st, r)!, r, this)) return true;
    }
    return false;
  },
  every(this: any, fn: (row: Row, r: number, a: any) => any, thisArg?: any) {
    const st = stateOf(this);
    const n = lengthOf(st);
    for (let r = 0; r < n; r += 1) {
      if (!fn.call(thisArg, getRow(st, r)!, r, this)) return false;
    }
    return true;
  },
  findIndex(
    this: any,
    fn: (row: Row, r: number, a: any) => any,
    thisArg?: any
  ) {
    const st = stateOf(this);
    const n = lengthOf(st);
    for (let r = 0; r < n; r += 1) {
      if (fn.call(thisArg, getRow(st, r)!, r, this)) return r;
    }
    return -1;
  },
  toJSON(this: any) {
    return snapshotRows(stateOf(this));
  },
  // mutators: only inside a state update
  push(this: any, ...items: Row[]) {
    const st = stateOf(this);
    spliceRows(st, lengthOf(st), 0, items);
    return lengthOf(st);
  },
  pop(this: any) {
    const st = stateOf(this);
    const n = lengthOf(st);
    if (n === 0) {
      writableEntry(st);
      return undefined;
    }
    return spliceRows(st, n - 1, 1, [])[0];
  },
  shift(this: any) {
    const st = stateOf(this);
    if (lengthOf(st) === 0) {
      writableEntry(st);
      return undefined;
    }
    return spliceRows(st, 0, 1, [])[0];
  },
  unshift(this: any, ...items: Row[]) {
    const st = stateOf(this);
    spliceRows(st, 0, 0, items);
    return lengthOf(st);
  },
  splice(this: any, start?: number, deleteCount?: number, ...items: Row[]) {
    const st = stateOf(this);
    const n = lengthOf(st);
    if (start === undefined) {
      writableEntry(st);
      return [];
    }
    let a = Math.trunc(start) || 0;
    if (a < 0) a = Math.max(n + a, 0);
    a = Math.min(a, n);
    const del =
      arguments.length < 2
        ? n - a
        : Math.min(Math.max(Math.trunc(deleteCount as number) || 0, 0), n - a);
    return spliceRows(st, a, del, items);
  },
  reverse(this: any) {
    rewriteRows(stateOf(this), (rows) => {
      rows.reverse();
    });
    return this;
  },
  sort(this: any, cmp?: (a: Row, b: Row) => number) {
    rewriteRows(stateOf(this), (rows) => {
      rows.sort(cmp);
    });
    return this;
  },
  fill(this: any, value: Row, begin?: number, end?: number) {
    rewriteRows(stateOf(this), (rows) => {
      rows.fill(value, begin, end);
    });
    return this;
  },
  copyWithin(this: any, target: number, begin: number, end?: number) {
    rewriteRows(stateOf(this), (rows) => {
      rows.copyWithin(target, begin, end);
    });
    return this;
  },
};

function* iterateRows(this: any) {
  const st = stateOf(this);
  for (let r = 0; r < lengthOf(st); r += 1) yield getRow(st, r);
}

const viewHandler: ProxyHandler<MatrixTarget> = {
  get(t, prop) {
    const { st } = t;
    if (typeof prop === "string") {
      const c0 = prop.charCodeAt(0);
      if (c0 >= 48 && c0 <= 57) {
        const i = toIndex(prop);
        if (i >= 0) return getRow(st, i);
      }
      if (prop === "length") return lengthOf(st);
      if (Object.prototype.hasOwnProperty.call(methods, prop)) {
        return methods[prop];
      }
      if (prop === "constructor") return Array;
      return (Array.prototype as any)[prop];
    }
    if (prop === MATRIX) return st;
    // eslint-disable-next-line no-use-before-define
    if (prop === PEEK_VIEW) return peekViewOf(st);
    if (prop === Symbol.iterator) return iterateRows;
    if (prop === Symbol.isConcatSpreadable) return true;
    return undefined;
  },
  set(t, prop, value) {
    if (typeof prop === "string") {
      const i = toIndex(prop);
      if (i >= 0) return setRow(t.st, i, value);
      if (prop === "length") return setLength(t.st, value);
    }
    return false;
  },
  has(t, prop) {
    if (typeof prop === "string") {
      const i = toIndex(prop);
      if (i >= 0) return i < lengthOf(t.st);
      if (prop === "length") return true;
    }
    if (prop === MATRIX) return true;
    return prop in Array.prototype;
  },
  deleteProperty(t, prop) {
    if (typeof prop === "string") {
      const i = toIndex(prop);
      if (i >= 0) return i >= lengthOf(t.st) || setRow(t.st, i, undefined);
    }
    return false;
  },
  defineProperty(t, prop, desc) {
    if (typeof prop === "string" && "value" in desc) {
      const i = toIndex(prop);
      if (i >= 0) return setRow(t.st, i, desc.value);
      if (prop === "length") return setLength(t.st, desc.value);
    }
    return false;
  },
  ownKeys(t) {
    const n = lengthOf(t.st);
    const keys: string[] = new Array(n);
    for (let i = 0; i < n; i += 1) keys[i] = String(i);
    keys.push("length");
    return keys;
  },
  getOwnPropertyDescriptor(t, prop) {
    if (typeof prop === "string") {
      if (prop === "length") {
        return {
          value: lengthOf(t.st),
          writable: true,
          enumerable: false,
          configurable: true,
        };
      }
      const i = toIndex(prop);
      if (i >= 0 && i < lengthOf(t.st)) {
        return {
          value: getRow(t.st, i),
          writable: true,
          enumerable: true,
          configurable: true,
        };
      }
    }
    return undefined;
  },
  getPrototypeOf() {
    return Array.prototype;
  },
  setPrototypeOf() {
    return false;
  },
  preventExtensions() {
    return false;
  },
};

const peekHandler: ProxyHandler<MatrixTarget> = {
  get(t, prop) {
    const { st } = t;
    if (typeof prop === "string") {
      const c0 = prop.charCodeAt(0);
      if (c0 >= 48 && c0 <= 57) {
        const i = toIndex(prop);
        if (i >= 0) return peekRow(st, i);
      }
      if (prop === "length") return lengthOf(st);
      if (prop === "constructor") return Array;
      if (prop === "toJSON") return () => snapshotRows(st);
      return (Array.prototype as any)[prop];
    }
    if (prop === MATRIX) return st;
    // eslint-disable-next-line no-use-before-define
    if (prop === PEEK_VIEW) return peekViewOf(st);
    if (prop === Symbol.iterator) {
      return function* rows() {
        for (let r = 0; r < lengthOf(st); r += 1) yield peekRow(st, r);
      };
    }
    if (prop === Symbol.isConcatSpreadable) return true;
    return undefined;
  },
  set() {
    return false;
  },
  has(t, prop) {
    if (typeof prop === "string") {
      const i = toIndex(prop);
      if (i >= 0) return i < lengthOf(t.st);
      if (prop === "length") return true;
    }
    if (prop === MATRIX) return true;
    return prop in Array.prototype;
  },
  deleteProperty() {
    return false;
  },
  defineProperty() {
    return false;
  },
  ownKeys(t) {
    const n = lengthOf(t.st);
    const keys: string[] = new Array(n);
    for (let i = 0; i < n; i += 1) keys[i] = String(i);
    keys.push("length");
    return keys;
  },
  getOwnPropertyDescriptor(t, prop) {
    if (typeof prop === "string") {
      if (prop === "length") {
        return {
          value: lengthOf(t.st),
          writable: false,
          enumerable: false,
          configurable: true,
        };
      }
      const i = toIndex(prop);
      if (i >= 0 && i < lengthOf(t.st)) {
        return {
          value: peekRow(t.st, i),
          writable: false,
          enumerable: true,
          configurable: true,
        };
      }
    }
    return undefined;
  },
  getPrototypeOf() {
    return Array.prototype;
  },
  setPrototypeOf() {
    return false;
  },
  preventExtensions() {
    return false;
  },
};

function peekViewOf(st: MatrixState): CellMatrix {
  if (!st.peekView) {
    st.peekView = new Proxy(new MatrixTarget(st), peekHandler) as any;
  }
  return st.peekView!;
}

function makeState(
  chunks: ChunkList,
  sheetId: string | undefined,
  adopted: boolean
) {
  const st = new MatrixState(chunks, sheetId, adopted);
  st.view = new Proxy(new MatrixTarget(st), viewHandler) as any;
  return st;
}

/* ------------------------------------------------------------------------ */
/* Public helpers                                                            */
/* ------------------------------------------------------------------------ */

/** Whether `value` is a chunked matrix view. */
export function isChunkedMatrix(value: any): boolean {
  return value != null && typeof value === "object" && value[MATRIX] != null;
}

function freezeList(list: ChunkList) {
  for (let i = 0; i < list.length; i += 1) Object.freeze(list[i]);
  return Object.freeze(list) as ChunkList;
}

/**
 * A new (fresh) chunked matrix of `rows`, read-only like a frozen array
 * until it is stored in a sheet. The rows are used as they are (frozen rows
 * stay frozen).
 */
export function createChunkedMatrix(rows: Row[]): CellMatrix {
  return makeState(freezeList(chunkRows(rows)), undefined, false).view;
}

// one view per (chunk list, sheet)
const views = new WeakMap<ChunkList, Map<string, MatrixState>>();

function viewFor(list: ChunkList, sheetId: string | undefined): CellMatrix {
  let bySheet = views.get(list);
  if (!bySheet) {
    bySheet = new Map();
    views.set(list, bySheet);
  }
  const key = sheetId ?? "";
  let st = bySheet.get(key);
  if (!st) {
    st = makeState(list, sheetId, true);
    bySheet.set(key, st);
  }
  return st.view;
}

/**
 * The rows of a matrix as a real array: a chunked view is materialised (its
 * rows are shared, not copied; cached per committed version), a plain matrix
 * is returned as it is.
 */
export function materializeMatrix<T extends CellMatrix | null | undefined>(
  data: T
): T {
  if (!isChunkedMatrix(data)) return data;
  return snapshotRows(stateOf(data)) as any;
}

/**
 * Calls `fn(r)` for every row index whose row differs between two committed
 * matrices of the same size (rows compared by identity: rows are immutable).
 * For chunked matrices only the rows of changed chunks are looked at.
 * Returns false (without calling `fn`) when the matrices cannot be compared
 * that way; the caller then treats every row as changed.
 */
export function forEachChangedRow(
  prev: CellMatrix | null | undefined,
  next: CellMatrix | null | undefined,
  fn: (r: number) => void
): boolean {
  if (!prev || !next) return false;
  if (prev === next) return true;
  const a: MatrixState | undefined = (prev as any)[MATRIX];
  const b: MatrixState | undefined = (next as any)[MATRIX];
  if (a && b) {
    const la = a.chunks;
    const lb = b.chunks;
    if (la.length !== lb.length || committedLength(a) !== committedLength(b)) {
      return false;
    }
    for (let ci = 0; ci < la.length; ci += 1) {
      const ca = la[ci];
      const cb = lb[ci];
      if (ca !== cb) {
        const base = ci << ROW_CHUNK_BITS;
        for (let ri = 0; ri < cb.length; ri += 1) {
          if (ca[ri] !== cb[ri]) fn(base + ri);
        }
      }
    }
    return true;
  }
  if (a || b || !Array.isArray(prev) || !Array.isArray(next)) return false;
  if (prev.length !== next.length) return false;
  for (let r = 0; r < next.length; r += 1) {
    if (prev[r] !== next[r]) fn(r);
  }
  return true;
}

/**
 * A view of the committed rows of a matrix, which does not follow the
 * update in progress (compare the state before an update with the draft).
 */
export function committedMatrix<T extends CellMatrix | null | undefined>(
  data: T
): T {
  if (!isChunkedMatrix(data)) return data;
  const st = stateOf(data);
  return makeState(st.chunks, st.sheetId, false).view as any;
}

/**
 * Like lodash `cloneDeep`, but chunked matrices (sheet `data`) become plain
 * 2D arrays, and a sheet's hidden chunk list is not copied.
 */
export function cloneWithMatrices<T>(
  value: T,
  cloneDeepWith: (v: any, customizer: (x: any) => any) => any
): T {
  const customizer = (x: any): any => {
    if (isChunkedMatrix(x)) {
      const rows = materializeMatrix(x) as CellMatrix;
      return rows.map((row) => cloneDeepWith(row, customizer));
    }
    return undefined;
  };
  return cloneDeepWith(value, customizer);
}

/* ------------------------------------------------------------------------ */
/* After an update                                                           */
/* ------------------------------------------------------------------------ */

function withChunks(sheet: any, view: CellMatrix, list: ChunkList | null) {
  const copy: any = { ...sheet, data: view };
  delete copy[ROW_CHUNKS];
  if (list) defineChunks(copy, list);
  return Object.freeze(copy);
}

function fixSheet(sheet: any, base: any, session?: DataSession) {
  const { data } = sheet;
  const has = Object.prototype.hasOwnProperty.call(sheet, ROW_CHUNKS);
  const chunks: ChunkList | undefined = has ? sheet[ROW_CHUNKS] : undefined;
  const enumerable =
    has && Object.prototype.propertyIsEnumerable.call(sheet, ROW_CHUNKS);
  const st: MatrixState | undefined = isChunkedMatrix(data)
    ? data[MATRIX]
    : undefined;
  if (st) {
    let list: ChunkList;
    if (chunks && session?.truth.get(sheet.id) === st) list = chunks;
    else if (!st.adopted) list = st.chunks;
    else if (!base || base.data !== data) list = st.chunks;
    else list = chunks ?? st.chunks;
    Object.freeze(list);
    const view = viewFor(list, sheet.id);
    if (view === data && chunks === list && !enumerable) return sheet;
    return withChunks(sheet, view, list);
  }
  if (Array.isArray(data) && data.length >= chunkedRowThreshold) {
    const list = freezeList(chunkRows(data as Row[]));
    return withChunks(sheet, viewFor(list, sheet.id), list);
  }
  if (has) return withChunks(sheet, data, null);
  return sheet;
}

/**
 * After an update of `base` into `result`: gives every changed sheet whose
 * cells are chunked a view of its current chunks, and chunks large plain
 * matrices. Returns `result` itself when nothing needed fixing.
 */
export function reconcileChunkedSheets<C extends { luckysheetfile: any[] }>(
  base: C | null | undefined,
  result: C,
  session?: DataSession
): C {
  const files = result?.luckysheetfile;
  if (!Array.isArray(files)) return result;
  const baseFiles = base?.luckysheetfile;
  if (files === baseFiles) return result;
  let byId: Map<string, any> | null = null;
  const baseSheet = (i: number, id: string) => {
    const b = baseFiles?.[i];
    if (!b || b.id === id) return b;
    if (!byId) {
      const m = new Map<string, any>();
      (baseFiles ?? []).forEach((s: any) => s && m.set(s.id, s));
      byId = m;
    }
    return byId.get(id);
  };
  let out: any[] | null = null;
  for (let i = 0; i < files.length; i += 1) {
    const sheet = files[i];
    if (sheet && typeof sheet === "object" && sheet !== baseFiles?.[i]) {
      const b = baseSheet(i, sheet.id);
      const fixed = fixSheet(sheet, b, session);
      if (fixed !== sheet) {
        if (!out) out = files.slice();
        out[i] = fixed;
      }
    }
  }
  if (!out) return result;
  const next: any = { ...result, luckysheetfile: Object.freeze(out) };
  return Object.isFrozen(result) ? Object.freeze(next) : next;
}

function needsFix(sheet: any) {
  const { data } = sheet;
  const st: MatrixState | undefined = data?.[MATRIX];
  if (st) {
    return (
      !st.adopted ||
      st.sheetId !== sheet.id ||
      !Object.prototype.hasOwnProperty.call(sheet, ROW_CHUNKS) ||
      sheet[ROW_CHUNKS] !== st.chunks
    );
  }
  if (Object.prototype.hasOwnProperty.call(sheet, ROW_CHUNKS)) return true;
  return Array.isArray(data) && data.length >= chunkedRowThreshold;
}

/**
 * Before an update: makes sure every sheet of `ctx` is in the form updates
 * expect (large matrices chunked, fresh matrices stored with their chunks).
 * Contexts produced by updates always are; this catches ones assembled by
 * hand. Returns `ctx` itself when nothing needed fixing.
 */
export function prepareChunkedSheets<C extends { luckysheetfile: any[] }>(
  ctx: C
): C {
  const files = ctx?.luckysheetfile;
  if (!Array.isArray(files)) return ctx;
  let out: any[] | null = null;
  for (let i = 0; i < files.length; i += 1) {
    const sheet = files[i];
    if (sheet && typeof sheet === "object" && needsFix(sheet)) {
      const fixed = fixSheet(sheet, sheet);
      if (fixed !== sheet) {
        if (!out) out = files.slice();
        out[i] = fixed;
      }
    }
  }
  if (!out) return ctx;
  const next: any = { ...ctx, luckysheetfile: Object.freeze(out) };
  return Object.isFrozen(ctx) ? Object.freeze(next) : next;
}

function isRowIndex(key: unknown) {
  return typeof key === "number";
}

/**
 * Rewrites the patches of an update to public paths: chunk patches
 * (`[..., ROW_CHUNKS, chunk, row, ...]`) become `[..., "data", r, ...]`, and a
 * sheet whose rows were replaced or moved gets a single
 * `["luckysheetfile", i, "data"]` patch with its matrix before (inverse) or
 * after (forward) the update.
 */
export function publicDataPatches(
  patches: Patch[],
  base: { luckysheetfile: any[] },
  result: { luckysheetfile: any[] },
  forward: boolean
): Patch[] {
  let relevant = false;
  for (let i = 0; i < patches.length; i += 1) {
    const { path } = patches[i];
    if (
      path[0] === "luckysheetfile" &&
      (path[2] === CHUNK_KEY || (path[2] === "data" && path.length === 3))
    ) {
      relevant = true;
      break;
    }
  }
  if (!relevant) return patches;
  const whole = new Set<number>();
  patches.forEach(({ path }) => {
    if (path[0] !== "luckysheetfile" || typeof path[1] !== "number") return;
    if (path[2] === CHUNK_KEY) {
      if (path.length < 5 || !isRowIndex(path[4])) whole.add(path[1]);
    } else if (path[2] === "data" && path.length === 3) {
      whole.add(path[1]);
    }
  });
  const out: Patch[] = [];
  patches.forEach((p) => {
    const { path } = p;
    if (path[0] === "luckysheetfile" && typeof path[1] === "number") {
      if (whole.has(path[1]) && (path[2] === "data" || path[2] === CHUNK_KEY)) {
        return;
      }
      if (path[2] === CHUNK_KEY) {
        const r = ((path[3] as number) << ROW_CHUNK_BITS) + (path[4] as number);
        out.push({
          ...p,
          path: ["luckysheetfile", path[1], "data", r, ...path.slice(5)],
        });
        return;
      }
    }
    out.push(p);
  });
  const source = forward ? result : base;
  whole.forEach((i) => {
    out.push({
      op: "replace",
      path: ["luckysheetfile", i, "data"],
      value: source?.luckysheetfile?.[i]?.data,
    });
  });
  return out;
}
