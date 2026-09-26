/**
 * Format › Shape Effects and WordArt Styles › Text Effects (Excel): the
 * submenus Preset, Shadow, Glow, Soft Edges, Bevel, 3-D Rotation (and
 * Reflection for text), each a gallery of variations previewed on the
 * chart while the pointer rests on a tile.
 */
import React from "react";
import {
  CHART_ACCENTS,
  CHART_BEVEL_PRESETS,
  CHART_EFFECT_PRESETS,
  CHART_GLOW_SIZES,
  CHART_REFLECTION_PRESETS,
  CHART_ROTATION_PRESETS,
  CHART_SHADOW_PRESETS,
  CHART_SOFT_EDGES,
} from "@lofcz/tinysheet-core";
import type {
  Chart,
  ChartEffects,
  ChartShadow,
  ChartToolsLocale,
} from "@lofcz/tinysheet-core";
import type { MenuItem } from "../ui";
import { setChartPreview } from "./chartPreview";
import { variant } from "./chartGalleries";
import { elementEffects, updateEffects } from "./chartTools";

type Tile = {
  id: string;
  label: string;
  style: React.CSSProperties;
  /** The new effects (undefined: remove that kind). */
  apply: (e: ChartEffects) => ChartEffects;
  selected?: boolean;
};

const PT = 96 / 72;

function shadowCss(s: ChartShadow, text: boolean): React.CSSProperties {
  const rad = (s.dir * Math.PI) / 180;
  const k = 0.6;
  const dx = Math.round(Math.cos(rad) * s.dist * PT * k * 10) / 10;
  const dy = Math.round(Math.sin(rad) * s.dist * PT * k * 10) / 10;
  const blur = Math.round(s.blur * PT * k);
  const alpha = 1 - (s.transparency ?? 0.6);
  const color = s.color
    ? `${s.color}${Math.round(alpha * 255)
        .toString(16)
        .padStart(2, "0")}`
    : `rgba(0,0,0,${alpha})`;
  if (text) return { textShadow: `${dx}px ${dy}px ${blur}px ${color}` };
  if (s.kind === "inner") {
    return { boxShadow: `inset ${dx}px ${dy}px ${blur + 2}px ${color}` };
  }
  if (s.kind === "perspective") {
    return {
      boxShadow: `${dx * 1.6}px ${dy * 1.6}px ${blur + 3}px ${color}`,
    };
  }
  return { boxShadow: `${dx}px ${dy}px ${blur}px ${color}` };
}

/** CSS of a 3-D rotation preset's tile (a rough perspective view). */
function rotationCss(id: string): React.CSSProperties {
  const table: Record<string, string> = {
    isometricLeftDown: "rotateX(45deg) rotateZ(-45deg)",
    isometricRightUp: "rotateX(45deg) rotateZ(45deg)",
    isometricTopUp: "rotateX(55deg) rotateZ(45deg)",
    isometricBottomDown: "rotateX(-45deg) rotateZ(45deg)",
    obliqueTopLeft: "skew(-15deg, -15deg)",
    obliqueTopRight: "skew(15deg, 15deg)",
    obliqueBottomLeft: "skew(15deg, -15deg)",
    obliqueBottomRight: "skew(-15deg, 15deg)",
    perspectiveLeft: "perspective(40px) rotateY(25deg)",
    perspectiveRight: "perspective(40px) rotateY(-25deg)",
    perspectiveBelow: "perspective(40px) rotateX(-25deg)",
    perspectiveAbove: "perspective(40px) rotateX(25deg)",
  };
  const fallback = id.startsWith("perspective")
    ? "perspective(40px) rotateX(15deg) rotateY(-15deg)"
    : "rotateX(35deg) rotateY(25deg)";
  return { transform: table[id] ?? fallback };
}

const BEVEL_CSS: React.CSSProperties = {
  boxShadow:
    "inset 2px 2px 3px rgba(255,255,255,0.8), inset -2px -2px 3px rgba(0,0,0,0.35)",
};

function tilesItem(
  id: string,
  label: string,
  tiles: Tile[],
  opts: {
    chart: Chart;
    element: string;
    text: boolean;
    onApply: (recipe: (c: Chart) => void) => void;
    noneLabel?: string;
    columns?: number;
  }
): MenuItem {
  const { chart, element, text, onApply } = opts;
  const run =
    (apply: (e: ChartEffects) => ChartEffects) =>
    (c: Chart): void =>
      updateEffects(c, element, text, (e) => apply(e));
  const grid = (
    close: () => void,
    group: Tile[],
    header?: string,
    key = "g"
  ) => (
    <div key={key} className="ts-chart-fx-group">
      {header && <div className="ts-chart-fx-header">{header}</div>}
      <div
        className="ts-chart-fx-grid"
        style={{ gridTemplateColumns: `repeat(${opts.columns ?? 4}, 44px)` }}
        role="group"
        aria-label={header ?? label}
      >
        {group.map((tile) => (
          <button
            key={tile.id}
            type="button"
            className="ts-chart-fx-tile"
            data-effect={tile.id}
            aria-label={tile.label}
            aria-pressed={tile.selected || undefined}
            title={tile.label}
            onMouseEnter={() =>
              setChartPreview(variant(chart, run(tile.apply)))
            }
            onFocus={() => setChartPreview(variant(chart, run(tile.apply)))}
            onMouseLeave={() => setChartPreview(null)}
            onClick={() => {
              setChartPreview(null);
              onApply(run(tile.apply));
              close();
            }}
          >
            <span
              className={`ts-chart-fx-swatch${
                text ? " ts-chart-fx-swatch--text" : ""
              }`}
              style={tile.style}
            >
              {text ? "A" : null}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
  return {
    id,
    label,
    children: [
      {
        type: "custom",
        id: `${id}-tiles`,
        render: (close) => (
          <div className="ts-chart-fx-menu" data-testid={`chart-fx-${id}`}>
            {opts.noneLabel && (
              <button
                type="button"
                className="ts-chart-fx-none"
                onMouseEnter={() =>
                  setChartPreview(
                    variant(
                      chart,
                      run((e) =>
                        id === "preset" ? {} : { ...e, [id]: undefined }
                      )
                    )
                  )
                }
                onMouseLeave={() => setChartPreview(null)}
                onClick={() => {
                  setChartPreview(null);
                  onApply(
                    run((e) => {
                      // No Presets clears every effect (Excel)
                      if (id === "preset") return {};
                      const next = { ...e };
                      delete (next as Record<string, unknown>)[id];
                      delete next.preset;
                      return next;
                    })
                  );
                  close();
                }}
              >
                {opts.noneLabel}
              </button>
            )}
            {groupsOf(tiles).map((g, i) =>
              grid(close, g.tiles, g.header, `g${i}`)
            )}
          </div>
        ),
      },
    ],
  };
}

/** Tiles grouped by their `header` marker (the first tile of a group). */
function groupsOf(tiles: (Tile & { header?: string })[]) {
  const out: { header?: string; tiles: Tile[] }[] = [];
  tiles.forEach((tile) => {
    if (tile.header || out.length === 0) {
      out.push({ header: tile.header, tiles: [] });
    }
    out[out.length - 1].tiles.push(tile);
  });
  return out;
}

/**
 * The Shape Effects / Text Effects menu of an element (`text`: the Text
 * Effects of WordArt Styles).
 */
export function effectsMenu(
  t: ChartToolsLocale,
  chart: Chart,
  element: string,
  text: boolean,
  onApply: (recipe: (c: Chart) => void) => void,
  caps: { bevel?: boolean; preset?: boolean } = {}
): MenuItem[] {
  const f = t.format;
  const current = elementEffects(chart, element, text) ?? {};
  const opts = { chart, element, text, onApply };
  const items: MenuItem[] = [];

  if (!text && caps.preset) {
    items.push(
      tilesItem(
        "preset",
        f.preset,
        CHART_EFFECT_PRESETS.map((p, i) => ({
          id: `preset-${i + 1}`,
          label: f.presetN.replace("{n}", String(i + 1)),
          selected: current.preset === i + 1,
          style: {
            ...(p.shadow ? shadowCss(p.shadow, false) : {}),
            ...(p.bevel ? BEVEL_CSS : {}),
            ...(p.rotation3d ? rotationCss(p.rotation3d) : {}),
          },
          apply: () => ({ ...p }),
        })),
        { ...opts, noneLabel: f.noPreset }
      )
    );
  }

  const shadowTiles: (Tile & { header?: string })[] = [];
  CHART_SHADOW_PRESETS.forEach((g) =>
    g.items.forEach((item, i) =>
      shadowTiles.push({
        id: item.id,
        label: item.label,
        header: i === 0 ? f[g.group] : undefined,
        selected:
          !!current.shadow &&
          current.shadow.kind === item.value.kind &&
          current.shadow.dir === item.value.dir &&
          current.shadow.dist === item.value.dist,
        style: shadowCss(item.value, text),
        apply: (e) => ({ ...e, preset: undefined, shadow: item.value }),
      })
    )
  );
  items.push(
    tilesItem("shadow", f.shadow, shadowTiles, {
      ...opts,
      noneLabel: f.noShadow,
      columns: 3,
    })
  );

  if (text) {
    items.push(
      tilesItem(
        "reflection",
        f.reflection,
        CHART_REFLECTION_PRESETS.map((r) => ({
          id: r.id,
          label: r.label,
          style: {
            WebkitBoxReflect: `below ${r.value.dist ?? 0}px linear-gradient(transparent ${Math.round(
              (1 - (r.value.size ?? 0.5)) * 100
            )}%, rgba(0,0,0,0.4))`,
          } as React.CSSProperties,
          apply: (e) => ({ ...e, reflection: r.value }),
        })),
        { ...opts, noneLabel: f.noReflection, columns: 3 }
      )
    );
  }

  const glowTiles: (Tile & { header?: string })[] = [];
  CHART_GLOW_SIZES.forEach((size) =>
    CHART_ACCENTS.forEach((a, i) =>
      glowTiles.push({
        id: `glow-${size}-${i + 1}`,
        label: f.glowLabel
          .replace("{size}", String(size))
          .replace("{color}", a.label),
        header:
          size === CHART_GLOW_SIZES[0] && i === 0
            ? f.glowVariations
            : undefined,
        selected:
          current.glow?.size === size && current.glow?.color === a.color,
        style: text
          ? {
              textShadow: `0 0 ${Math.round(size * 0.6)}px ${a.color}`,
            }
          : {
              boxShadow: `0 0 ${Math.round(size * 0.5)}px ${Math.round(
                size * 0.25
              )}px ${a.color}99`,
            },
        apply: (e) => ({
          ...e,
          preset: undefined,
          glow: { color: a.color, size },
        }),
      })
    )
  );
  items.push(
    tilesItem("glow", f.glow, glowTiles, {
      ...opts,
      noneLabel: f.noGlow,
      columns: 6,
    })
  );

  if (!text) {
    items.push(
      tilesItem(
        "softEdges",
        f.softEdges,
        CHART_SOFT_EDGES.map((size) => ({
          id: `soft-${size}`,
          label: f.points.replace("{n}", String(size)),
          selected: current.softEdges === size,
          style: {
            boxShadow: `inset 0 0 ${Math.min(14, size * 1.2)}px ${Math.min(
              10,
              size
            )}px var(--ts-surface, #fff)`,
          },
          apply: (e) => ({ ...e, preset: undefined, softEdges: size }),
        })),
        { ...opts, noneLabel: f.noSoftEdges, columns: 3 }
      )
    );
  }

  if (text || caps.bevel) {
    items.push(
      tilesItem(
        "bevel",
        f.bevel,
        CHART_BEVEL_PRESETS.map((b) => ({
          id: `bevel-${b.id}`,
          label: b.label,
          selected: current.bevel?.preset === b.id,
          style: text
            ? {
                textShadow:
                  "-1px -1px 0 rgba(255,255,255,0.7), 1px 1px 1px rgba(0,0,0,0.5)",
              }
            : BEVEL_CSS,
          apply: (e) => ({ ...e, preset: undefined, bevel: b.value }),
        })),
        { ...opts, noneLabel: f.noBevel }
      )
    );
  }

  const rotationTiles: (Tile & { header?: string })[] = [];
  CHART_ROTATION_PRESETS.forEach((g) =>
    g.items.forEach((item, i) =>
      rotationTiles.push({
        id: item.id,
        label: item.label,
        header: i === 0 ? f[g.group] : undefined,
        selected: current.rotation3d === item.id,
        style: rotationCss(item.id),
        apply: (e) => ({ ...e, preset: undefined, rotation3d: item.id }),
      })
    )
  );
  items.push(
    tilesItem("rotation3d", f.rotation3d, rotationTiles, {
      ...opts,
      noneLabel: f.noRotation,
    })
  );
  return items;
}
