import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  clearShapeSelection,
  copyShapes,
  deleteShapes,
  duplicateShapes,
  expandShapeGroups,
  formatShapeText,
  galleryItem,
  getShapeBox,
  getSheetIndex,
  groupShapes,
  insertShape,
  isLineShape,
  locale,
  moveShapes,
  pasteShapes,
  plainToShapeText,
  reorderShapes,
  selectShapes,
  setShapeBoxes,
  Shape,
  ShapeBox,
  ShapeText,
  shapeLabel,
  shapeTextHas,
  ungroupShapes,
  unionBox,
  updateShapes,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import ShapeView from "./ShapeView";
import ShapeFormatPane from "./ShapeFormatPane";
import ShapeTextEditor from "./ShapeTextEditor";
import { placeInPanes } from "./panes";
import {
  adjustFromHandle,
  adjustHandle,
  lineEnds,
  lineFromEnds,
  Point,
  resizeBox,
  rotationTowards,
  scaleBoxes,
  sheetToLocal,
  Side,
  SIDES,
  snapLine,
} from "./interaction";
import { getShapeClipboard, setShapeClipboard } from "./shapeClipboard";
import "./index.css";

type DragMode = "move" | Side | "rotate" | "start" | "end" | "adjust";

type Patch = {
  box?: ShapeBox;
  rot?: number;
  flipH?: boolean;
  flipV?: boolean;
  adj?: Record<string, number>;
};

type DragState = {
  mode: DragMode;
  ids: string[];
  shape?: Shape;
  start: Point;
  boxes: Record<string, ShapeBox>;
  union: ShapeBox;
  moved: boolean;
  patches: Record<string, Patch> | null;
};

const EMPTY: Shape[] = [];
const NO_IDS: string[] = [];
const RUN_KEYS: Record<string, "b" | "i" | "u"> = {
  KeyB: "b",
  KeyI: "i",
  KeyU: "u",
};

/** Clicks on these keep the shape selection. */
const OUTSIDE_SELECTORS =
  ".fortune-shape, .fortune-shape-frame, .fortune-shape-format, .fortune-shape-menu, .fortune-toolbar, .fortune-toolbar-combo-popup";

function isPrintableKey(e: React.KeyboardEvent) {
  return (
    e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== " "
  );
}

const ShapeLayer: React.FC = () => {
  const { context, setContext, refs } = useContext(WorkbookContext);
  const t = locale(context).shape;
  const sheetIndex = getSheetIndex(context, context.currentSheetId);
  const sheet =
    sheetIndex == null ? undefined : context.luckysheetfile[sheetIndex];
  const shapes = sheet?.shapes ?? EMPTY;
  const zoom = context.zoomRatio || 1;
  const readonly = context.allowEdit === false;
  const selected = context.activeShapes ?? NO_IDS;
  const editing = context.editingShape;
  const drawKind = context.shapeDrawKind;
  const formatOpen = !!context.shapeFormatOpen;
  const [patches, setPatches] = useState<Record<string, Patch> | null>(null);
  const [draw, setDraw] = useState<{ start: Point; end: Point } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<DragState | null>(null);
  const shapeRefs = useRef(new Map<string, HTMLDivElement>());
  const focusTarget = useRef<string | null>(null);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toSheet = useCallback(
    (e: { clientX: number; clientY: number }): Point => {
      const rect = refs.cellArea.current?.getBoundingClientRect();
      const z = context.zoomRatio || 1;
      return {
        x: (e.clientX - (rect?.left ?? 0) + (context.scrollLeft || 0)) / z,
        y: (e.clientY - (rect?.top ?? 0) + (context.scrollTop || 0)) / z,
      };
    },
    [context, refs.cellArea]
  );

  const boxOf = useCallback(
    (shape: Shape) => getShapeBox(context, shape),
    [context]
  );

  // Forget selected ids that are gone (undo, other sheet, collaborator).
  useEffect(() => {
    if (!selected.length && !editing) return;
    const ids = new Set(shapes.map((s) => s.id));
    const keep = selected.filter((id) => ids.has(id));
    if (keep.length !== selected.length || (editing && !ids.has(editing))) {
      setContext((ctx) => {
        if (keep.length) ctx.activeShapes = keep;
        else clearShapeSelection(ctx);
        if (ctx.editingShape && !ids.has(ctx.editingShape))
          ctx.editingShape = undefined;
      });
    }
  }, [editing, selected, setContext, shapes]);

  // Focus the shape that was just selected so the keyboard acts on it.
  useLayoutEffect(() => {
    if (!selected.length || editing) return;
    const id =
      focusTarget.current && selected.includes(focusTarget.current)
        ? focusTarget.current
        : selected[selected.length - 1];
    const el = shapeRefs.current.get(id);
    const active = document.activeElement;
    if (
      el &&
      !el.contains(active) &&
      !active?.closest?.(".fortune-shape-format, .fortune-shape-menu")
    ) {
      el.focus({ preventScroll: true });
    }
  }, [selected, editing]);

  // Clicking elsewhere in the workbook deselects.
  useEffect(() => {
    if (!selected.length) return undefined;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const container = refs.workbookContainer.current;
      if (!target || !container?.contains(target)) return;
      if (target.closest?.(OUTSIDE_SELECTORS)) return;
      setMenu(null);
      setContext((ctx) => clearShapeSelection(ctx));
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [refs.workbookContainer, selected.length, setContext]);

  // Esc leaves the draw mode.
  useEffect(() => {
    if (!drawKind) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setDraw(null);
      setContext((ctx) => {
        ctx.shapeDrawKind = undefined;
      });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [drawKind, setContext]);

  // Paste copied shapes (capture phase, before the cell paste handler).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const container = refs.workbookContainer.current;
      const active = document.activeElement as HTMLElement | null;
      if (!container || !active || !container.contains(active)) return;
      if (active.closest(".fortune-shape-editor, .fortune-shape-format"))
        return;
      const clip = getShapeClipboard(e.clipboardData?.getData("text/plain"));
      if (!clip || readonly) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const fromShape = !!active.closest(".fortune-shape");
      setContext((ctx) => {
        let at: { left: number; top: number } | undefined;
        const sel =
          ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
        if (!fromShape && sel) {
          const r = sel.row_focus ?? sel.row[0];
          const c = sel.column_focus ?? sel.column[0];
          const box = getShapeBox(ctx, {
            from: { r, c, dx: 0, dy: 0 },
            to: { r, c, dx: 0, dy: 0 },
          });
          at = { left: box.left, top: box.top };
        }
        pasteShapes(ctx, clip, at);
      });
    };
    window.addEventListener("paste", onPaste, true);
    return () => window.removeEventListener("paste", onPaste, true);
  }, [readonly, refs.workbookContainer, setContext]);

  // ---------------------------------------------------------------------
  // Dragging (move, resize, rotate, line ends, adjust handle)
  // ---------------------------------------------------------------------

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      const d = drag.current;
      if (!d) return;
      const p = toSheet(e);
      const dx = p.x - d.start.x;
      const dy = p.y - d.start.y;
      if (!d.moved && Math.hypot(dx, dy) * zoom < 3) return;
      d.moved = true;
      const next: Record<string, Patch> = {};
      const { mode, shape } = d;
      if (mode === "move") {
        const mx = Math.max(dx, -d.union.left);
        const my = Math.max(dy, -d.union.top);
        d.ids.forEach((id) => {
          const b = d.boxes[id];
          next[id] = { box: { ...b, left: b.left + mx, top: b.top + my } };
        });
      } else if (mode === "rotate" && shape) {
        next[shape.id] = {
          rot: rotationTowards(d.boxes[shape.id], p, e.shiftKey),
        };
      } else if ((mode === "start" || mode === "end") && shape) {
        const ends = lineEnds(d.boxes[shape.id], shape);
        const fixed = mode === "start" ? ends.end : ends.start;
        const moving = e.shiftKey ? snapLine(fixed, p) : p;
        const line =
          mode === "start"
            ? lineFromEnds(moving, fixed)
            : lineFromEnds(fixed, moving);
        next[shape.id] = {
          box: line.box,
          flipH: line.flipH,
          flipV: line.flipV,
          rot: 0,
        };
      } else if (mode === "adjust" && shape) {
        const box = d.boxes[shape.id];
        const adj = adjustFromHandle(shape, box, sheetToLocal(box, shape, p));
        if (adj) next[shape.id] = { adj };
      } else {
        const side = mode as Side;
        if (d.ids.length === 1 && shape) {
          next[shape.id] = {
            box: resizeBox(
              d.boxes[shape.id],
              shape.rot ?? 0,
              side,
              dx,
              dy,
              e.shiftKey
            ),
          };
        } else {
          const union = resizeBox(d.union, 0, side, dx, dy, e.shiftKey);
          const scaled = scaleBoxes(d.boxes, d.union, union);
          Object.entries(scaled).forEach(([id, box]) => {
            next[id] = { box };
          });
        }
      }
      d.patches = next;
      setPatches(next);
    },
    [toSheet, zoom]
  );

  const onMouseUp = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    window.removeEventListener("mousemove", onMouseMove);
    // eslint-disable-next-line @typescript-eslint/no-use-before-define, no-use-before-define
    window.removeEventListener("mouseup", onMouseUpRef.current);
    if (d?.moved && d.patches) {
      const done = d.patches;
      setContext((ctx) => {
        const boxes: Record<string, ShapeBox> = {};
        Object.entries(done).forEach(([id, patch]) => {
          if (patch.box) boxes[id] = patch.box;
        });
        setShapeBoxes(ctx, boxes);
        Object.entries(done).forEach(([id, patch]) => {
          updateShapes(ctx, [id], (s) => {
            if (patch.rot != null) {
              if (patch.rot) s.rot = patch.rot;
              else delete s.rot;
            }
            if (patch.flipH != null) {
              if (patch.flipH) s.flipH = true;
              else delete s.flipH;
            }
            if (patch.flipV != null) {
              if (patch.flipV) s.flipV = true;
              else delete s.flipV;
            }
            if (patch.adj) s.adj = patch.adj;
          });
        });
      });
    }
    setPatches(null);
  }, [onMouseMove, setContext]);
  const onMouseUpRef = useRef(onMouseUp);
  onMouseUpRef.current = onMouseUp;

  useEffect(
    () => () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUpRef.current);
    },
    [onMouseMove]
  );

  const focusShape = (id: string) => {
    focusTarget.current = id;
    shapeRefs.current.get(id)?.focus({ preventScroll: true });
  };

  const startDrag = (e: React.MouseEvent, shape: Shape, mode: DragMode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    setMenu(null);
    let ids = selected;
    if (mode === "move") {
      const group = expandShapeGroups(shapes, [shape.id]);
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        setContext((ctx) => selectShapes(ctx, [shape.id], true));
        focusShape(shape.id);
        return;
      }
      if (!group.every((id) => selectedSet.has(id))) {
        ids = group;
        setContext((ctx) => selectShapes(ctx, [shape.id]));
      }
    }
    focusShape(shape.id);
    if (readonly || editing === shape.id) return;
    const boxes: Record<string, ShapeBox> = {};
    shapes.forEach((s) => {
      if (ids.includes(s.id)) boxes[s.id] = boxOf(s);
    });
    drag.current = {
      mode,
      ids,
      shape,
      start: toSheet(e),
      boxes,
      union: unionBox(Object.values(boxes)) ?? boxOf(shape),
      moved: false,
      patches: null,
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUpRef.current);
  };

  // ---------------------------------------------------------------------
  // Drawing a new shape (Insert › Shapes, then drag on the sheet)
  // ---------------------------------------------------------------------

  const drawBox = (start: Point, end: Point, square: boolean) => {
    let dx = end.x - start.x;
    let dy = end.y - start.y;
    const item = drawKind ? galleryItem(drawKind) : undefined;
    const line = item?.category === "lines";
    if (square) {
      if (line) {
        const snapped = snapLine(start, end);
        dx = snapped.x - start.x;
        dy = snapped.y - start.y;
      } else {
        const size = Math.max(Math.abs(dx), Math.abs(dy));
        dx = Math.sign(dx || 1) * size;
        dy = Math.sign(dy || 1) * size;
      }
    }
    return {
      box: {
        left: Math.min(start.x, start.x + dx),
        top: Math.min(start.y, start.y + dy),
        width: Math.abs(dx),
        height: Math.abs(dy),
      },
      flipH: !!line && dx < 0,
      flipV: !!line && dy < 0,
    };
  };

  const onDrawStart = (e: React.MouseEvent) => {
    if (e.button !== 0 || !drawKind) return;
    e.preventDefault();
    e.stopPropagation();
    const start = toSheet(e);
    setDraw({ start, end: start });
    let last = start;
    let square = e.shiftKey;
    const move = (ev: MouseEvent) => {
      last = toSheet(ev);
      square = ev.shiftKey;
      setDraw({ start, end: last });
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      setDraw(null);
      const kind = drawKind;
      const item = galleryItem(kind);
      if (!item) return;
      const dragged = Math.hypot(last.x - start.x, last.y - start.y) * zoom > 3;
      let placed = drawBox(start, last, square);
      if (!dragged) {
        // a click inserts the default size, like Excel
        let size = { width: 96, height: 96 };
        if (item.textBox) size = { width: 160, height: 60 };
        if (item.category === "lines") size = { width: 144, height: 0 };
        placed = {
          box: { left: start.x, top: start.y, ...size },
          flipH: false,
          flipV: false,
        };
      }
      setContext((ctx) => {
        const shape = insertShape(ctx, kind, placed);
        if (shape && item.textBox) ctx.editingShape = shape.id;
      });
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  // ---------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------

  const startEditing = (shape: Shape, initial?: string) => {
    if (readonly || isLineShape(shape)) return;
    setMenu(null);
    setContext((ctx) => {
      selectShapes(ctx, [shape.id]);
      ctx.activeShapes = [shape.id];
      if (initial != null) {
        updateShapes(ctx, [shape.id], (s) => {
          s.text = plainToShapeText(initial, s.text);
        });
      }
      ctx.editingShape = shape.id;
    });
  };

  const commitText = useCallback(
    (id: string, text: ShapeText | null) => {
      setContext((ctx) => {
        if (text) {
          updateShapes(ctx, [id], (s) => {
            if (JSON.stringify(s.text) !== JSON.stringify(text)) s.text = text;
          });
        }
        if (ctx.editingShape === id) ctx.editingShape = undefined;
      });
    },
    [setContext]
  );

  const toggleRun = (key: "b" | "i" | "u") => {
    const first = shapes.find((s) => s.id === selected[0]);
    const on = !shapeTextHas(first?.text, key);
    setContext((ctx) =>
      updateShapes(ctx, selected, (s) => {
        if (isLineShape(s)) return;
        s.text = formatShapeText(s.text, { [key]: on });
      })
    );
  };

  const cycleFocus = (shape: Shape, back: boolean) => {
    if (shapes.length === 0) return;
    const i = shapes.findIndex((s) => s.id === shape.id);
    const next = shapes[(i + (back ? -1 : 1) + shapes.length) % shapes.length];
    focusTarget.current = next.id;
    setContext((ctx) => {
      ctx.activeShapes = [next.id];
    });
  };

  const onKeyDown = (e: React.KeyboardEvent, shape: Shape) => {
    if (editing === shape.id) return;
    const mod = e.ctrlKey || e.metaKey;
    // Undo / redo bubble to the workbook.
    if (mod && (e.code === "KeyZ" || e.code === "KeyY")) return;
    // Copy / cut / paste are handled by the clipboard events.
    if (mod && ["KeyC", "KeyX", "KeyV"].includes(e.code)) {
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    if (e.key === "Tab") {
      e.preventDefault();
      cycleFocus(shape, e.shiftKey);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setMenu(null);
      setContext((ctx) => clearShapeSelection(ctx));
      refs.cellInput.current?.focus();
      return;
    }
    if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      setMenu({ x: rect.left + 8, y: rect.top + 8 });
      return;
    }
    if (mod && e.code === "KeyA") {
      e.preventDefault();
      setContext((ctx) => {
        ctx.activeShapes = shapes.map((s) => s.id);
      });
      return;
    }
    if (readonly) return;
    const ids = selected.length ? selected : [shape.id];
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      setContext((ctx) => deleteShapes(ctx, ids));
      refs.cellInput.current?.focus();
      return;
    }
    if ((e.key === "Enter" || e.key === "F2") && !mod) {
      e.preventDefault();
      startEditing(shape);
      return;
    }
    if (mod && e.code === "KeyD") {
      e.preventDefault();
      setContext((ctx) => {
        duplicateShapes(ctx, ids);
      });
      return;
    }
    if (mod && e.code === "KeyG") {
      e.preventDefault();
      setContext((ctx) => {
        if (e.shiftKey) ungroupShapes(ctx, ids);
        else groupShapes(ctx, ids);
      });
      return;
    }
    if (mod && ["KeyB", "KeyI", "KeyU"].includes(e.code)) {
      e.preventDefault();
      toggleRun(RUN_KEYS[e.code]);
      return;
    }
    if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      const delta = e.key === "ArrowLeft" ? -15 : 15;
      setContext((ctx) =>
        updateShapes(ctx, ids, (s) => {
          const rot = ((((s.rot ?? 0) + delta) % 360) + 360) % 360;
          if (rot) s.rot = rot;
          else delete s.rot;
        })
      );
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    const nudge: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = nudge[e.key];
    if (delta) {
      e.preventDefault();
      setContext((ctx) => moveShapes(ctx, ids, delta[0], delta[1]));
      return;
    }
    if (isPrintableKey(e) && ids.length === 1 && !isLineShape(shape)) {
      // typing on a selected shape replaces its text, as in Excel
      e.preventDefault();
      startEditing(shape, e.key);
    }
  };

  const onCopy = (e: React.ClipboardEvent, cut: boolean) => {
    if (editing) return;
    e.preventDefault();
    e.stopPropagation();
    const clip = copyShapes(context, selected);
    if (!clip) return;
    e.clipboardData.setData("text/plain", setShapeClipboard(clip));
    if (cut && !readonly) {
      setContext((ctx) => deleteShapes(ctx, selected));
      refs.cellInput.current?.focus();
    }
  };

  const run = (fn: (ctx: typeof context) => void) => {
    setMenu(null);
    setContext(fn);
  };

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------

  const freeze = refs.globalCache.freezen?.[context.currentSheetId];

  const rendered = shapes.map((shape) => {
    const patch = patches?.[shape.id];
    const box = patch?.box ?? boxOf(shape);
    const view: Shape = {
      ...shape,
      ...(patch?.rot != null ? { rot: patch.rot } : {}),
      ...(patch?.flipH != null ? { flipH: patch.flipH } : {}),
      ...(patch?.flipV != null ? { flipV: patch.flipV } : {}),
      ...(patch?.adj ? { adj: patch.adj } : {}),
    };
    return { shape: view, box };
  });

  const single =
    selected.length === 1
      ? rendered.find((r) => r.shape.id === selected[0])
      : undefined;
  const multiBox =
    !single && selected.length > 0
      ? unionBox(
          rendered.filter((r) => selectedSet.has(r.shape.id)).map((r) => r.box)
        )
      : null;

  const renderHandles = (shape: Shape, box: ShapeBox) => {
    const zw = box.width * zoom;
    const zh = box.height * zoom;
    if (isLineShape(shape)) {
      const start = {
        x: shape.flipH ? zw : 0,
        y: shape.flipV ? zh : 0,
      };
      const end = { x: shape.flipH ? 0 : zw, y: shape.flipV ? 0 : zh };
      return (
        !readonly && (
          <>
            {(
              [
                ["start", start],
                ["end", end],
              ] as const
            ).map(([mode, p]) => (
              <div
                key={mode}
                className="fortune-shape-handle fortune-shape-handle-end"
                style={{ left: p.x - 5, top: p.y - 5 }}
                aria-hidden="true"
                onMouseDown={(e) => startDrag(e, shape, mode)}
              />
            ))}
          </>
        )
      );
    }
    const adj = adjustHandle(shape, box);
    const adjPoint = adj
      ? {
          x: (shape.flipH ? box.width - adj.x : adj.x) * zoom,
          y: (shape.flipV ? box.height - adj.y : adj.y) * zoom,
        }
      : null;
    return (
      <div className="fortune-shape-frame" aria-hidden="true">
        {!readonly &&
          SIDES.map((side) => (
            <div
              key={side}
              className={`fortune-shape-handle fortune-shape-handle-${side}`}
              onMouseDown={(e) => startDrag(e, shape, side)}
            />
          ))}
        {!readonly && (
          <div
            className="fortune-shape-rotate"
            title={t.rotate}
            onMouseDown={(e) => startDrag(e, shape, "rotate")}
          />
        )}
        {!readonly && adjPoint && (
          <div
            className="fortune-shape-handle fortune-shape-adjust"
            title={t.adjust}
            style={{ left: adjPoint.x - 5, top: adjPoint.y - 5 }}
            onMouseDown={(e) => startDrag(e, shape, "adjust")}
          />
        )}
      </div>
    );
  };

  const drawPreview = draw
    ? drawBox(draw.start, draw.end, false).box
    : undefined;

  const firstSelected =
    shapes.find((s) => s.id === selected[selected.length - 1]) ?? undefined;
  const anyGrouped = shapes.some((s) => selectedSet.has(s.id) && s.group);
  const menuItems: {
    key: string;
    label: string;
    disabled?: boolean;
    onClick: () => void;
  }[] = firstSelected
    ? [
        {
          key: "cut",
          label: t.cut,
          disabled: readonly,
          onClick: () => {
            const clip = copyShapes(context, selected);
            if (clip) {
              navigator.clipboard
                ?.writeText(setShapeClipboard(clip))
                .catch(() => {});
            }
            run((ctx) => deleteShapes(ctx, selected));
          },
        },
        {
          key: "copy",
          label: t.copy,
          onClick: () => {
            const clip = copyShapes(context, selected);
            if (clip) {
              navigator.clipboard
                ?.writeText(setShapeClipboard(clip))
                .catch(() => {});
            }
            setMenu(null);
          },
        },
        {
          key: "duplicate",
          label: t.duplicate,
          disabled: readonly,
          onClick: () =>
            run((ctx) => {
              duplicateShapes(ctx, selected);
            }),
        },
        {
          key: "editText",
          label: t.editText,
          disabled:
            readonly || isLineShape(firstSelected) || selected.length > 1,
          onClick: () => startEditing(firstSelected),
        },
        {
          key: "bringToFront",
          label: t.bringToFront,
          disabled: readonly,
          onClick: () => run((ctx) => reorderShapes(ctx, selected, "front")),
        },
        {
          key: "bringForward",
          label: t.bringForward,
          disabled: readonly,
          onClick: () => run((ctx) => reorderShapes(ctx, selected, "forward")),
        },
        {
          key: "sendBackward",
          label: t.sendBackward,
          disabled: readonly,
          onClick: () => run((ctx) => reorderShapes(ctx, selected, "backward")),
        },
        {
          key: "sendToBack",
          label: t.sendToBack,
          disabled: readonly,
          onClick: () => run((ctx) => reorderShapes(ctx, selected, "back")),
        },
        {
          key: "group",
          label: t.group,
          disabled: readonly || !multiBox,
          onClick: () =>
            run((ctx) => {
              groupShapes(ctx, selected);
            }),
        },
        {
          key: "ungroup",
          label: t.ungroup,
          disabled: readonly || !anyGrouped,
          onClick: () => run((ctx) => ungroupShapes(ctx, selected)),
        },
        {
          key: "format",
          label: `${t.formatShape}…`,
          onClick: () =>
            run((ctx) => {
              ctx.shapeFormatOpen = true;
            }),
        },
        {
          key: "delete",
          label: t.delete,
          disabled: readonly,
          onClick: () => {
            run((ctx) => deleteShapes(ctx, selected));
            refs.cellInput.current?.focus();
          },
        },
      ]
    : [];

  const overlayRoot =
    refs.cellArea.current?.closest<HTMLElement>(".fortune-sheet-overlay") ??
    null;

  if (shapes.length === 0 && !drawKind) return null;

  return (
    <div className="fortune-shape-layer">
      {rendered.map(({ shape, box }) => {
        const zoomed = {
          left: box.left * zoom,
          top: box.top * zoom,
          width: box.width * zoom,
          height: box.height * zoom,
        };
        const panes = placeInPanes(context, freeze, zoomed);
        const isSelected = selectedSet.has(shape.id);
        const isEditing = editing === shape.id;
        return panes.map((pane) => {
          const clipped = pane.clip.some((v) => v > 0);
          const { primary } = pane;
          return (
            <div
              key={`${shape.id}-${primary ? "main" : pane.clip.join()}`}
              className="fortune-shape-pane"
              style={{
                left: pane.left,
                top: pane.top,
                width: zoomed.width,
                height: zoomed.height,
                clipPath: clipped
                  ? `inset(${pane.clip.map((v) => `${v}px`).join(" ")})`
                  : undefined,
              }}
            >
              <div
                ref={
                  primary
                    ? (el) => {
                        if (el) shapeRefs.current.set(shape.id, el);
                        else shapeRefs.current.delete(shape.id);
                      }
                    : undefined
                }
                className={`fortune-shape${
                  isSelected ? " fortune-shape-selected" : ""
                }${isEditing ? " fortune-shape-editing" : ""}${
                  isLineShape(shape) ? " fortune-shape-line" : ""
                }`}
                data-shape-id={primary ? shape.id : undefined}
                role={primary ? "button" : undefined}
                aria-roledescription={primary ? t.shape : undefined}
                aria-label={primary ? shapeLabel(shape) : undefined}
                aria-hidden={primary ? undefined : true}
                aria-pressed={primary ? isSelected : undefined}
                tabIndex={primary ? 0 : -1}
                style={{
                  width: zoomed.width,
                  height: zoomed.height,
                  transform: shape.rot ? `rotate(${shape.rot}deg)` : undefined,
                }}
                onMouseDown={(e) => startDrag(e, shape, "move")}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startEditing(shape);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!selectedSet.has(shape.id)) {
                    setContext((ctx) => selectShapes(ctx, [shape.id]));
                  }
                  focusShape(shape.id);
                  setMenu({ x: e.clientX, y: e.clientY });
                }}
                onKeyDown={(e) => onKeyDown(e, shape)}
                onCopy={(e) => onCopy(e, false)}
                onCut={(e) => onCopy(e, true)}
              >
                <ShapeView
                  shape={shape}
                  width={box.width}
                  height={box.height}
                  zoom={zoom}
                  editor={
                    isEditing && primary ? (
                      <ShapeTextEditor
                        shape={shape}
                        onDone={(text) => {
                          commitText(shape.id, text);
                          focusTarget.current = shape.id;
                        }}
                        onExit={() => focusShape(shape.id)}
                      />
                    ) : undefined
                  }
                />
                {isSelected && primary && single?.shape.id === shape.id
                  ? renderHandles(shape, box)
                  : isSelected &&
                    primary && <div className="fortune-shape-outline" />}
              </div>
            </div>
          );
        });
      })}
      {multiBox && (
        <div
          className="fortune-shape-frame fortune-shape-frame-multi"
          style={{
            left: multiBox.left * zoom,
            top: multiBox.top * zoom,
            width: multiBox.width * zoom,
            height: multiBox.height * zoom,
          }}
          aria-hidden="true"
        >
          {!readonly &&
            firstSelected &&
            SIDES.map((side) => (
              <div
                key={side}
                className={`fortune-shape-handle fortune-shape-handle-${side}`}
                onMouseDown={(e) => startDrag(e, firstSelected, side)}
              />
            ))}
        </div>
      )}
      {drawKind && (
        <div
          className="fortune-shape-draw"
          role="presentation"
          title={t.drawHint}
          style={{
            left: context.scrollLeft,
            top: context.scrollTop,
            width: context.cellmainWidth,
            height: context.cellmainHeight,
          }}
          onMouseDown={onDrawStart}
        />
      )}
      {drawPreview && (
        <div
          className="fortune-shape-draw-preview"
          style={{
            left: drawPreview.left * zoom,
            top: drawPreview.top * zoom,
            width: drawPreview.width * zoom,
            height: drawPreview.height * zoom,
          }}
        />
      )}
      {menu &&
        firstSelected &&
        createPortal(
          <div
            className="fortune-shape-menu"
            role="menu"
            aria-label={t.shape}
            style={{ left: menu.x, top: menu.y }}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              const items = Array.from(
                e.currentTarget.querySelectorAll<HTMLButtonElement>(
                  "button:not([disabled])"
                )
              );
              const i = items.indexOf(document.activeElement as any);
              if (e.key === "Escape") {
                setMenu(null);
                focusShape(firstSelected.id);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                items[(i + 1) % items.length]?.focus();
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                items[(i - 1 + items.length) % items.length]?.focus();
              }
            }}
            ref={(el) => {
              if (el && !el.contains(document.activeElement)) {
                el.querySelector<HTMLButtonElement>(
                  "button:not([disabled])"
                )?.focus({ preventScroll: true });
              }
            }}
          >
            {menuItems.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                className="fortune-shape-menu-item"
                disabled={item.disabled}
                onClick={item.onClick}
              >
                {item.label}
              </button>
            ))}
          </div>,
          refs.workbookContainer.current ?? document.body
        )}
      {formatOpen &&
        selected.length > 0 &&
        overlayRoot &&
        createPortal(<ShapeFormatPane />, overlayRoot)}
    </div>
  );
};

export default ShapeLayer;
