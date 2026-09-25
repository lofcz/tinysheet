/**
 * Flash Fill (Data › Flash Fill, Ctrl+E).
 *
 * From one or more examples typed next to the source columns, learn a
 * program that builds the example text out of pieces of the sources and
 * fill the rest of the column with it.
 *
 * A program is a concatenation of segments. Each segment is a constant or a
 * piece of one source value:
 *
 * - the whole value, a token (word, letters, digits, letters+digits,
 *   capitalised word, or a field between delimiters such as "," "@" "."),
 *   counted from the start or from the end, a run of tokens, the first
 *   letters of a token (initials);
 * - characters at fixed positions, or of the value's digits only (phone
 *   numbers);
 * - a number or date value in another number format (dates typed as text
 *   are recognised too);
 *
 * each optionally upper-, lower- or proper-cased.
 *
 * Learning builds, for the first example, every way the example text can be
 * cut into such pieces, then runs a cheapest-first search over all the
 * examples at once, so the program found reproduces every example. Costs
 * prefer few, simple segments; constants are expensive unless they are
 * punctuation, so pieces of the sources win over typed text.
 */
import { Context, getFlowdata } from "../context";
import type { Cell, CellMatrix } from "../types";
import { update } from "./format";
import { parseInput } from "./inputParse";
import { jfrefreshgrid } from "./refresh";
import { getSortRegion } from "./sort";
import { registerShortcut } from "./extensions";

export type FlashFillSource = {
  /** The value as displayed. */
  text: string;
  /** The numeric value (numbers, dates as serials), if any. */
  num?: number;
  /** The value is a date / time. */
  isDate?: boolean;
};

export type FlashFillExample = {
  inputs: FlashFillSource[];
  output: string;
};

type CaseMode = "none" | "upper" | "lower" | "proper";

type TokenClass =
  | "word"
  | "alpha"
  | "digit"
  | "alnum"
  | "cap"
  | `sep:${string}`;

type Pos = { from: "s" | "e"; n: number };

type Atom =
  | { k: "const"; s: string }
  | { k: "whole"; col: number; cs: CaseMode }
  | { k: "tok"; col: number; cls: TokenClass; i: number; cs: CaseMode }
  | {
      k: "span";
      col: number;
      cls: TokenClass;
      i: number;
      j: number;
      cs: CaseMode;
    }
  | {
      k: "pre";
      col: number;
      cls: TokenClass;
      i: number;
      n: number;
      cs: CaseMode;
    }
  | { k: "slice"; col: number; a: Pos; b: Pos; cs: CaseMode }
  | { k: "digits"; col: number; a: Pos; b: Pos }
  | { k: "fmt"; col: number; code: string; cs: CaseMode };

export type FlashFillProgram = { segments: Atom[] };

const DELIMITERS = [
  ",",
  ";",
  "@",
  ".",
  "-",
  "/",
  "_",
  "|",
  ":",
  "\t",
  "(",
  ")",
];

const DATE_CODES = [
  "yyyy",
  "yy",
  "m",
  "mm",
  "mmm",
  "mmmm",
  "d",
  "dd",
  "ddd",
  "dddd",
  "m/d/yyyy",
  "mm/dd/yyyy",
  "d/m/yyyy",
  "dd/mm/yyyy",
  "yyyy-mm-dd",
  "yyyy/mm/dd",
  "dd.mm.yyyy",
  "d.m.yyyy",
  "d mmm yyyy",
  "d mmmm yyyy",
  "mmm d, yyyy",
  "mmmm d, yyyy",
  "mmm yyyy",
  "mmmm yyyy",
  "yyyymmdd",
  "h:mm",
  "hh:mm",
  "h:mm AM/PM",
];

const NUMBER_CODES = [
  "0",
  "0.0",
  "0.00",
  "0.000",
  "#,##0",
  "#,##0.00",
  "$#,##0",
  "$#,##0.00",
  "0%",
  "0.0%",
  "0.00%",
];

/* ------------------------------------------------------------------ */
/* Evaluation                                                          */
/* ------------------------------------------------------------------ */

type Token = { s: string; start: number; end: number };

const TOKEN_RES: Record<string, RegExp> = {
  word: /\S+/gu,
  alpha: /\p{L}+/gu,
  digit: /\p{N}+/gu,
  alnum: /[\p{L}\p{N}]+/gu,
  cap: /\p{Lu}[\p{Ll}\p{N}]*|\p{Ll}+|\p{N}+/gu,
};

function tokenize(text: string, cls: TokenClass): Token[] {
  if (cls.startsWith("sep:")) {
    const sep = cls.slice(4);
    const out: Token[] = [];
    let start = 0;
    const parts = text.split(sep);
    parts.forEach((part) => {
      // trim the field, keep its position
      const lead = part.length - part.trimStart().length;
      const trimmed = part.trim();
      out.push({
        s: trimmed,
        start: start + lead,
        end: start + lead + trimmed.length,
      });
      start += part.length + sep.length;
    });
    return parts.length > 1 ? out : [];
  }
  const re = new RegExp(TOKEN_RES[cls].source, "gu");
  const out: Token[] = [];
  let m = re.exec(text);
  while (m) {
    out.push({ s: m[0], start: m.index, end: m.index + m[0].length });
    m = re.exec(text);
  }
  return out;
}

function applyCase(s: string, cs: CaseMode) {
  if (cs === "upper") return s.toUpperCase();
  if (cs === "lower") return s.toLowerCase();
  if (cs === "proper") {
    return s
      .toLowerCase()
      .replace(/(^|[^\p{L}'])(\p{L})/gu, (_m, a, b) => a + b.toUpperCase());
  }
  return s;
}

function at<T>(list: T[], i: number): T | undefined {
  return i >= 0 ? list[i] : list[list.length + i];
}

function posOf(p: Pos, len: number) {
  return p.from === "s" ? p.n : len - p.n;
}

function digitsOf(text: string) {
  return text.replace(/\D+/g, "");
}

type EvalCache = Map<string, Token[]>;

function tokensCached(
  cache: EvalCache,
  col: number,
  text: string,
  cls: TokenClass
) {
  const key = `${col}\u0000${cls}`;
  let toks = cache.get(key);
  if (!toks) {
    toks = tokenize(text, cls);
    cache.set(key, toks);
  }
  return toks;
}

function evalAtom(
  atom: Atom,
  inputs: FlashFillSource[],
  cache: EvalCache
): string | null {
  if (atom.k === "const") return atom.s;
  const src = inputs[atom.col];
  if (!src) return null;
  const { text } = src;
  let out: string | null = null;
  switch (atom.k) {
    case "whole":
      out = text;
      break;
    case "tok": {
      out =
        at(tokensCached(cache, atom.col, text, atom.cls), atom.i)?.s ?? null;
      break;
    }
    case "span": {
      const toks = tokensCached(cache, atom.col, text, atom.cls);
      const a = at(toks, atom.i);
      const b = at(toks, atom.j);
      out = a && b && a.start < b.end ? text.slice(a.start, b.end) : null;
      break;
    }
    case "pre": {
      const tok = at(tokensCached(cache, atom.col, text, atom.cls), atom.i);
      out = tok && tok.s.length >= atom.n ? tok.s.slice(0, atom.n) : null;
      break;
    }
    case "slice":
    case "digits": {
      const base = atom.k === "digits" ? digitsOf(text) : text;
      const a = posOf(atom.a, base.length);
      const b = posOf(atom.b, base.length);
      out = a >= 0 && b <= base.length && a < b ? base.slice(a, b) : null;
      break;
    }
    case "fmt": {
      if (src.num == null || !Number.isFinite(src.num)) return null;
      if (/[dmy]/i.test(atom.code) && !/[#0]/.test(atom.code) && !src.isDate) {
        return null;
      }
      const s = update(atom.code, src.num);
      out = s == null ? null : `${s}`;
      break;
    }
    default:
      out = null;
  }
  if (out == null || out === "") return null;
  return "cs" in atom ? applyCase(out, atom.cs) : out;
}

/** Run a learned program on one row; null when a piece is missing. */
export function runFlashFill(
  program: FlashFillProgram,
  inputs: FlashFillSource[]
): string | null {
  const cache: EvalCache = new Map();
  let out = "";
  for (let i = 0; i < program.segments.length; i += 1) {
    const s = evalAtom(program.segments[i], inputs, cache);
    if (s == null) return null;
    out += s;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Learning                                                            */
/* ------------------------------------------------------------------ */

type Desc = { atom: Atom; cost: number };

const CASES: CaseMode[] = ["none", "upper", "lower", "proper"];

const CLASS_COST: Record<string, number> = {
  word: 0,
  alpha: 0.2,
  digit: 0.2,
  alnum: 0.3,
  cap: 0.6,
};

function classCost(cls: TokenClass) {
  return cls.startsWith("sep:") ? 0.1 : (CLASS_COST[cls] ?? 0.5);
}

function constCost(s: string) {
  const alnum = (s.match(/[\p{L}\p{N}]/gu) || []).length;
  // punctuation and spaces between pieces are cheap, typed words are not
  if (alnum === 0) return 1 + 0.3 * s.length;
  return 2 + 5 * alnum + 0.3 * (s.length - alnum);
}

/**
 * Every piece of the first example's sources, with the string it yields
 * (before the case transform) and its base cost.
 */
function enumeratePieces(inputs: FlashFillSource[]) {
  const pieces: { s: string; make: (cs: CaseMode) => Atom; cost: number }[] =
    [];
  const add = (s: string, make: (cs: CaseMode) => Atom, cost: number) => {
    if (s) pieces.push({ s, make, cost });
  };
  inputs.forEach((src, col) => {
    const { text } = src;
    if (!text) return;
    add(text, (cs) => ({ k: "whole", col, cs }), 1);
    const classes: TokenClass[] = ["word", "alpha", "digit", "alnum", "cap"];
    DELIMITERS.forEach((d) => {
      if (text.includes(d)) classes.push(`sep:${d}`);
    });
    classes.forEach((cls) => {
      const toks = tokenize(text, cls);
      const n = toks.length;
      if (n === 0) return;
      const cc = classCost(cls);
      toks.forEach((tok, i) => {
        const last = n > 1 && i === n - 1;
        const fromStart = 2 + cc + (last ? 0.3 : 0) + i * 0.05;
        const fromEnd = 2 + cc + (last ? 0 : 0.5) + (n - 1 - i) * 0.05;
        add(tok.s, (cs) => ({ k: "tok", col, cls, i, cs }), fromStart);
        add(tok.s, (cs) => ({ k: "tok", col, cls, i: i - n, cs }), fromEnd);
        for (let len = 1; len <= Math.min(3, tok.s.length - 1); len += 1) {
          const pre = tok.s.slice(0, len);
          const base = len === 1 ? 2.5 : 4;
          add(
            pre,
            (cs) => ({ k: "pre", col, cls, i, n: len, cs }),
            base + cc + (last ? 0.3 : 0)
          );
          add(
            pre,
            (cs) => ({ k: "pre", col, cls, i: i - n, n: len, cs }),
            base + cc + (last ? 0 : 0.5)
          );
        }
        for (let j = i + 1; j < n; j += 1) {
          const s = text.slice(tok.start, toks[j].end);
          add(s, (cs) => ({ k: "span", col, cls, i, j, cs }), 3 + cc);
          add(
            s,
            (cs) => ({ k: "span", col, cls, i: i - n, j: j - n, cs }),
            3.5 + cc
          );
          add(s, (cs) => ({ k: "span", col, cls, i, j: j - n, cs }), 3.2 + cc);
        }
      });
    });
    // fixed positions (short values only)
    const slices = (base: string, digits: boolean) => {
      const len = base.length;
      if (len === 0 || len > 60) return;
      for (let a = 0; a < len; a += 1) {
        for (let b = a + 1; b <= len; b += 1) {
          const s = base.slice(a, b);
          const variants: [Pos, Pos, number][] = [
            [{ from: "s", n: a }, { from: "s", n: b }, 0],
            [{ from: "e", n: len - a }, { from: "e", n: len - b }, 0.5],
            [{ from: "s", n: a }, { from: "e", n: len - b }, 0.3],
          ];
          variants.forEach(([pa, pb, extra]) => {
            if (digits) {
              add(
                s,
                () => ({ k: "digits", col, a: pa, b: pb }),
                4 + extra + 0.1 * s.length
              );
            } else {
              // long fixed slices usually cut across meaningful pieces
              add(
                s,
                (cs) => ({ k: "slice", col, a: pa, b: pb, cs }),
                6 + extra + 0.5 * s.length
              );
            }
          });
        }
      }
    };
    slices(text, false);
    const digits = digitsOf(text);
    if (digits && digits !== text) slices(digits, true);
    // number / date formats
    if (src.num != null && Number.isFinite(src.num)) {
      const codes = src.isDate ? DATE_CODES : NUMBER_CODES;
      codes.forEach((code) => {
        const s = update(code, src.num);
        if (s != null) add(`${s}`, (cs) => ({ k: "fmt", col, code, cs }), 2);
      });
    }
  });
  return pieces;
}

/** Edges of the first example: (start, end) -> descriptions, cheapest first. */
function buildEdges(example: FlashFillExample) {
  const out = example.output;
  const L = out.length;
  const edges: Map<number, { end: number; descs: Desc[] }[]> = new Map();
  const bucket = new Map<string, Desc[]>();
  const push = (i: number, j: number, desc: Desc) => {
    const key = `${i}_${j}`;
    let list = bucket.get(key);
    if (!list) {
      list = [];
      bucket.set(key, list);
    }
    list.push(desc);
  };
  enumeratePieces(example.inputs).forEach((piece) => {
    const seen = new Set<string>();
    CASES.forEach((cs) => {
      const s = applyCase(piece.s, cs);
      if (!s || seen.has(s)) return;
      seen.add(s);
      const cost = piece.cost + (cs === "none" ? 0 : 0.5);
      let from = out.indexOf(s);
      while (from >= 0) {
        push(from, from + s.length, { atom: piece.make(cs), cost });
        from = out.indexOf(s, from + 1);
      }
    });
  });
  for (let i = 0; i < L; i += 1) {
    for (let j = i + 1; j <= Math.min(L, i + 40); j += 1) {
      const s = out.slice(i, j);
      push(i, j, { atom: { k: "const", s }, cost: constCost(s) });
    }
  }
  bucket.forEach((descs, key) => {
    const [i, j] = key.split("_").map(Number);
    descs.sort((a, b) => a.cost - b.cost);
    // keep the cheapest few per distinct kind: enough to disambiguate
    const list = edges.get(i) ?? [];
    list.push({ end: j, descs: descs.slice(0, 80) });
    edges.set(i, list);
  });
  return edges;
}

type State = {
  pos: number[];
  cost: number;
  segments: Atom[];
  hasVar: boolean;
};

class Heap {
  items: State[] = [];

  push(s: State) {
    const a = this.items;
    a.push(s);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].cost <= a[i].cost) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }

  pop(): State | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].cost < a[m].cost) m = l;
        if (r < a.length && a[r].cost < a[m].cost) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }

  get size() {
    return this.items.length;
  }
}

const SEGMENT_COST = 1;

/**
 * Learn a program reproducing every example, or null when none is found.
 */
export function learnFlashFill(
  examples: FlashFillExample[]
): FlashFillProgram | null {
  const exs = examples.filter((e) => e.output !== "");
  if (exs.length === 0) return null;
  const edges = buildEdges(exs[0]);
  const lengths = exs.map((e) => e.output.length);
  const caches = exs.map(() => new Map() as EvalCache);
  const heap = new Heap();
  const done = new Set<string>();
  heap.push({ pos: exs.map(() => 0), cost: 0, segments: [], hasVar: false });
  let expanded = 0;
  while (heap.size > 0 && expanded < 200000) {
    const state = heap.pop()!;
    const key = `${state.pos.join(",")}|${state.hasVar ? 1 : 0}`;
    if (done.has(key)) continue;
    done.add(key);
    expanded += 1;
    if (state.pos.every((p, k) => p === lengths[k])) {
      if (state.hasVar) return { segments: state.segments };
      continue;
    }
    const outgoing = edges.get(state.pos[0]) ?? [];
    for (let e = 0; e < outgoing.length; e += 1) {
      const edge = outgoing[e];
      // distinct successor states of this edge, the cheapest description each
      const seenNext = new Set<string>();
      for (let d = 0; d < edge.descs.length; d += 1) {
        const desc = edge.descs[d];
        const next = [edge.end];
        let ok = true;
        for (let k = 1; k < exs.length && ok; k += 1) {
          const s = evalAtom(desc.atom, exs[k].inputs, caches[k]);
          if (s == null || !exs[k].output.startsWith(s, state.pos[k])) {
            ok = false;
          } else {
            next.push(state.pos[k] + s.length);
          }
        }
        if (!ok) continue;
        const hasVar = state.hasVar || desc.atom.k !== "const";
        const nkey = `${next.join(",")}|${hasVar ? 1 : 0}`;
        if (seenNext.has(nkey) || done.has(nkey)) continue;
        seenNext.add(nkey);
        heap.push({
          pos: next,
          cost: state.cost + desc.cost + SEGMENT_COST,
          segments: [...state.segments, desc.atom],
          hasVar,
        });
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Sheet integration                                                   */
/* ------------------------------------------------------------------ */

function cellString(cell: Cell | null | undefined): string {
  if (cell == null) return "";
  if (cell.ct?.t === "inlineStr") {
    return (cell.ct.s || []).map((s: any) => s?.v ?? "").join("");
  }
  const shown = cell.m ?? cell.v;
  return shown == null ? "" : `${shown}`;
}

/** A cell as a Flash Fill source (display text plus number / date value). */
export function flashFillSource(
  cell: Cell | null | undefined
): FlashFillSource {
  const text = cellString(cell);
  if (!cell || text === "") return { text };
  if (typeof cell.v === "number") {
    return { text, num: cell.v, isDate: cell.ct?.t === "d" };
  }
  if (typeof cell.v === "string" && cell.v.trim() !== "") {
    try {
      const parsed = parseInput(cell.v.trim());
      if (parsed.type === "date") {
        return { text, num: Number(parsed.v), isDate: true };
      }
      if (parsed.type === "number") return { text, num: Number(parsed.v) };
    } catch {
      // not a number
    }
  }
  return { text };
}

export type FlashFillResult = {
  /** Cells filled. */
  filled: number;
  /** The filled range (rows of the target column), if any. */
  range?: { row: [number, number]; column: [number, number] };
  error?: "noPattern" | "noData" | "readOnly";
};

/**
 * Flash Fill the column of the active cell: examples are the non-empty
 * cells of that column inside the current region, sources the region's
 * other columns. Fills the empty cells of the column (only the selected
 * ones when several cells of the column are selected).
 */
export function flashFill(ctx: Context): FlashFillResult {
  if (ctx.allowEdit === false) return { filled: 0, error: "readOnly" };
  const data = getFlowdata(ctx);
  const sel =
    ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
  if (!data || !sel) return { filled: 0, error: "noData" };
  const r0 = sel.row_focus ?? sel.row[0];
  const target = sel.column_focus ?? sel.column[0];
  const region = getSortRegion(data, r0, target);
  let [c1, c2] = region.column;
  const [r1, r2] = region.row;
  // the target column may border the data without being part of it yet
  if (target < c1) c1 = target;
  if (target > c2) c2 = target;
  const sources: number[] = [];
  for (let c = c1; c <= c2; c += 1) if (c !== target) sources.push(c);
  if (sources.length === 0) return { filled: 0, error: "noData" };

  const inputsOf = (r: number) =>
    sources.map((c) => flashFillSource(data[r]?.[c]));
  const hasSource = (r: number) =>
    sources.some((c) => cellString(data[r]?.[c]) !== "");

  const exampleRows: number[] = [];
  const blankRows: number[] = [];
  const selectedRows =
    sel.row[1] > sel.row[0] && sel.column[0] === sel.column[1] ? sel.row : null;
  for (let r = r1; r <= r2; r += 1) {
    if (ctx.config?.rowhidden?.[r] != null) continue;
    const out = cellString(data[r]?.[target]);
    if (out !== "") exampleRows.push(r);
    else if (
      hasSource(r) &&
      (!selectedRows || (r >= selectedRows[0] && r <= selectedRows[1]))
    ) {
      blankRows.push(r);
    }
  }
  if (exampleRows.length === 0 || blankRows.length === 0) {
    return {
      filled: 0,
      error: exampleRows.length === 0 ? "noPattern" : "noData",
    };
  }
  const exampleOf = (r: number): FlashFillExample => ({
    inputs: inputsOf(r),
    output: cellString(data[r]?.[target]),
  });
  let program = learnFlashFill(exampleRows.map(exampleOf));
  // a header row is not an example
  if (!program && exampleRows.length > 1 && exampleRows[0] === r1) {
    program = learnFlashFill(exampleRows.slice(1).map(exampleOf));
  }
  if (!program) return { filled: 0, error: "noPattern" };

  let filled = 0;
  let first = -1;
  let last = -1;
  blankRows.forEach((r) => {
    // like Excel, fill below the first example (rows above it are headers)
    if (!selectedRows && r < exampleRows[0]) return;
    const value = runFlashFill(program!, inputsOf(r));
    if (value == null) return;
    const prev = data[r][target];
    const cell: Cell = prev ? { ...prev } : {};
    delete cell.f;
    cell.v = value;
    cell.m = value;
    cell.ct = { fa: cell.ct?.fa === "@" ? "@" : "General", t: "s" };
    data[r][target] = cell;
    filled += 1;
    if (first < 0) first = r;
    last = r;
  });
  if (filled === 0) return { filled: 0, error: "noPattern" };
  const range = {
    row: [first, last] as [number, number],
    column: [target, target] as [number, number],
  };
  jfrefreshgrid(ctx, data as CellMatrix, [range]);
  return { filled, range };
}

/**
 * Data › Flash Fill / Ctrl+E: fill, then leave the result for the UI
 * (\`ctx.cellToolsNotice\`: cells changed, or why nothing was filled).
 */
export function runFlashFillCommand(ctx: Context): FlashFillResult {
  const res = flashFill(ctx);
  ctx.cellToolsNotice = {
    id: (ctx.cellToolsNotice?.id ?? 0) + 1,
    kind: "flashFill",
    count: res.filled,
    range: res.range,
    error: res.error,
  };
  return res;
}

registerShortcut("flash-fill", {
  key: "e",
  mod: true,
  handler: (ctx) => {
    runFlashFillCommand(ctx);
    return true;
  },
});
