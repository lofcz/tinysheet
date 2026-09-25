/**
 * Evaluate Formula (Formulas > Formula Auditing): step through a formula's
 * evaluation the way Excel's dialog does.
 *
 * The formula is parsed to the parser's AST and turned into a tree of
 * steps. Each Evaluate replaces the next part (the innermost, leftmost
 * pending sub-expression: a cell reference, an operation, a function call)
 * with its value; IF and IFERROR only evaluate the branch they take. The
 * value of a part is computed by evaluating its text, with the parts
 * already evaluated written as literals, in the formula cell's context
 * (names, relative references and @ work as in the cell). Step In opens the
 * formula of a referenced cell as a nested level; Step Out returns its
 * value.
 *
 * Kept deliberately without side effects: nothing is written to the
 * workbook (no calc chain, no spill, no dependency record).
 */
import _ from "lodash";
import type { Context } from "../context";
import { getSheetIndex } from "../utils";
import { indexToColumn } from "./refAdjust";
import {
  finishFormulaEvaluation,
  prepareFormulaEvaluation,
  quoteSheetName,
  toErrorString,
} from "./formulaFunctions";
import { getSheetIdByNameCached } from "./dependencyGraph";
import { qualifiedCellAddress } from "./formulaAudit";

type Ast = any;

type StepNode = {
  ast: Ast;
  children: StepNode[];
  /** a pending part that Evaluate can replace by its value */
  steppable: boolean;
  done: boolean;
  value?: unknown;
};

type Level = {
  sheetId: string;
  r: number;
  c: number;
  formula: string;
  root: StepNode | null;
};

export type FormulaEvaluation = { levels: Level[] };

export type EvaluationSegment = {
  text: string;
  /** replaced by its value (Excel shows these in italics) */
  evaluated?: boolean;
  /** the part the next Evaluate computes (underlined) */
  next?: boolean;
};

export type EvaluationView = {
  levels: {
    reference: string;
    segments: EvaluationSegment[];
  }[];
  finished: boolean;
  canEvaluate: boolean;
  canStepIn: boolean;
  canStepOut: boolean;
};

/* ------------------------------------------------------------------------ */
/* Literals                                                                 */
/* ------------------------------------------------------------------------ */

/** A value written as formula text (`"a"`, `TRUE`, `{1,2;3,4}`, `#N/A`). */
export function valueToLiteral(v: unknown): string {
  if (v == null || v === "") return v === "" ? '""' : "0";
  if (v instanceof Error) return toErrorString(v) ?? "#VALUE!";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "#NUM!";
    return String(v).replace("e", "E");
  }
  if (Array.isArray(v)) {
    const rows = (Array.isArray(v[0]) ? v : [v]) as unknown[][];
    return `{${rows
      .map((row) => row.map((x) => valueToLiteral(x ?? 0)).join(","))
      .join(";")}}`;
  }
  const s = String(v);
  const err = toErrorString(s);
  if (err) return err;
  return `"${s.replace(/"/g, '""')}"`;
}

/* ------------------------------------------------------------------------ */
/* Tree                                                                     */
/* ------------------------------------------------------------------------ */

/** Functions whose arguments are not evaluated on their own. */
const ATOMIC_CALLS = new Set([
  "LET",
  "LAMBDA",
  "MAP",
  "REDUCE",
  "SCAN",
  "MAKEARRAY",
  "BYROW",
  "BYCOL",
]);

/** Functions returning references (kept whole inside another call). */
const REFERENCE_CALLS = new Set(["OFFSET", "INDIRECT", "INDEX"]);

const BINARY_PRECEDENCE: Record<string, number> = {
  "^": 4,
  "*": 3,
  "/": 3,
  "+": 2,
  "-": 2,
  "&": 1,
};

function precedence(ast: Ast) {
  return ast.type === "binary" ? BINARY_PRECEDENCE[ast.op] ?? 0 : 9;
}

function isLiteral(ast: Ast) {
  if (["number", "string", "error", "array", "missing"].includes(ast.type)) {
    return true;
  }
  if (ast.type === "name") return /^(TRUE|FALSE)$/i.test(ast.name);
  if (ast.type === "negate" || ast.type === "plus") {
    return ast.value.type === "number";
  }
  return false;
}

function build(ast: Ast, parent: Ast | null): StepNode {
  const node: StepNode = {
    ast,
    children: [],
    steppable: false,
    done: false,
  };
  if (isLiteral(ast)) return node;
  switch (ast.type) {
    case "cell":
      // a reference argument stays a reference (ROW(A1), OFFSET(A1, ...))
      node.steppable = parent?.type !== "call";
      break;
    case "binary":
      node.children = [build(ast.left, ast), build(ast.right, ast)];
      node.steppable = true;
      break;
    case "negate":
    case "plus":
    case "percent":
    case "implicit":
      node.children = [build(ast.value, ast)];
      node.steppable = true;
      break;
    case "call":
      if (!ATOMIC_CALLS.has(ast.key)) {
        node.children = ast.args.map((a: Ast) => build(a, ast));
      }
      node.steppable = !(
        parent?.type === "call" && REFERENCE_CALLS.has(ast.key)
      );
      break;
    case "invoke":
    case "intersect":
    case "union":
    case "rangeRef":
      node.steppable = true;
      break;
    default:
      // ranges, names, #REF!: part of their parent's evaluation
      break;
  }
  return node;
}

function isTruthy(v: unknown) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v.toUpperCase() === "TRUE";
  return false;
}

function isError(v: unknown) {
  return v instanceof Error || !!toErrorString(v as any);
}

/** Children still relevant (IF / IFERROR skip the branch not taken). */
function activeChildren(node: StepNode) {
  const { ast, children } = node;
  if (ast.type === "call" && children.length > 1 && children[0].done) {
    const test = children[0].value;
    if (ast.key === "IF") {
      if (isError(test)) return [children[0]];
      return isTruthy(test)
        ? [children[0], children[1]]
        : [children[0], ...(children[2] ? [children[2]] : [])];
    }
    if (ast.key === "IFERROR" || ast.key === "IFNA") {
      const hit =
        ast.key === "IFNA"
          ? toErrorString(test as any) === "#N/A"
          : isError(test);
      return hit ? children : [children[0]];
    }
  }
  return children;
}

function findNext(node: StepNode): StepNode | null {
  if (node.done) return null;
  const kids = activeChildren(node);
  for (let i = 0; i < kids.length; i += 1) {
    const next = findNext(kids[i]);
    if (next) return next;
  }
  return node.steppable ? node : null;
}

/* ------------------------------------------------------------------------ */
/* Text                                                                     */
/* ------------------------------------------------------------------------ */

function sheetPrefix(sheetName: string | null) {
  return sheetName == null ? "" : `${quoteSheetName(sheetName)}!`;
}

function leafText(ast: Ast): string {
  switch (ast.type) {
    case "number":
      return valueToLiteral(ast.value);
    case "string":
      return `"${String(ast.value).replace(/"/g, '""')}"`;
    case "error":
      return ast.image;
    case "array":
      return valueToLiteral(ast.rows);
    case "missing":
      return "";
    case "name":
      return ast.name;
    case "cell":
      return ast.image;
    case "range":
      return `${ast.start}:${ast.end}`;
    case "wholeRange": {
      const label = (i: number, abs: boolean) =>
        (abs ? "$" : "") +
        (ast.kind === "columns" ? indexToColumn(i) : String(i + 1));
      return `${sheetPrefix(ast.sheetName)}${label(
        ast.start,
        ast.startAbsolute
      )}:${label(ast.end, ast.endAbsolute)}`;
    }
    case "refError":
      return "#REF!";
    default:
      return "";
  }
}

/** Collects the text segments of a node; `next` gets underlined. */
type Emitter = {
  parts: EvaluationSegment[];
  next: StepNode | null;
};

function emit(out: Emitter, text: string, evaluated?: boolean) {
  if (text) out.parts.push(evaluated ? { text, evaluated } : { text });
}

const COMPLEX_TYPES = ["invoke", "intersect", "union", "rangeRef"];

/**
 * Write the node as formula text: evaluated nodes as their value, the
 * others from the AST (parenthesised by precedence).
 */
function emitNode(node: StepNode, out: Emitter) {
  const start = out.parts.length;
  // eslint-disable-next-line no-use-before-define
  emitNodeInner(node, out);
  if (node === out.next) {
    for (let i = start; i < out.parts.length; i += 1) out.parts[i].next = true;
  }
}

function emitChild(
  child: StepNode,
  parentAst: Ast,
  out: Emitter,
  right: boolean
) {
  let wrap = false;
  if (parentAst.type === "call") {
    wrap = false;
  } else if (child.done) {
    wrap = typeof child.value === "number" && child.value < 0;
  } else if (child.ast.type === "binary") {
    const p = precedence(parentAst);
    const q = precedence(child.ast);
    wrap = parentAst.type !== "binary" || q < p || (right && q === p);
  }
  if (wrap) emit(out, "(");
  emitNode(child, out);
  if (wrap) emit(out, ")");
}

/** Plain formula text of an AST (no evaluated parts). */
function astText(ast: Ast): string {
  const out: Emitter = { parts: [], next: null };
  // eslint-disable-next-line no-use-before-define
  emitNode(build(ast, null), out);
  return out.parts.map((p) => p.text).join("");
}

function complexText(ast: Ast): string {
  switch (ast.type) {
    case "invoke":
      return `${astText(ast.callee)}(${ast.args.map(astText).join(",")})`;
    case "intersect":
      return `${astText(ast.left)} ${astText(ast.right)}`;
    case "union":
      return `(${ast.items.map(astText).join(",")})`;
    case "rangeRef":
      return `${astText(ast.left)}:${astText(ast.right)}`;
    default:
      return leafText(ast);
  }
}

function emitNodeInner(node: StepNode, out: Emitter) {
  const { ast } = node;
  if (node.done) {
    emit(out, valueToLiteral(node.value), true);
    return;
  }
  const kids = node.children;
  switch (ast.type) {
    case "binary":
      emitChild(kids[0], ast, out, false);
      emit(out, ast.op);
      emitChild(kids[1], ast, out, true);
      return;
    case "negate":
    case "plus":
      emit(out, ast.type === "negate" ? "-" : "+");
      if (kids.length === 0) emit(out, leafText(ast.value));
      else emitChild(kids[0], ast, out, false);
      return;
    case "percent":
      emitChild(kids[0], ast, out, false);
      emit(out, "%");
      return;
    case "implicit":
      emit(out, "@");
      emitChild(kids[0], ast, out, false);
      return;
    case "call":
      emit(out, `${ast.name}(`);
      if (kids.length > 0) {
        kids.forEach((k, i) => {
          if (i > 0) emit(out, ",");
          emitChild(k, ast, out, false);
        });
      } else {
        // atomic call (LET, LAMBDA, ...): arguments as written
        emit(out, ast.args.map(astText).join(","));
      }
      emit(out, ")");
      return;
    default:
      emit(
        out,
        COMPLEX_TYPES.includes(ast.type) ? complexText(ast) : leafText(ast)
      );
  }
}

function collect(node: StepNode, next: StepNode | null) {
  const out: Emitter = { parts: [], next };
  emitNode(node, out);
  return out.parts;
}

function textOf(node: StepNode) {
  return collect(node, null)
    .map((p) => p.text)
    .join("");
}

/* ------------------------------------------------------------------------ */
/* Evaluation                                                               */
/* ------------------------------------------------------------------------ */

/**
 * Value of formula text evaluated as if it were in (r, c) of `sheetId`,
 * without touching the workbook. Errors come back as error strings.
 */
export function evaluateFormulaText(
  ctx: Context,
  text: string,
  r: number,
  c: number,
  sheetId: string
): unknown {
  const parser = ctx.formulaCache?.parser;
  if (!parser) return "#VALUE!";
  const txt = text.startsWith("=") ? text : `=${text}`;
  const prev = parser.context;
  parser.context = ctx;
  try {
    const expression = prepareFormulaEvaluation(ctx, txt, r, c, sheetId);
    const { result, error } = parser.parse(expression, {
      sheetId,
      row: r,
      column: c,
    });
    const v = _.isNil(error) ? result : error;
    if (v instanceof Error) return toErrorString(v) ?? "#VALUE!";
    if (v instanceof Date) return v.toString();
    return v;
  } catch (e) {
    return "#VALUE!";
  } finally {
    finishFormulaEvaluation(
      ctx,
      null,
      undefined as any,
      undefined as any,
      sheetId
    );
    parser.context = prev ?? ctx;
  }
}

function cellFormula(ctx: Context, sheetId: string, r: number, c: number) {
  const i = getSheetIndex(ctx, sheetId);
  const f = i == null ? null : ctx.luckysheetfile[i]?.data?.[r]?.[c]?.f;
  return typeof f === "string" && f.charAt(0) === "=" && f.length > 1
    ? f
    : null;
}

function makeLevel(
  ctx: Context,
  sheetId: string,
  r: number,
  c: number,
  formula: string
): Level {
  let root: StepNode | null = null;
  try {
    const ast = ctx.formulaCache.parser.getAst(formula.slice(1));
    root = build(ast, null);
    root.steppable = true;
  } catch (e) {
    root = null; // not parseable here: evaluated as a whole
  }
  return { sheetId, r, c, formula, root };
}

/** Start evaluating the formula in (r, c); null when it has none. */
export function createFormulaEvaluation(
  ctx: Context,
  sheetId: string,
  r: number,
  c: number
): FormulaEvaluation | null {
  const f = cellFormula(ctx, sheetId, r, c);
  if (!f) return null;
  return { levels: [makeLevel(ctx, sheetId, r, c, f)] };
}

function top(session: FormulaEvaluation) {
  return session.levels[session.levels.length - 1];
}

function nextOf(level: Level) {
  return level.root ? findNext(level.root) : null;
}

function isFinished(level: Level) {
  return level.root ? level.root.done : !!(level as any).wholeDone;
}

/** The cell a pending reference step points to, when it has a formula. */
function stepInTarget(ctx: Context, level: Level) {
  const next = nextOf(level);
  if (!next || next.ast.type !== "cell") return null;
  const { rect } = next.ast;
  const sheetId =
    rect.sheetName == null
      ? level.sheetId
      : getSheetIdByNameCached(ctx, rect.sheetName);
  if (sheetId == null) return null;
  const f = cellFormula(ctx, sheetId, rect.r1, rect.c1);
  return f ? { sheetId, r: rect.r1, c: rect.c1, f } : null;
}

function evaluateNode(ctx: Context, level: Level, node: StepNode) {
  const text = textOf(node);
  let v = evaluateFormulaText(ctx, text, level.r, level.c, level.sheetId);
  if (node.ast.type === "cell" && (v == null || v === "")) v = 0;
  if (Array.isArray(v) && v.length === 1 && Array.isArray(v[0])) {
    if (v[0].length === 1 && node.ast.type !== "array") [[v]] = v as any;
  }
  node.value = v;
  node.done = true;
}

/** Evaluate: compute the underlined part. */
export function evaluateNextStep(ctx: Context, session: FormulaEvaluation) {
  const level = top(session);
  if (!level.root) {
    if (!(level as any).wholeDone) {
      (level as any).wholeValue = evaluateFormulaText(
        ctx,
        level.formula,
        level.r,
        level.c,
        level.sheetId
      );
      (level as any).wholeDone = true;
    }
    return;
  }
  const next = findNext(level.root);
  if (next) evaluateNode(ctx, level, next);
}

/** Step In: show the formula of the referenced cell as a nested level. */
export function stepIn(ctx: Context, session: FormulaEvaluation) {
  const target = stepInTarget(ctx, top(session));
  if (!target || session.levels.length > 32) return false;
  session.levels.push(
    makeLevel(ctx, target.sheetId, target.r, target.c, target.f)
  );
  return true;
}

/** Step Out: leave the nested level; its cell's value replaces the reference. */
export function stepOut(ctx: Context, session: FormulaEvaluation) {
  if (session.levels.length < 2) return false;
  session.levels.pop();
  evaluateNextStep(ctx, session);
  return true;
}

/** Restart from the unevaluated formula. */
export function restartEvaluation(ctx: Context, session: FormulaEvaluation) {
  const first = session.levels[0];
  session.levels = [
    makeLevel(ctx, first.sheetId, first.r, first.c, first.formula),
  ];
}

/** What the dialog shows. */
export function getEvaluationView(
  ctx: Context,
  session: FormulaEvaluation
): EvaluationView {
  const levels = session.levels.map((level, i) => {
    const reference = qualifiedCellAddress(
      ctx,
      level.sheetId,
      level.r,
      level.c
    );
    const isTop = i === session.levels.length - 1;
    let segments: EvaluationSegment[];
    if (!level.root) {
      segments = (level as any).wholeDone
        ? [{ text: valueToLiteral((level as any).wholeValue), evaluated: true }]
        : [{ text: level.formula.slice(1), next: isTop }];
    } else {
      segments = collect(level.root, isTop ? nextOf(level) : null);
    }
    return { reference, segments };
  });
  const cur = top(session);
  const finished = session.levels.length === 1 && isFinished(cur);
  return {
    levels,
    finished,
    canEvaluate: !isFinished(cur),
    canStepIn: !!stepInTarget(ctx, cur),
    canStepOut: session.levels.length > 1,
  };
}
