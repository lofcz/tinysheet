/**
 * Extension points that let features plug into the grid without editing the
 * shared renderer and key handler:
 *
 * - cell decorators draw on a cell's canvas area (background, replace the
 *   text content, or foreground marks) — used by images in cells,
 *   checkboxes, sparklines, error indicators, ...
 * - keyboard shortcuts run before the built-in grid key handling.
 * - cell pointer handlers see a primary-button press on a cell (in-cell
 *   controls such as checkboxes).
 * - edit guards can refuse an edit or clear of a range (read-only regions
 *   such as data table bodies).
 *
 * Registration is keyed, so re-registering a key replaces the entry, and
 * every register call returns an unregister function.
 */
import type { Context } from "../context";
import type { Cell } from "../types";

export type CellDecoratorArgs = {
  ctx: Context;
  renderCtx: CanvasRenderingContext2D;
  r: number;
  c: number;
  /** The cell (null for an empty cell). */
  cell: Cell | null | undefined;
  /** The cell's drawing box in canvas pixels (already zoomed). */
  x: number;
  y: number;
  w: number;
  h: number;
  zoom: number;
};

export type CellDecorator = {
  /** Drawn after the cell's fill, before its content. */
  drawBackground?: (args: CellDecoratorArgs) => void;
  /**
   * Draws the cell's content instead of its text. Return true when the
   * content was drawn (the text is then skipped), false to fall through.
   */
  drawContent?: (args: CellDecoratorArgs) => boolean;
  /** Drawn after the content (indicators, marks). */
  drawForeground?: (args: CellDecoratorArgs) => void;
};

const decorators = new Map<string, CellDecorator>();
let decoratorList: CellDecorator[] = [];

export function registerCellDecorator(key: string, decorator: CellDecorator) {
  decorators.set(key, decorator);
  decoratorList = [...decorators.values()];
  return () => {
    if (decorators.get(key) === decorator) {
      decorators.delete(key);
      decoratorList = [...decorators.values()];
    }
  };
}

export function hasCellDecorators() {
  return decoratorList.length > 0;
}

export function drawCellBackgroundDecorators(args: CellDecoratorArgs) {
  for (let i = 0; i < decoratorList.length; i += 1) {
    decoratorList[i].drawBackground?.(args);
  }
}

/** True when a decorator drew the cell's content (skip the text). */
export function drawCellContentDecorators(args: CellDecoratorArgs) {
  for (let i = 0; i < decoratorList.length; i += 1) {
    const draw = decoratorList[i].drawContent;
    if (draw) {
      args.renderCtx.save();
      let handled = false;
      try {
        handled = draw(args);
      } finally {
        args.renderCtx.restore();
      }
      if (handled) return true;
    }
  }
  return false;
}

export function drawCellForegroundDecorators(args: CellDecoratorArgs) {
  for (let i = 0; i < decoratorList.length; i += 1) {
    const draw = decoratorList[i].drawForeground;
    if (draw) {
      args.renderCtx.save();
      try {
        draw(args);
      } finally {
        args.renderCtx.restore();
      }
    }
  }
}

export type ShortcutHandler = (
  ctx: Context,
  e: KeyboardEvent
) => boolean | void;

export type Shortcut = {
  /** `KeyboardEvent.key` (case-insensitive for letters), e.g. "e", "F9", "`". */
  key: string;
  /** Ctrl on Windows/Linux, Cmd on macOS. */
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** "grid" (default): only when not editing; "any": also while editing. */
  when?: "grid" | "any";
  /** Return false to let the built-in handling run. */
  handler: ShortcutHandler;
};

const shortcuts = new Map<string, Shortcut>();

export function registerShortcut(key: string, shortcut: Shortcut) {
  shortcuts.set(key, shortcut);
  return () => {
    if (shortcuts.get(key) === shortcut) shortcuts.delete(key);
  };
}

function keyMatches(s: Shortcut, e: KeyboardEvent) {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const want = s.key.length === 1 ? s.key.toLowerCase() : s.key;
  if (k !== want) return false;
  const mod = e.ctrlKey || e.metaKey;
  return !!s.mod === mod && !!s.shift === e.shiftKey && !!s.alt === e.altKey;
}

/**
 * Runs the first registered shortcut matching `e`. Returns true when one
 * handled the event (the caller then stops its own handling).
 */
export function runShortcut(ctx: Context, e: KeyboardEvent, editing: boolean) {
  return [...shortcuts.values()].some(
    (s) =>
      !(editing && s.when !== "any") &&
      keyMatches(s, e) &&
      s.handler(ctx, e) !== false
  );
}

export type CellPointerArgs = {
  ctx: Context;
  r: number;
  c: number;
  /** The cell (null for an empty cell). */
  cell: Cell | null | undefined;
  /** The cell's box in grid pixels (zoomed, like the decorator box). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Pointer position relative to the cell box's top-left corner. */
  offsetX: number;
  offsetY: number;
  zoom: number;
  event: MouseEvent;
};

/**
 * Runs when a cell is pressed with the primary button and no modifier key
 * (after the cell got focus, before the selection changes). Return true to
 * stop the built-in handling (selection, drag); anything else lets it run.
 */
export type CellPointerHandler = (args: CellPointerArgs) => boolean | void;

const pointerHandlers = new Map<string, CellPointerHandler>();

export function registerCellPointerHandler(
  key: string,
  handler: CellPointerHandler
) {
  pointerHandlers.set(key, handler);
  return () => {
    if (pointerHandlers.get(key) === handler) pointerHandlers.delete(key);
  };
}

/** True when a handler asked to stop the built-in mouse-down handling. */
export function runCellPointerHandlers(args: CellPointerArgs) {
  let stop = false;
  pointerHandlers.forEach((handler) => {
    if (handler(args) === true) stop = true;
  });
  return stop;
}

export type EditRange = { row: number[]; column: number[] };

/**
 * Checks an edit of `ranges` on the current sheet before it happens:
 * "edit" (a value committed into a cell) or "clear" (Delete, Clear
 * Contents). Return a message to refuse the edit (it is shown to the user),
 * nothing to allow it. A guard may drop its own state when the edit is
 * allowed (clearing a whole data table removes the table, for example).
 */
export type EditGuard = (
  ctx: Context,
  ranges: EditRange[],
  kind: "edit" | "clear"
) => string | null | undefined | void;

const editGuards = new Map<string, EditGuard>();

export function registerEditGuard(key: string, guard: EditGuard) {
  editGuards.set(key, guard);
  return () => {
    if (editGuards.get(key) === guard) editGuards.delete(key);
  };
}

/** The first refusal message of the registered edit guards, or null. */
export function checkEditGuards(
  ctx: Context,
  ranges: EditRange[],
  kind: "edit" | "clear"
): string | null {
  let message: string | null = null;
  editGuards.forEach((guard) => {
    if (message != null) return;
    const res = guard(ctx, ranges, kind);
    if (res) message = res;
  });
  return message;
}
