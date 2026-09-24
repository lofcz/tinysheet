import {
  canvasThemes,
  getCanvasTheme,
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

  test("light theme keeps cell text colours unchanged", () => {
    expect(resolveCellTextColor({ theme: "light" }, "#000000")).toBe("#000000");
    expect(resolveCellTextColor({}, "rgb(51, 51, 51)")).toBe("rgb(51, 51, 51)");
    expect(resolveCellTextColor({}, undefined, "#000000")).toBe("#000000");
  });

  test("dark theme maps automatic / near-black text to the theme colour", () => {
    const dark = { theme: "dark" };
    const text = canvasThemes.dark.cellText;
    expect(resolveCellTextColor(dark, undefined)).toBe(text);
    expect(resolveCellTextColor(dark, "#000000")).toBe(text);
    expect(resolveCellTextColor(dark, "black")).toBe(text);
    expect(resolveCellTextColor(dark, "rgb(51, 51, 51)")).toBe(text);
  });

  test("dark theme keeps explicit colours and text on light fills", () => {
    const dark = { theme: "dark" };
    expect(resolveCellTextColor(dark, "rgb(255, 0, 0)")).toBe("rgb(255, 0, 0)");
    expect(resolveCellTextColor(dark, "#436eee")).toBe("#436eee");
    // black text on a yellow fill stays black
    expect(resolveCellTextColor(dark, "#000000", "#ffd700")).toBe("#000000");
    expect(resolveCellTextColor(dark, undefined, "#ffffff")).toBe("#000000");
    // near-black text on a dark fill becomes readable
    expect(resolveCellTextColor(dark, "#000000", "#202020")).toBe(
      canvasThemes.dark.cellText
    );
  });
});
