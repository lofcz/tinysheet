import {
  canvasThemes,
  getCanvasTheme,
  resolveBorderColor,
  resolveCellFill,
  resolveCellTextColor,
  resolveTheme,
} from "../../src/theme";

describe("theme", () => {
  test("resolveTheme", () => {
    expect(resolveTheme(undefined, true)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("auto", true)).toBe("dark");
    expect(resolveTheme("auto", false)).toBe("light");
  });

  test("getCanvasTheme falls back to light", () => {
    expect(getCanvasTheme(undefined)).toBe(canvasThemes.light);
    expect(getCanvasTheme({})).toBe(canvasThemes.light);
    expect(getCanvasTheme({ theme: "dark" })).toBe(canvasThemes.dark);
    expect(getCanvasTheme("dark")).toBe(canvasThemes.dark);
  });

  test("light theme keeps cell colours unchanged", () => {
    expect(resolveCellTextColor({ theme: "light" }, "#000000")).toBe("#000000");
    expect(resolveCellTextColor({}, "rgb(51, 51, 51)")).toBe("rgb(51, 51, 51)");
    expect(resolveCellTextColor({}, undefined, "#000000")).toBe("#000000");
    expect(resolveCellTextColor({}, "#1f4e79")).toBe("#1f4e79");
    expect(resolveCellFill({}, "#f2f2f2")).toBe("#f2f2f2");
    expect(resolveCellFill({}, "#ffffff")).toBe("#ffffff");
    expect(resolveCellFill({}, undefined)).toBeUndefined();
    expect(resolveBorderColor({}, "#000000")).toBe("#000000");
  });

  test("dark theme maps automatic / near-black text to the theme colour", () => {
    const dark = { theme: "dark" };
    const text = canvasThemes.dark.cellText;
    expect(resolveCellTextColor(dark, undefined)).toBe(text);
    expect(resolveCellTextColor(dark, "#000000")).toBe(text);
    expect(resolveCellTextColor(dark, "black")).toBe(text);
    expect(resolveCellTextColor(dark, "rgb(51, 51, 51)")).toBe(text);
  });

  test("dark theme keeps explicit colours and text on strong fills", () => {
    const dark = { theme: "dark" };
    expect(resolveCellTextColor(dark, "rgb(255, 0, 0)")).toBe("rgb(255, 0, 0)");
    expect(resolveCellTextColor(dark, "#436eee")).toBe("#436eee");
    // black text on a gold / yellow highlight stays black
    expect(resolveCellTextColor(dark, "#000000", "#ffd700")).toBe("#000000");
    expect(resolveCellTextColor(dark, undefined, "#ffff00")).toBe("#000000");
    // near-black text on a dark fill becomes readable
    expect(resolveCellTextColor(dark, "#000000", "#202020")).toBe(
      canvasThemes.dark.cellText
    );
  });

  test("dark theme turns very light fills into dark tints of their hue", () => {
    const dark = { theme: "dark" };
    // white and light greys: dark neutral bands, lighter ones stay lighter
    const white = resolveCellFill(dark, "#ffffff");
    const grey = resolveCellFill(dark, "#f2f2f2");
    expect(white).toBe("#1c1c1c");
    expect(grey).toMatch(/^#([0-9a-f]{2})\1\1$/);
    expect(parseInt(grey.slice(1, 3), 16)).toBeGreaterThan(0x1c);
    expect(parseInt(grey.slice(1, 3), 16)).toBeLessThan(0x40);
    // a pastel keeps its hue (blue stays bluish)
    const blue = resolveCellFill(dark, "#ddebf7");
    const [r, , b] = [1, 3, 5].map((i) => parseInt(blue.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r);
    expect(b).toBeLessThan(0x80);
    // strong fills are kept
    expect(resolveCellFill(dark, "#ffff00")).toBe("#ffff00");
    expect(resolveCellFill(dark, "#4472c4")).toBe("#4472c4");
    expect(resolveCellFill(dark, "rgb(255, 192, 0)")).toBe("rgb(255, 192, 0)");
    // automatic text on a converted fill is light
    expect(resolveCellTextColor(dark, undefined, "#ffffff")).toBe(
      canvasThemes.dark.cellText
    );
    expect(resolveCellTextColor(dark, "#000000", "#f2f2f2")).toBe(
      canvasThemes.dark.cellText
    );
  });

  test("dark theme lightens dark coloured text, keeping its hue", () => {
    const dark = { theme: "dark" };
    const red = resolveCellTextColor(dark, "#9c0006");
    const [r, g] = [1, 3].map((i) => parseInt(red.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(0xc0);
    expect(r).toBeGreaterThan(g);
    const navy = resolveCellTextColor(dark, "#1f4e79");
    expect(parseInt(navy.slice(5, 7), 16)).toBeGreaterThan(0x90);
  });

  test("dark theme draws near-black borders light", () => {
    expect(resolveBorderColor({ theme: "dark" }, "#000000")).toBe(
      canvasThemes.dark.borderAutomatic
    );
    expect(resolveBorderColor({ theme: "dark" }, "#ff0000")).toBe("#ff0000");
  });
});
