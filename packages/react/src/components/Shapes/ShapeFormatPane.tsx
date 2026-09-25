import React, { useContext, useEffect, useId, useState } from "react";
import {
  alignShapes,
  distributeShapes,
  formatShapeText,
  getShapeBox,
  getSheetShapes,
  groupShapes,
  isLineShape,
  locale,
  reorderShapes,
  setShapeBoxes,
  Shape,
  ShapeAlign,
  ShapeArrowHead,
  ShapeDash,
  ShapeText,
  ShapeTextAlign,
  shapeTextHas,
  SHAPE_DEFAULT_FILL,
  SHAPE_DEFAULT_LINE,
  ungroupShapes,
  updateShapes,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import { DEFAULT_FONT_SIZE } from "./richText";
import { defaultTextColor } from "./ShapeView";

const PX_PER_PT = 4 / 3;

const DASH_KEYS: [ShapeDash, string][] = [
  ["solid", "dashSolid"],
  ["dash", "dashDash"],
  ["sysDot", "dashDot"],
  ["dashDot", "dashDashDot"],
  ["lgDash", "dashLong"],
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];

/** A number field that applies on Enter / blur (one undo step each). */
const NumberField: React.FC<{
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onCommit: (n: number) => void;
}> = ({ label, value, min, max, step = 1, onCommit }) => {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = Number(draft);
    if (!Number.isFinite(n) || draft.trim() === "") {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
    if (clamped !== value) onCommit(clamped);
    else setDraft(String(value));
  };
  return (
    <label className="fortune-shape-format-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commit();
        }}
      />
    </label>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <section className="fortune-shape-format-section">
    <h3>{title}</h3>
    {children}
  </section>
);

/** Toggle / command button; keeps the focus in the text editor. */
const ToolButton: React.FC<{
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, pressed, disabled, onClick, children }) => (
  <button
    type="button"
    className={`fortune-shape-format-button${
      pressed ? " fortune-shape-format-button-on" : ""
    }`}
    title={label}
    aria-label={label}
    aria-pressed={pressed}
    disabled={disabled}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
  >
    {children}
  </button>
);

const AlignIcon: React.FC<{ align: ShapeTextAlign }> = ({ align }) => {
  const lines: [number, number][] = {
    l: [
      [3, 15],
      [3, 11],
      [3, 15],
      [3, 9],
    ],
    ctr: [
      [3, 15],
      [5, 11],
      [3, 15],
      [6, 9],
    ],
    r: [
      [3, 15],
      [7, 11],
      [3, 15],
      [9, 9],
    ],
    just: [
      [3, 15],
      [3, 15],
      [3, 15],
      [3, 15],
    ],
  }[align] as [number, number][];
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      {lines.map(([x, w], i) => (
        <rect
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          x={x}
          y={3 + i * 3.5}
          width={w - (x - 3)}
          height="1.6"
          fill="currentColor"
        />
      ))}
    </svg>
  );
};

/**
 * Format Shape pane: fill, outline, shadow, text, size/rotation, alt text
 * and arrangement of the selected shapes. Values come from the first
 * selected shape; changes apply to all of them.
 */
const ShapeFormatPane: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const t = locale(context).shape;
  const ids = context.activeShapes ?? [];
  const shapes = getSheetShapes(context).filter((s) => ids.includes(s.id));
  const first = shapes[0];
  const editing = context.editingShape;
  const readonly = context.allowEdit === false;
  const altId = useId();
  const uid = useId();
  if (!first) return null;
  const allLines = shapes.every(isLineShape);
  const anyGrouped = shapes.some((s) => s.group);
  const box = getShapeBox(context, first);

  const update = (fn: (s: Shape) => void) =>
    setContext((ctx) => updateShapes(ctx, ids, fn));
  const updateText = (fn: (text: ShapeText) => ShapeText) =>
    update((s) => {
      if (isLineShape(s)) return;
      s.text = fn(s.text ?? { paragraphs: [{ runs: [] }] });
    });
  const exec = (command: string, value?: string) => {
    try {
      document.execCommand(command, false, value);
    } catch {
      // ignore: formatting the selection is best effort
    }
  };

  const { text } = first;
  const firstRun = text?.paragraphs.flatMap((p) => p.runs)[0];
  const fontSize = firstRun?.size ?? text?.defaults?.size ?? DEFAULT_FONT_SIZE;
  const fontColor =
    firstRun?.color ?? text?.defaults?.color ?? defaultTextColor(first);
  const align = text?.paragraphs[0]?.align ?? (first.textBox ? "l" : "ctr");
  const vAlign = text?.anchor ?? (first.textBox ? "t" : "ctr");

  const toggle = (key: "b" | "i" | "u") => {
    if (editing) {
      exec({ b: "bold", i: "italic", u: "underline" }[key]);
      return;
    }
    const on = !shapeTextHas(first.text, key);
    updateText((tx) => formatShapeText(tx, { [key]: on }));
  };

  const setAlign = (a: ShapeTextAlign) => {
    if (editing) {
      exec(
        {
          l: "justifyLeft",
          ctr: "justifyCenter",
          r: "justifyRight",
          just: "justifyFull",
        }[a]
      );
      return;
    }
    updateText((tx) => ({
      ...tx,
      paragraphs: tx.paragraphs.map((p) => ({ ...p, align: a })),
    }));
  };

  const arrange = (fn: Parameters<typeof setContext>[0]) => setContext(fn);

  const alignItems: [ShapeAlign, string][] = [
    ["left", t.alignObjectsLeft],
    ["center", t.alignObjectsCenter],
    ["right", t.alignObjectsRight],
    ["top", t.alignObjectsTop],
    ["middle", t.alignObjectsMiddle],
    ["bottom", t.alignObjectsBottom],
  ];

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <aside
      className="fortune-shape-format"
      aria-label={t.formatShape}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          setContext((ctx) => {
            ctx.shapeFormatOpen = false;
          });
        }
      }}
    >
      <div className="fortune-shape-format-header">
        <h2>{t.formatShape}</h2>
        <button
          type="button"
          className="fortune-shape-format-close"
          aria-label={t.close}
          title={t.close}
          onClick={() =>
            setContext((ctx) => {
              ctx.shapeFormatOpen = false;
            })
          }
        >
          ×
        </button>
      </div>
      <fieldset className="fortune-shape-format-body" disabled={readonly}>
        {!allLines && (
          <Section title={t.fill}>
            <label className="fortune-shape-format-check" htmlFor={`${uid}-1`}>
              <input
                id={`${uid}-1`}
                type="checkbox"
                checked={!first.fill}
                onChange={(e) => {
                  const none = e.target.checked;
                  update((s) => {
                    if (isLineShape(s)) return;
                    s.fill = none
                      ? null
                      : { color: first.fill?.color ?? SHAPE_DEFAULT_FILL };
                  });
                }}
              />
              {t.noFill}
            </label>
            {first.fill && (
              <>
                <label
                  className="fortune-shape-format-field"
                  htmlFor={`${uid}-2`}
                >
                  <span>{t.fillColor}</span>
                  <input
                    id={`${uid}-2`}
                    type="color"
                    value={first.fill.color.toLowerCase()}
                    onChange={(e) => {
                      const color = e.target.value.toUpperCase();
                      update((s) => {
                        if (isLineShape(s)) return;
                        s.fill = { ...(s.fill ?? {}), color };
                      });
                    }}
                  />
                </label>
                <NumberField
                  label={`${t.transparency} (%)`}
                  value={Math.round((first.fill.transparency ?? 0) * 100)}
                  min={0}
                  max={100}
                  onCommit={(n) =>
                    update((s) => {
                      if (!s.fill) return;
                      if (n) s.fill.transparency = n / 100;
                      else delete s.fill.transparency;
                    })
                  }
                />
              </>
            )}
          </Section>
        )}
        <Section title={t.outline}>
          <label className="fortune-shape-format-check" htmlFor={`${uid}-3`}>
            <input
              id={`${uid}-3`}
              type="checkbox"
              checked={!first.line}
              onChange={(e) => {
                const none = e.target.checked;
                update((s) => {
                  s.line = none
                    ? null
                    : {
                        color: first.line?.color ?? SHAPE_DEFAULT_LINE,
                        width: first.line?.width ?? 1,
                      };
                });
              }}
            />
            {t.noLine}
          </label>
          {first.line && (
            <>
              <label
                className="fortune-shape-format-field"
                htmlFor={`${uid}-4`}
              >
                <span>{t.lineColor}</span>
                <input
                  id={`${uid}-4`}
                  type="color"
                  value={first.line.color.toLowerCase()}
                  onChange={(e) => {
                    const color = e.target.value.toUpperCase();
                    update((s) => {
                      if (s.line) s.line.color = color;
                    });
                  }}
                />
              </label>
              <NumberField
                label={t.lineWidth}
                value={Math.round((first.line.width / PX_PER_PT) * 100) / 100}
                min={0.25}
                max={100}
                step={0.25}
                onCommit={(pt) =>
                  update((s) => {
                    if (s.line) s.line.width = pt * PX_PER_PT;
                  })
                }
              />
              <label
                className="fortune-shape-format-field"
                htmlFor={`${uid}-5`}
              >
                <span>{t.dash}</span>
                <select
                  id={`${uid}-5`}
                  value={first.line.dash ?? "solid"}
                  onChange={(e) => {
                    const dash = e.target.value as ShapeDash;
                    update((s) => {
                      if (!s.line) return;
                      if (dash === "solid") delete s.line.dash;
                      else s.line.dash = dash;
                    });
                  }}
                >
                  {DASH_KEYS.map(([dash, key]) => (
                    <option key={dash} value={dash}>
                      {(t as Record<string, string>)[key]}
                    </option>
                  ))}
                </select>
              </label>
              {allLines &&
                (["head", "tail"] as const).map((end) => (
                  <label
                    key={end}
                    className="fortune-shape-format-field"
                    htmlFor={`${uid}-${end}`}
                  >
                    <span>{end === "head" ? t.beginArrow : t.endArrow}</span>
                    <select
                      id={`${uid}-${end}`}
                      value={
                        first.line?.[end] && first.line[end] !== "none"
                          ? "triangle"
                          : "none"
                      }
                      onChange={(e) => {
                        const v = e.target.value as ShapeArrowHead;
                        update((s) => {
                          if (!s.line) return;
                          if (v === "none") delete s.line[end];
                          else s.line[end] = v;
                        });
                      }}
                    >
                      <option value="none">{t.arrowNone}</option>
                      <option value="triangle">{t.arrowTriangle}</option>
                    </select>
                  </label>
                ))}
            </>
          )}
        </Section>
        <Section title={t.effects}>
          <label className="fortune-shape-format-check" htmlFor={`${uid}-7`}>
            <input
              id={`${uid}-7`}
              type="checkbox"
              checked={!!first.shadow}
              onChange={(e) => {
                const on = e.target.checked;
                update((s) => {
                  if (on) s.shadow = true;
                  else delete s.shadow;
                });
              }}
            />
            {t.shadow}
          </label>
        </Section>
        {!allLines && (
          <Section title={t.textOptions}>
            <div className="fortune-shape-format-row" role="group">
              <ToolButton
                label={t.bold}
                pressed={shapeTextHas(text, "b")}
                onClick={() => toggle("b")}
              >
                <b>B</b>
              </ToolButton>
              <ToolButton
                label={t.italic}
                pressed={shapeTextHas(text, "i")}
                onClick={() => toggle("i")}
              >
                <i>I</i>
              </ToolButton>
              <ToolButton
                label={t.underline}
                pressed={shapeTextHas(text, "u")}
                onClick={() => toggle("u")}
              >
                <u>U</u>
              </ToolButton>
            </div>
            <div className="fortune-shape-format-row" role="group">
              {(["l", "ctr", "r", "just"] as ShapeTextAlign[]).map((a) => (
                <ToolButton
                  key={a}
                  label={
                    {
                      l: t.alignLeft,
                      ctr: t.alignCenter,
                      r: t.alignRight,
                      just: t.justify,
                    }[a]
                  }
                  pressed={align === a}
                  onClick={() => setAlign(a)}
                >
                  <AlignIcon align={a} />
                </ToolButton>
              ))}
            </div>
            <label className="fortune-shape-format-field" htmlFor={`${uid}-8`}>
              <span>{t.fontColor}</span>
              <input
                id={`${uid}-8`}
                type="color"
                value={fontColor.toLowerCase()}
                onChange={(e) => {
                  const color = e.target.value.toUpperCase();
                  updateText((tx) => formatShapeText(tx, { color }));
                }}
              />
            </label>
            <label className="fortune-shape-format-field" htmlFor={`${uid}-9`}>
              <span>{t.fontSize}</span>
              <select
                id={`${uid}-9`}
                value={String(fontSize)}
                onChange={(e) => {
                  const size = Number(e.target.value);
                  updateText((tx) => formatShapeText(tx, { size }));
                }}
              >
                {(FONT_SIZES.includes(fontSize)
                  ? FONT_SIZES
                  : [...FONT_SIZES, fontSize].sort((a, b) => a - b)
                ).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="fortune-shape-format-field" htmlFor={`${uid}-10`}>
              <span>{t.verticalAlign}</span>
              <select
                id={`${uid}-10`}
                value={vAlign}
                onChange={(e) => {
                  const anchor = e.target.value as "t" | "ctr" | "b";
                  updateText((tx) => ({ ...tx, anchor }));
                }}
              >
                <option value="t">{t.top}</option>
                <option value="ctr">{t.middle}</option>
                <option value="b">{t.bottom}</option>
              </select>
            </label>
            <label className="fortune-shape-format-check" htmlFor={`${uid}-11`}>
              <input
                id={`${uid}-11`}
                type="checkbox"
                checked={text?.wrap !== false}
                onChange={(e) => {
                  const wrap = e.target.checked;
                  updateText((tx) => {
                    const next = { ...tx };
                    if (wrap) delete next.wrap;
                    else next.wrap = false;
                    return next;
                  });
                }}
              />
              {t.wrapText}
            </label>
          </Section>
        )}
        {shapes.length === 1 && (
          <Section title={t.size}>
            <NumberField
              label={t.height}
              value={Math.round(box.height)}
              min={0}
              onCommit={(height) =>
                setContext((ctx) =>
                  setShapeBoxes(ctx, {
                    [first.id]: { ...getShapeBox(ctx, first), height },
                  })
                )
              }
            />
            <NumberField
              label={t.width}
              value={Math.round(box.width)}
              min={0}
              onCommit={(width) =>
                setContext((ctx) =>
                  setShapeBoxes(ctx, {
                    [first.id]: { ...getShapeBox(ctx, first), width },
                  })
                )
              }
            />
            <NumberField
              label={`${t.rotation} (°)`}
              value={first.rot ?? 0}
              min={-360}
              max={360}
              onCommit={(deg) =>
                update((s) => {
                  const rot = ((deg % 360) + 360) % 360;
                  if (rot) s.rot = rot;
                  else delete s.rot;
                })
              }
            />
            <label className="fortune-shape-format-field" htmlFor={altId}>
              <span>{t.altText}</span>
              <input
                id={altId}
                type="text"
                defaultValue={first.alt ?? ""}
                key={first.id}
                onKeyDown={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  const alt = e.target.value.trim();
                  if (alt === (first.alt ?? "")) return;
                  update((s) => {
                    if (alt) s.alt = alt;
                    else delete s.alt;
                  });
                }}
              />
            </label>
          </Section>
        )}
        <Section title={t.arrange}>
          <div className="fortune-shape-format-grid">
            <button
              type="button"
              onClick={() => arrange((ctx) => reorderShapes(ctx, ids, "front"))}
            >
              {t.bringToFront}
            </button>
            <button
              type="button"
              onClick={() =>
                arrange((ctx) => reorderShapes(ctx, ids, "forward"))
              }
            >
              {t.bringForward}
            </button>
            <button
              type="button"
              onClick={() =>
                arrange((ctx) => reorderShapes(ctx, ids, "backward"))
              }
            >
              {t.sendBackward}
            </button>
            <button
              type="button"
              onClick={() => arrange((ctx) => reorderShapes(ctx, ids, "back"))}
            >
              {t.sendToBack}
            </button>
            <button
              type="button"
              disabled={shapes.length < 2}
              onClick={() =>
                arrange((ctx) => {
                  groupShapes(ctx, ids);
                })
              }
            >
              {t.group}
            </button>
            <button
              type="button"
              disabled={!anyGrouped}
              onClick={() => arrange((ctx) => ungroupShapes(ctx, ids))}
            >
              {t.ungroup}
            </button>
          </div>
          {shapes.length > 1 && (
            <>
              <h4>{t.alignObjects}</h4>
              <div className="fortune-shape-format-grid">
                {alignItems.map(([how, label]) => (
                  <button
                    key={how}
                    type="button"
                    onClick={() => arrange((ctx) => alignShapes(ctx, ids, how))}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={shapes.length < 3}
                  onClick={() =>
                    arrange((ctx) => distributeShapes(ctx, ids, "horizontal"))
                  }
                >
                  {t.distributeHorizontally}
                </button>
                <button
                  type="button"
                  disabled={shapes.length < 3}
                  onClick={() =>
                    arrange((ctx) => distributeShapes(ctx, ids, "vertical"))
                  }
                >
                  {t.distributeVertically}
                </button>
              </div>
            </>
          )}
        </Section>
      </fieldset>
    </aside>
  );
};

export default ShapeFormatPane;
