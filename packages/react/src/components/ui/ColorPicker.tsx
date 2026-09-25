import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Palette } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Tooltip } from "./Tooltip";
import { ICON_STROKE } from "./icons";
import {
  addRecentColor,
  getRecentColors,
  hsvToRgb,
  normalizeHex,
  parseColor,
  rgbToHsv,
  STANDARD_COLORS,
  subscribeRecentColors,
  themeGrid,
  toHex,
  brightness,
  HSV,
} from "./color";
import "./ui.css";
import "./pickers.css";

export type ColorPickerLabels = {
  themeColors: string;
  standardColors: string;
  recentColors: string;
  moreColors: string;
  custom: string;
  hex: string;
  hue: string;
  saturation: string;
  newColor: string;
  currentColor: string;
  ok: string;
  cancel: string;
};

const DEFAULT_LABELS: ColorPickerLabels = {
  themeColors: "Theme Colors",
  standardColors: "Standard Colors",
  recentColors: "Recent Colors",
  moreColors: "More Colors…",
  custom: "Custom color",
  hex: "Hex",
  hue: "Hue",
  saturation: "Saturation and brightness",
  newColor: "New",
  currentColor: "Current",
  ok: "OK",
  cancel: "Cancel",
};

export type ColorPickerProps = {
  /** The current colour ("#rrggbb"); `null` / undefined = automatic / none. */
  value?: string | null;
  /**
   * A colour was picked: "#rrggbb" (lower case), or `null` for the
   * automatic entry. Callers usually close their popover afterwards.
   */
  onChange: (color: string | null) => void;
  /**
   * Label of the entry above the grid that clears the colour ("Automatic"
   * for font / line colour, "No Fill" for fill). Omit to hide it.
   */
  automaticLabel?: string;
  /** Swatch of the automatic entry (black for font colour); none = no fill. */
  automaticColor?: string | null;
  /** Show "More Colors…" (custom colour: saturation / hue / hex). */
  moreColors?: boolean;
  labels?: Partial<ColorPickerLabels>;
  className?: string;
  "aria-label"?: string;
};

const COLUMNS = 10;

/** One colour cell of the grid, with an Excel-style screen tip. */
const Swatch: React.FC<{
  color: string;
  name: string;
  selected: boolean;
  onPick: (color: string) => void;
  tabIndex: number;
  className?: string;
}> = ({ color, name, selected, onPick, tabIndex, className }) => (
  <Tooltip label={name} placement="bottom">
    <button
      type="button"
      className={[
        "ts-swatch",
        brightness(color) > 0.92 ? "ts-swatch--light" : "",
        selected ? "ts-swatch--selected" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ backgroundColor: color }}
      data-color={color}
      aria-label={name}
      aria-pressed={selected}
      tabIndex={tabIndex}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(color)}
    />
  </Tooltip>
);

/** Arrow keys move between the swatches of a grid (10 per row). */
function onGridKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
  const moves: Record<string, number> = {
    ArrowRight: 1,
    ArrowLeft: -1,
    ArrowDown: COLUMNS,
    ArrowUp: -COLUMNS,
  };
  const delta = moves[e.key];
  if (delta == null && e.key !== "Home" && e.key !== "End") return;
  const all = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>(".ts-swatch")
  );
  const i = all.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  let next = i;
  if (e.key === "Home") next = 0;
  else if (e.key === "End") next = all.length - 1;
  else next = i + delta;
  if (next < 0 || next >= all.length) {
    // vertical moves leave the grid (to Automatic / More Colors…)
    if (delta === COLUMNS || delta === -COLUMNS) return;
    next = Math.max(0, Math.min(all.length - 1, next));
  }
  e.preventDefault();
  e.stopPropagation();
  all[next]?.focus({ preventScroll: true });
}

/**
 * Excel's colour drop-down in Fika's look: Automatic / No Fill, the Theme
 * Colors grid (10 × 6: the theme colours and their tints and shades),
 * Standard Colors, Recent Colors and More Colors… (an inline custom colour
 * picker: saturation / brightness square, hue slider and hex field).
 *
 *   <ColorPicker value={fc} automaticLabel="Automatic"
 *     onChange={(c) => { apply(c); close(); }} />
 */
export const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  automaticLabel,
  automaticColor,
  moreColors = true,
  labels: labelOverrides,
  className,
  ...rest
}) => {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  const [custom, setCustom] = useState(false);
  const grid = useMemo(() => themeGrid(), []);
  const recent = useSyncExternalStore(
    subscribeRecentColors,
    getRecentColors,
    getRecentColors
  );
  const current = normalizeHex(value);
  const rootRef = useRef<HTMLDivElement>(null);

  const pick = useCallback(
    (color: string | null) => {
      onChange(color == null ? null : normalizeHex(color));
    },
    [onChange]
  );

  // the selected (or first) swatch takes the keyboard when opened by it
  const focusIndex = useMemo(() => {
    const flat = grid.flat().map((c) => c.color);
    const i = flat.indexOf(current);
    return i < 0 ? 0 : i;
  }, [grid, current]);

  if (custom) {
    return (
      <div
        className={`ts-color-picker${className ? ` ${className}` : ""}`}
        aria-label={rest["aria-label"]}
      >
        <CustomColorPanel
          initial={current || "#4472c4"}
          labels={labels}
          onCancel={() => setCustom(false)}
          onOk={(hex) => {
            addRecentColor(hex);
            setCustom(false);
            pick(hex);
          }}
        />
      </div>
    );
  }

  let tabIndexUsed = false;
  const tab = (i: number) => {
    if (!tabIndexUsed && i === focusIndex) {
      tabIndexUsed = true;
      return 0;
    }
    return -1;
  };

  return (
    <div
      ref={rootRef}
      className={`ts-color-picker${className ? ` ${className}` : ""}`}
      role="group"
      aria-label={rest["aria-label"]}
    >
      {automaticLabel && (
        <button
          type="button"
          className={`ts-color-auto${current ? "" : " ts-color-auto--selected"}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => pick(null)}
        >
          <span
            className={`ts-color-auto-swatch${
              automaticColor ? "" : " ts-color-auto-swatch--none"
            }`}
            style={
              automaticColor ? { backgroundColor: automaticColor } : undefined
            }
          />
          <span className="ts-color-auto-label">{automaticLabel}</span>
        </button>
      )}
      <div className="ts-color-section-title">{labels.themeColors}</div>
      <div
        className="ts-color-grid ts-color-grid--theme"
        onKeyDown={onGridKeyDown}
      >
        {grid.map((row, r) => (
          <div
            key={r}
            className={`ts-color-row${r === 0 ? " ts-color-row--base" : ""}`}
            role="presentation"
          >
            {row.map((c, col) => (
              <Swatch
                key={`${r}-${col}`}
                color={c.color}
                name={c.name}
                selected={current === c.color}
                onPick={pick}
                tabIndex={tab(r * COLUMNS + col)}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="ts-color-section-title">{labels.standardColors}</div>
      <div className="ts-color-grid" onKeyDown={onGridKeyDown}>
        <div className="ts-color-row" role="presentation">
          {STANDARD_COLORS.map((c) => (
            <Swatch
              key={c.color}
              color={c.color}
              name={c.name}
              selected={current === c.color}
              onPick={pick}
              tabIndex={-1}
            />
          ))}
        </div>
      </div>
      {recent.length > 0 && (
        <>
          <div className="ts-color-section-title">{labels.recentColors}</div>
          <div className="ts-color-grid" onKeyDown={onGridKeyDown}>
            <div className="ts-color-row" role="presentation">
              {recent.map((c) => (
                <Swatch
                  key={c}
                  color={c}
                  name={c.toUpperCase()}
                  selected={current === c}
                  onPick={pick}
                  tabIndex={-1}
                />
              ))}
            </div>
          </div>
        </>
      )}
      {moreColors && (
        <>
          <div className="ts-color-separator" role="separator" />
          <button
            type="button"
            className="ts-color-more"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setCustom(true)}
          >
            <Palette size={16} strokeWidth={ICON_STROKE} aria-hidden />
            <span>{labels.moreColors}</span>
          </button>
        </>
      )}
    </div>
  );
};

/** Pointer drag inside `el`: calls `onMove(x, y)` with 0…1 fractions. */
function useDrag(onMove: (fx: number, fy: number) => void) {
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  return useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    e.preventDefault();
    el.focus({ preventScroll: true });
    const update = (ev: { clientX: number; clientY: number }) => {
      const rect = el.getBoundingClientRect();
      const fx = rect.width ? (ev.clientX - rect.left) / rect.width : 0;
      const fy = rect.height ? (ev.clientY - rect.top) / rect.height : 0;
      moveRef.current(
        Math.max(0, Math.min(1, fx)),
        Math.max(0, Math.min(1, fy))
      );
    };
    update(e);
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // synthetic events (tests) have no active pointer
    }
    const move = (ev: PointerEvent) => update(ev);
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }, []);
}

/**
 * Fika's custom colour picker: saturation / brightness square, hue slider,
 * hex field and a new / current preview; OK applies.
 */
export const CustomColorPanel: React.FC<{
  initial: string;
  labels?: Partial<ColorPickerLabels>;
  onOk: (hex: string) => void;
  onCancel: () => void;
}> = ({ initial, labels: labelOverrides, onOk, onCancel }) => {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  const initialHex = normalizeHex(initial) || "#000000";
  const [hsv, setHsv] = useState<HSV>(() => rgbToHsv(parseColor(initialHex)!));
  const hex = toHex(hsvToRgb(hsv));
  const [draft, setDraft] = useState<string | null>(null);
  const satRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    satRef.current?.focus({ preventScroll: true });
  }, []);

  const onSatDown = useDrag((fx, fy) =>
    setHsv((c) => ({ h: c.h, s: fx, v: 1 - fy }))
  );
  const onHueDown = useDrag((fx) =>
    setHsv((c) => ({ ...c, h: Math.min(359.9, fx * 360) }))
  );

  const commitDraft = (text: string) => {
    const rgb = parseColor(text);
    if (rgb) setHsv(rgbToHsv(rgb));
    setDraft(null);
  };

  const step = (e: React.KeyboardEvent, apply: (d: number) => void) => {
    const big = e.shiftKey ? 10 : 1;
    const d: Record<string, number> = {
      ArrowRight: 1,
      ArrowUp: 1,
      ArrowLeft: -1,
      ArrowDown: -1,
    };
    if (d[e.key] == null) return;
    e.preventDefault();
    e.stopPropagation();
    apply(d[e.key] * big);
  };

  return (
    <div
      className="ts-custom-color"
      onKeyDown={(e) => {
        if (e.key === "Enter" && !(e.target as HTMLElement).closest("button")) {
          e.preventDefault();
          e.stopPropagation();
          onOk(draft != null ? normalizeHex(draft) || hex : hex);
        }
      }}
    >
      <div className="ts-color-section-title">{labels.custom}</div>
      <div
        ref={satRef}
        className="ts-custom-color-sat"
        style={{ backgroundColor: `hsl(${hsv.h}, 100%, 50%)` }}
        role="slider"
        tabIndex={0}
        aria-label={labels.saturation}
        aria-valuetext={hex}
        aria-valuenow={Math.round(hsv.s * 100)}
        onPointerDown={onSatDown}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            step(e, (d) =>
              setHsv((c) => ({
                ...c,
                v: Math.max(0, Math.min(1, c.v + d / 100)),
              }))
            );
          } else {
            step(e, (d) =>
              setHsv((c) => ({
                ...c,
                s: Math.max(0, Math.min(1, c.s + d / 100)),
              }))
            );
          }
        }}
      >
        <div className="ts-custom-color-sat-white" />
        <div className="ts-custom-color-sat-black" />
        <div
          className="ts-custom-color-sat-pointer"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        />
      </div>
      <div
        className="ts-custom-color-hue"
        role="slider"
        tabIndex={0}
        aria-label={labels.hue}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        onPointerDown={onHueDown}
        onKeyDown={(e) =>
          step(e, (d) => setHsv((c) => ({ ...c, h: (c.h + d + 360) % 360 })))
        }
      >
        <div
          className="ts-custom-color-hue-pointer"
          style={{ left: `${(hsv.h / 360) * 100}%` }}
        />
      </div>
      <div className="ts-custom-color-fields">
        <div
          className="ts-custom-color-preview"
          title={`${labels.newColor} / ${labels.currentColor}`}
        >
          <span style={{ backgroundColor: hex }} aria-label={labels.newColor} />
          <span
            style={{ backgroundColor: initialHex }}
            aria-label={labels.currentColor}
          />
        </div>
        <label className="ts-custom-color-hex">
          <span>{labels.hex}</span>
          <Input
            size="sm"
            prefix="#"
            value={draft ?? hex.slice(1).toUpperCase()}
            aria-label={labels.hex}
            spellCheck={false}
            maxLength={7}
            className="ts-custom-color-hex-input"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commitDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                const typed = normalizeHex(e.currentTarget.value);
                if (typed) onOk(typed);
              }
            }}
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>
      </div>
      <div className="ts-custom-color-footer">
        <Button size="sm" variant="secondary" onClick={onCancel}>
          {labels.cancel}
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={() => onOk(draft != null ? normalizeHex(draft) || hex : hex)}
        >
          {labels.ok}
        </Button>
      </div>
    </div>
  );
};

export default ColorPicker;
