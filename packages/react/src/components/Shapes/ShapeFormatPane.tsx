import React, { useContext, useId, useState } from "react";
import {
  alignShapes,
  distributeShapes,
  formatShapeText,
  getShapeBox,
  getSheetShapes,
  groupShapes,
  isLineShape,
  dialogsLocale,
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
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Underline,
} from "lucide-react";
import WorkbookContext from "../../context";
import {
  Button,
  Checkbox,
  Field,
  IconButton,
  NumberInput,
  Section,
  Select,
  SwatchRow,
} from "../ui";
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

const ALIGN_ICONS = {
  l: AlignLeft,
  ctr: AlignCenter,
  r: AlignRight,
  just: AlignJustify,
};

/**
 * Format Shape pane (Excel's task pane), docked in the side pane: Shape
 * Options (fill, line, effects, size & properties, arrange) and Text
 * Options (font, alignment, text box) of the selected shapes. Values come
 * from the first selected shape; changes apply to all of them.
 */
const ShapeFormatPane: React.FC = () => {
  const { context, setContext } = useContext(WorkbookContext);
  const t = locale(context).shape;
  const d = dialogsLocale(context).shapePane;
  const ids = context.activeShapes ?? [];
  const shapes = getSheetShapes(context).filter((s) => ids.includes(s.id));
  const first = shapes[0];
  const editing = context.editingShape;
  const readonly = context.allowEdit === false;
  const altId = useId();
  const [tab, setTab] = useState<"shape" | "text">("shape");
  if (!first) return null;
  const allLines = shapes.every(isLineShape);
  const anyGrouped = shapes.some((s) => s.group);
  const box = getShapeBox(context, first);
  const view = allLines ? "shape" : tab;

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

  const fillSection = !allLines && (
    <Section label={t.fill}>
      <Checkbox
        checked={!first.fill}
        label={t.noFill}
        onChange={(none) =>
          update((s) => {
            if (isLineShape(s)) return;
            s.fill = none
              ? null
              : { color: first.fill?.color ?? SHAPE_DEFAULT_FILL };
          })
        }
      />
      {first.fill && (
        <>
          <Field label={t.fillColor} stacked>
            <SwatchRow
              aria-label={t.fillColor}
              customLabel={d.moreColors}
              value={first.fill.color}
              onChange={(color) =>
                color &&
                update((s) => {
                  if (isLineShape(s)) return;
                  s.fill = { ...(s.fill ?? {}), color };
                })
              }
            />
          </Field>
          <Field label={t.transparency}>
            <NumberInput
              aria-label={t.transparency}
              value={Math.round((first.fill.transparency ?? 0) * 100)}
              min={0}
              max={100}
              step={5}
              suffix="%"
              onChange={(n) =>
                update((s) => {
                  if (!s.fill) return;
                  if (n) s.fill.transparency = n / 100;
                  else delete s.fill.transparency;
                })
              }
            />
          </Field>
        </>
      )}
    </Section>
  );

  const lineSection = (
    <Section label={t.outline}>
      <Checkbox
        checked={!first.line}
        label={t.noLine}
        onChange={(none) =>
          update((s) => {
            s.line = none
              ? null
              : {
                  color: first.line?.color ?? SHAPE_DEFAULT_LINE,
                  width: first.line?.width ?? 1,
                };
          })
        }
      />
      {first.line && (
        <>
          <Field label={t.lineColor} stacked>
            <SwatchRow
              aria-label={t.lineColor}
              customLabel={d.moreColors}
              value={first.line.color}
              onChange={(color) =>
                color &&
                update((s) => {
                  if (s.line) s.line.color = color;
                })
              }
            />
          </Field>
          <Field label={t.lineWidth}>
            <NumberInput
              aria-label={t.lineWidth}
              value={Math.round((first.line.width / PX_PER_PT) * 100) / 100}
              min={0.25}
              max={100}
              step={0.25}
              onChange={(pt) =>
                update((s) => {
                  if (s.line) s.line.width = pt * PX_PER_PT;
                })
              }
            />
          </Field>
          <Field label={t.dash}>
            <Select<ShapeDash>
              aria-label={t.dash}
              value={first.line.dash ?? "solid"}
              options={DASH_KEYS.map(([dash, key]) => ({
                value: dash,
                label: (t as Record<string, string>)[key],
              }))}
              onChange={(dash) =>
                update((s) => {
                  if (!s.line) return;
                  if (dash === "solid") delete s.line.dash;
                  else s.line.dash = dash;
                })
              }
            />
          </Field>
          {allLines &&
            (["head", "tail"] as const).map((end) => (
              <Field
                key={end}
                label={end === "head" ? t.beginArrow : t.endArrow}
              >
                <Select<"none" | "triangle">
                  aria-label={end === "head" ? t.beginArrow : t.endArrow}
                  value={
                    first.line?.[end] && first.line[end] !== "none"
                      ? "triangle"
                      : "none"
                  }
                  options={[
                    { value: "none", label: t.arrowNone },
                    { value: "triangle", label: t.arrowTriangle },
                  ]}
                  onChange={(v) =>
                    update((s) => {
                      if (!s.line) return;
                      if (v === "none") delete s.line[end];
                      else s.line[end] = v as ShapeArrowHead;
                    })
                  }
                />
              </Field>
            ))}
        </>
      )}
    </Section>
  );

  const effectsSection = (
    <Section label={t.effects}>
      <Checkbox
        checked={!!first.shadow}
        label={t.shadow}
        onChange={(on) =>
          update((s) => {
            if (on) s.shadow = true;
            else delete s.shadow;
          })
        }
      />
    </Section>
  );

  const sizeSection = shapes.length === 1 && (
    <Section label={d.sizeProperties}>
      <Field label={t.height}>
        <NumberInput
          aria-label={t.height}
          value={Math.round(box.height)}
          min={0}
          suffix="px"
          onChange={(height) =>
            setContext((ctx) =>
              setShapeBoxes(ctx, {
                [first.id]: { ...getShapeBox(ctx, first), height },
              })
            )
          }
        />
      </Field>
      <Field label={t.width}>
        <NumberInput
          aria-label={t.width}
          value={Math.round(box.width)}
          min={0}
          suffix="px"
          onChange={(width) =>
            setContext((ctx) =>
              setShapeBoxes(ctx, {
                [first.id]: { ...getShapeBox(ctx, first), width },
              })
            )
          }
        />
      </Field>
      <Field label={t.rotation}>
        <NumberInput
          aria-label={t.rotation}
          value={first.rot ?? 0}
          min={-360}
          max={360}
          step={15}
          suffix="°"
          onChange={(deg) =>
            update((s) => {
              const rot = ((deg % 360) + 360) % 360;
              if (rot) s.rot = rot;
              else delete s.rot;
            })
          }
        />
      </Field>
      <Field label={t.altText} htmlFor={altId} stacked>
        <textarea
          id={altId}
          rows={2}
          className="fortune-shape-format-alt"
          defaultValue={first.alt ?? ""}
          key={first.id}
          onBlur={(e) => {
            const alt = e.target.value.trim();
            if (alt === (first.alt ?? "")) return;
            update((s) => {
              if (alt) s.alt = alt;
              else delete s.alt;
            });
          }}
        />
      </Field>
    </Section>
  );

  const arrangeSection = (
    <Section label={t.arrange}>
      <div className="fortune-shape-format-grid">
        <Button
          size="sm"
          onClick={() => arrange((ctx) => reorderShapes(ctx, ids, "front"))}
        >
          {t.bringToFront}
        </Button>
        <Button
          size="sm"
          onClick={() => arrange((ctx) => reorderShapes(ctx, ids, "forward"))}
        >
          {t.bringForward}
        </Button>
        <Button
          size="sm"
          onClick={() => arrange((ctx) => reorderShapes(ctx, ids, "backward"))}
        >
          {t.sendBackward}
        </Button>
        <Button
          size="sm"
          onClick={() => arrange((ctx) => reorderShapes(ctx, ids, "back"))}
        >
          {t.sendToBack}
        </Button>
        <Button
          size="sm"
          disabled={shapes.length < 2}
          onClick={() =>
            arrange((ctx) => {
              groupShapes(ctx, ids);
            })
          }
        >
          {t.group}
        </Button>
        <Button
          size="sm"
          disabled={!anyGrouped}
          onClick={() => arrange((ctx) => ungroupShapes(ctx, ids))}
        >
          {t.ungroup}
        </Button>
      </div>
      {shapes.length > 1 && (
        <>
          <div className="fortune-shape-format-subhead">{t.alignObjects}</div>
          <div className="fortune-shape-format-grid">
            {alignItems.map(([how, label]) => (
              <Button
                key={how}
                size="sm"
                onClick={() => arrange((ctx) => alignShapes(ctx, ids, how))}
              >
                {label}
              </Button>
            ))}
            <Button
              size="sm"
              disabled={shapes.length < 3}
              onClick={() =>
                arrange((ctx) => distributeShapes(ctx, ids, "horizontal"))
              }
            >
              {t.distributeHorizontally}
            </Button>
            <Button
              size="sm"
              disabled={shapes.length < 3}
              onClick={() =>
                arrange((ctx) => distributeShapes(ctx, ids, "vertical"))
              }
            >
              {t.distributeVertically}
            </Button>
          </div>
        </>
      )}
    </Section>
  );

  const sizes = FONT_SIZES.includes(fontSize)
    ? FONT_SIZES
    : [...FONT_SIZES, fontSize].sort((a, b) => a - b);

  const textSections = !allLines && (
    <>
      <Section label={d.font}>
        <div className="fortune-shape-format-row" role="group">
          <div className="ts-cluster">
            <IconButton
              icon={Bold}
              label={t.bold}
              pressed={shapeTextHas(text, "b")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggle("b")}
            />
            <IconButton
              icon={Italic}
              label={t.italic}
              pressed={shapeTextHas(text, "i")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggle("i")}
            />
            <IconButton
              icon={Underline}
              label={t.underline}
              pressed={shapeTextHas(text, "u")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggle("u")}
            />
          </div>
          <Select<string>
            aria-label={t.fontSize}
            value={String(fontSize)}
            width={84}
            options={sizes.map((n) => ({ value: String(n), label: `${n}` }))}
            onChange={(v) =>
              updateText((tx) => formatShapeText(tx, { size: Number(v) }))
            }
          />
        </div>
        <Field label={t.fontColor} stacked>
          <SwatchRow
            aria-label={t.fontColor}
            customLabel={d.moreColors}
            value={fontColor}
            onChange={(color) =>
              color && updateText((tx) => formatShapeText(tx, { color }))
            }
          />
        </Field>
      </Section>
      <Section label={d.textBox}>
        <div className="ts-cluster" role="group" aria-label={t.alignLeft}>
          {(["l", "ctr", "r", "just"] as ShapeTextAlign[]).map((a) => (
            <IconButton
              key={a}
              icon={ALIGN_ICONS[a]}
              label={
                {
                  l: t.alignLeft,
                  ctr: t.alignCenter,
                  r: t.alignRight,
                  just: t.justify,
                }[a]
              }
              pressed={align === a}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setAlign(a)}
            />
          ))}
        </div>
        <Field label={t.verticalAlign}>
          <Select<"t" | "ctr" | "b">
            aria-label={t.verticalAlign}
            value={vAlign}
            options={[
              { value: "t", label: t.top },
              { value: "ctr", label: t.middle },
              { value: "b", label: t.bottom },
            ]}
            onChange={(anchor) => updateText((tx) => ({ ...tx, anchor }))}
          />
        </Field>
        <Checkbox
          checked={text?.wrap !== false}
          label={t.wrapText}
          onChange={(wrap) =>
            updateText((tx) => {
              const next = { ...tx };
              if (wrap) delete next.wrap;
              else next.wrap = false;
              return next;
            })
          }
        />
      </Section>
    </>
  );

  return (
    // the keyboard stays in the pane (the dock stops it reaching the grid)
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="fortune-shape-format ts-pane-content"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setContext((ctx) => {
            ctx.shapeFormatOpen = false;
          });
        }
      }}
    >
      {!allLines && (
        <div
          className="ts-segmented fortune-shape-format-tabs"
          role="group"
          aria-label={t.formatShape}
        >
          <button
            type="button"
            className="ts-segmented-item"
            aria-pressed={view === "shape"}
            onClick={() => setTab("shape")}
          >
            {d.shapeOptions}
          </button>
          <button
            type="button"
            className="ts-segmented-item"
            aria-pressed={view === "text"}
            onClick={() => setTab("text")}
          >
            {d.textOptions}
          </button>
        </div>
      )}
      <fieldset className="fortune-shape-format-body" disabled={readonly}>
        {view === "shape" ? (
          <>
            {fillSection}
            {lineSection}
            {effectsSection}
            {sizeSection}
            {arrangeSection}
          </>
        ) : (
          textSections
        )}
      </fieldset>
    </div>
  );
};

export default ShapeFormatPane;
