/**
 * Shape text <-> the contentEditable editor's DOM.
 *
 * The editor holds one block (`div`) per paragraph and one `span` per run
 * with inline styles. Browsers add their own markup while editing (`<b>`,
 * `<i>`, `<u>`, `<font>`, `<br>`, nested divs), so reading back walks the
 * DOM and resolves each text node's formatting from its ancestors.
 */
import type {
  ShapeParagraph,
  ShapeText,
  ShapeTextAlign,
  ShapeTextRun,
} from "@lofcz/tinysheet-core";
import type React from "react";

export const DEFAULT_FONT_SIZE = 11;

const ALIGN_CSS: Record<ShapeTextAlign, React.CSSProperties["textAlign"]> = {
  l: "left",
  ctr: "center",
  r: "right",
  just: "justify",
};

export function alignToCss(align: ShapeTextAlign | undefined) {
  return align ? ALIGN_CSS[align] : undefined;
}

function cssToAlign(value: string): ShapeTextAlign | undefined {
  if (value === "left" || value === "start") return "l";
  if (value === "center") return "ctr";
  if (value === "right" || value === "end") return "r";
  if (value === "justify") return "just";
  return undefined;
}

/** CSS of a run, at `zoom` (font sizes are stored in pt). */
export function runStyle(
  run: Omit<ShapeTextRun, "text">,
  zoom = 1
): React.CSSProperties {
  const style: React.CSSProperties = {};
  if (run.b) style.fontWeight = "bold";
  if (run.i) style.fontStyle = "italic";
  const deco = [run.u ? "underline" : "", run.strike ? "line-through" : ""]
    .filter(Boolean)
    .join(" ");
  if (deco) style.textDecoration = deco;
  if (run.color) style.color = run.color;
  if (run.size) style.fontSize = `${(run.size * 4 * zoom) / 3}px`;
  if (run.font) style.fontFamily = run.font;
  return style;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cssText(style: React.CSSProperties) {
  const map: Record<string, string> = {
    fontWeight: "font-weight",
    fontStyle: "font-style",
    textDecoration: "text-decoration",
    color: "color",
    fontSize: "font-size",
    fontFamily: "font-family",
    textAlign: "text-align",
  };
  return Object.entries(style)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${map[k] ?? k}:${String(v).replace(/"/g, "'")}`)
    .join(";");
}

/**
 * Editor HTML for shape text. Font sizes are written in pt so the editor
 * can be read back without knowing the zoom (the editor is scaled with CSS
 * `zoom`-independent pt units times the zoom factor on its root).
 */
export function shapeTextToHtml(text: ShapeText | undefined): string {
  const paragraphs = text?.paragraphs?.length
    ? text.paragraphs
    : [{ runs: [] } as ShapeParagraph];
  return paragraphs
    .map((p) => {
      const align = alignToCss(p.align);
      const style = align ? ` style="text-align:${align}"` : "";
      const runs = p.runs.filter((r) => r.text !== "");
      const inner = runs.length
        ? runs
            .map((r) => {
              const { text: t, size, ...rest } = r;
              const css = cssText({
                ...runStyle(rest),
                ...(size ? { fontSize: `${size}pt` } : {}),
              });
              const lines = escapeHtml(t).split("\n").join("<br>");
              return css ? `<span style="${css}">${lines}</span>` : lines;
            })
            .join("")
        : "<br>";
      return `<div${style}>${inner}</div>`;
    })
    .join("");
}

function parseColor(value: string): string | undefined {
  if (!value) return undefined;
  const v = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    return `#${v
      .slice(1)
      .split("")
      .map((ch) => ch + ch)
      .join("")}`.toUpperCase();
  }
  const m = v.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    return `#${[m[1], m[2], m[3]]
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("")}`.toUpperCase();
  }
  return undefined;
}

const FONT_TAG_SIZES = [0, 7.5, 10, 12, 13.5, 18, 24, 36];

/** Size in pt of a CSS font-size ("12pt", "16px"), zoom-independent pt. */
function parseSize(value: string, zoom: number): number | undefined {
  const m = value.trim().match(/^([\d.]+)(pt|px)$/);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const pt = m[2] === "pt" ? n : (n * 3) / 4 / (zoom || 1);
  return Math.round(pt * 2) / 2;
}

type RunFormat = Omit<ShapeTextRun, "text">;

/** Formatting a text node inherits from its ancestors up to `root`. */
function formatOf(node: Node, root: HTMLElement, zoom: number): RunFormat {
  const fmt: RunFormat = {};
  const seen = new Set<keyof RunFormat>();
  const set = <K extends keyof RunFormat>(key: K, value: RunFormat[K]) => {
    if (seen.has(key)) return;
    seen.add(key);
    if (value !== undefined && value !== false) fmt[key] = value;
  };
  let el: Node | null = node.parentNode;
  while (el && el !== root && el.nodeType === 1) {
    const e = el as HTMLElement;
    const tag = e.tagName.toLowerCase();
    const { style } = e;
    if (style.fontWeight)
      set("b", style.fontWeight === "bold" || Number(style.fontWeight) >= 600);
    if (tag === "b" || tag === "strong") set("b", true);
    if (style.fontStyle) set("i", style.fontStyle === "italic");
    if (tag === "i" || tag === "em") set("i", true);
    const deco = `${style.textDecoration} ${style.textDecorationLine}`;
    if (/underline/.test(deco) || tag === "u") set("u", true);
    if (/line-through/.test(deco) || tag === "s" || tag === "strike")
      set("strike", true);
    const color =
      parseColor(style.color) ??
      (tag === "font" ? parseColor(e.getAttribute("color") ?? "") : undefined);
    if (color) set("color", color);
    if (style.fontSize) {
      const size = parseSize(style.fontSize, zoom);
      if (size) set("size", size);
    } else if (tag === "font" && e.getAttribute("size")) {
      const size = FONT_TAG_SIZES[Number(e.getAttribute("size"))];
      if (size) set("size", size);
    }
    const face =
      style.fontFamily || (tag === "font" ? e.getAttribute("face") : "");
    if (face) set("font", face.replace(/["']/g, ""));
    el = el.parentNode;
  }
  return fmt;
}

const BLOCK_TAGS = new Set(["div", "p", "li", "h1", "h2", "h3", "h4"]);

function sameFormat(a: RunFormat, b: RunFormat) {
  const keys: (keyof RunFormat)[] = [
    "b",
    "i",
    "u",
    "strike",
    "color",
    "size",
    "font",
  ];
  return keys.every((k) => a[k] === b[k]);
}

/**
 * Read the editor DOM back as shape text. `base` provides the settings
 * that are not in the DOM (vertical anchor, wrap).
 */
export function htmlToShapeText(
  root: HTMLElement,
  base: ShapeText | undefined,
  zoom = 1
): ShapeText {
  const paragraphs: ShapeParagraph[] = [];
  const rootAlign = cssToAlign(root.style.textAlign);
  let current: ShapeParagraph | null = null;
  const newParagraph = (align?: ShapeTextAlign) => {
    current = {
      runs: [],
      ...(align ?? rootAlign ? { align: align ?? rootAlign } : {}),
    };
    paragraphs.push(current);
    return current;
  };
  const addText = (text: string, fmt: RunFormat) => {
    const p = current ?? newParagraph();
    const last = p.runs[p.runs.length - 1];
    if (last && sameFormat(last, fmt)) last.text += text;
    else p.runs.push({ ...fmt, text });
  };
  const walk = (node: Node, blockAlign?: ShapeTextAlign) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        const value = (child.nodeValue ?? "").replace(/\u200b/g, "");
        if (value) addText(value, formatOf(child, root, zoom));
        return;
      }
      if (child.nodeType !== 1) return;
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag === "br") {
        // a trailing <br> only keeps an empty block open
        const isLast = el === el.parentNode?.lastChild;
        const blockParent =
          el.parentNode &&
          BLOCK_TAGS.has(
            (el.parentNode as HTMLElement).tagName?.toLowerCase?.() ?? ""
          );
        if (isLast && blockParent) return;
        newParagraph(blockAlign);
        return;
      }
      if (BLOCK_TAGS.has(tag)) {
        const align = cssToAlign(el.style.textAlign) ?? blockAlign;
        newParagraph(align);
        walk(el, align);
        current = null;
        return;
      }
      walk(el, blockAlign);
    });
  };
  walk(root);
  if (paragraphs.length === 0) newParagraph();
  return { ...(base ?? {}), paragraphs };
}
