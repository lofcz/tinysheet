import {
  makeContext,
  input,
  pressDelete,
  value,
  values,
  cell,
} from "../formula/helpers";
import { groupValuesRefresh } from "../../src/modules/formula";
import {
  placeImageInCell,
  placeImageInActiveCell,
  setCellImageAltText,
  convertCellImageToFloating,
  convertFloatingImageToCell,
} from "../../src/modules/cellImageEdit";
import { sortSelection } from "../../src/modules/sort";
import { isImageValue } from "../../src/modules/cellImage";
import { dropCellCache, updateDropCell } from "../../src/modules/dropCell";
import { handlePasteSpecial } from "../../src/events/paste";
import * as clip from "../clipboard/helpers";

const URL = "https://example.com/logo.png";
const URL2 = "https://example.com/mark.png";
// a script URL, spelled so linters do not flag it as eval
const SCRIPT_URL = ["javascript", "alert(1)"].join(":");

function place(ctx, r, c, img) {
  const ok = placeImageInCell(ctx, r, c, img);
  groupValuesRefresh(ctx);
  return ok;
}

describe("IMAGE() results", () => {
  test("a formula cell holds the picture and shows its alt text", () => {
    const ctx = makeContext();
    input(ctx, "A1", `=IMAGE("${URL}","Logo",3,20,30)`);
    const a1 = cell(ctx, "A1");
    expect(a1.f).toBe(`=IMAGE("${URL}","Logo",3,20,30)`);
    expect(a1.img).toEqual({ src: URL, alt: "Logo", sizing: 3, h: 20, w: 30 });
    expect(a1.v).toBe("Logo");
    expect(a1.m).toBe("Logo");
  });

  test("invalid arguments are #VALUE! without a picture", () => {
    const ctx = makeContext();
    input(ctx, "A1", `=IMAGE("${SCRIPT_URL}")`);
    expect(value(ctx, "A1")).toBe("#VALUE!");
    expect(cell(ctx, "A1").img).toBeUndefined();
  });

  test("text functions and references see the alt text / the picture", () => {
    const ctx = makeContext();
    input(ctx, "A1", `=IMAGE("${URL}","Logo")`);
    input(ctx, "B1", "=LEN(A1)");
    input(ctx, "C1", '=A1&"!"');
    input(ctx, "D1", "=A1");
    expect(value(ctx, "B1")).toBe(4);
    expect(value(ctx, "C1")).toBe("Logo!");
    // =A1 returns the picture itself
    expect(cell(ctx, "D1").img).toEqual({ src: URL, alt: "Logo" });
    // dependents follow a changed picture
    input(ctx, "A1", `=IMAGE("${URL2}","Mark")`);
    expect(cell(ctx, "D1").img).toEqual({ src: URL2, alt: "Mark" });
    expect(value(ctx, "B1")).toBe(4);
    expect(value(ctx, "C1")).toBe("Mark!");
  });

  test("replacing the formula by a value drops the picture", () => {
    const ctx = makeContext();
    input(ctx, "A1", `=IMAGE("${URL}","Logo")`);
    input(ctx, "A1", "42");
    expect(value(ctx, "A1")).toBe(42);
    expect(cell(ctx, "A1").img).toBeUndefined();
    expect(cell(ctx, "A1").f).toBeUndefined();
  });

  test("arrays of pictures spill, and clear with their anchor", () => {
    const ctx = makeContext();
    input(ctx, "A1", URL);
    input(ctx, "A2", URL2);
    input(ctx, "B1", "one");
    input(ctx, "B2", "two");
    input(ctx, "D1", "=IMAGE(A1:A2,B1:B2)");
    expect(cell(ctx, "D1").img).toEqual({ src: URL, alt: "one" });
    expect(cell(ctx, "D2").img).toEqual({ src: URL2, alt: "two" });
    expect(cell(ctx, "D2").spillFrom).toEqual({ dr: 1, dc: 0 });
    expect(values(ctx, "D1", "D2")).toEqual([["one"], ["two"]]);
    // a formula reading a spilled picture gets it
    input(ctx, "F1", "=D2");
    expect(cell(ctx, "F1").img).toEqual({ src: URL2, alt: "two" });
    input(ctx, "B2", "deux");
    expect(cell(ctx, "D2").img.alt).toBe("deux");
    pressDelete(ctx, "D1");
    expect(cell(ctx, "D1")?.img).toBeUndefined();
    expect(cell(ctx, "D2")?.img).toBeUndefined();
  });

  test("a placed picture blocks a spill", () => {
    const ctx = makeContext();
    place(ctx, 1, 3, { src: URL });
    input(ctx, "D1", "=SEQUENCE(3)");
    expect(value(ctx, "D1")).toBe("#SPILL!");
  });
});

describe("placed pictures", () => {
  test("Place in Cell stores the picture as the cell's value", () => {
    const ctx = makeContext();
    input(ctx, "B1", "=LEN(A1)");
    ctx.luckysheet_select_save = [{ row: [0, 0], column: [0, 0] }];
    expect(placeImageInActiveCell(ctx, { src: URL, alt: "Logo" })).toBe(true);
    groupValuesRefresh(ctx);
    const a1 = cell(ctx, "A1");
    expect(a1.img).toEqual({ src: URL, alt: "Logo" });
    expect(a1.f).toBeUndefined();
    expect(a1.v).toBe("Logo");
    expect(value(ctx, "B1")).toBe(4);
  });

  test("replaces a formula and keeps the cell's format", () => {
    const ctx = makeContext();
    input(ctx, "A1", "=1+1");
    cell(ctx, "A1").bg = "#ff0000";
    place(ctx, 0, 0, { src: URL });
    expect(cell(ctx, "A1").f).toBeUndefined();
    expect(cell(ctx, "A1").bg).toBe("#ff0000");
    expect(cell(ctx, "A1").img).toEqual({ src: URL });
  });

  test("rejects unsafe sources and read-only cells", () => {
    const ctx = makeContext();
    expect(place(ctx, 0, 0, { src: SCRIPT_URL })).toBe(false);
    expect(place(ctx, 0, 0, { src: "file:///etc/passwd" })).toBe(false);
    ctx.allowEdit = false;
    expect(place(ctx, 0, 0, { src: URL })).toBe(false);
    expect(cell(ctx, "A1")).toBeNull();
  });

  test("typing over a picture and Delete remove it", () => {
    const ctx = makeContext();
    place(ctx, 0, 0, { src: URL, alt: "Logo" });
    input(ctx, "A1", "hello");
    expect(cell(ctx, "A1").img).toBeUndefined();
    expect(value(ctx, "A1")).toBe("hello");
    place(ctx, 0, 0, { src: URL });
    pressDelete(ctx, "A1");
    expect(cell(ctx, "A1")?.img).toBeUndefined();
  });

  test("alt text can be edited", () => {
    const ctx = makeContext();
    place(ctx, 0, 0, { src: URL, alt: "Logo" });
    input(ctx, "B1", '=A1&""');
    expect(setCellImageAltText(ctx, 0, 0, "Company logo")).toBe(true);
    groupValuesRefresh(ctx);
    expect(cell(ctx, "A1").img).toEqual({ src: URL, alt: "Company logo" });
    expect(value(ctx, "A1")).toBe("Company logo");
    expect(value(ctx, "B1")).toBe("Company logo");
    expect(setCellImageAltText(ctx, 0, 0, "")).toBe(true);
    expect(cell(ctx, "A1").img).toEqual({ src: URL });
    // formula pictures take their alt text from the formula
    input(ctx, "C1", `=IMAGE("${URL}")`);
    expect(setCellImageAltText(ctx, 0, 2, "x")).toBe(false);
  });

  test("pictures sort with their rows", () => {
    const ctx = makeContext();
    input(ctx, "A1", "b");
    input(ctx, "A2", "a");
    place(ctx, 0, 1, { src: URL, alt: "B" });
    place(ctx, 1, 1, { src: URL2, alt: "A" });
    ctx.luckysheet_select_save = [{ row: [0, 1], column: [0, 1] }];
    sortSelection(ctx, true);
    expect(values(ctx, "A1", "A2")).toEqual([["a"], ["b"]]);
    expect(cell(ctx, "B1").img.src).toBe(URL2);
    expect(cell(ctx, "B2").img.src).toBe(URL);
  });
});

describe("Place over Cells / Place in Cell", () => {
  function geometry(ctx) {
    ctx.visibledatarow = Array.from({ length: 12 }, (_, i) => (i + 1) * 20);
    ctx.visibledatacolumn = Array.from({ length: 8 }, (_, i) => (i + 1) * 74);
    ctx.zoomRatio = 1;
  }

  test("a cell picture becomes a floating picture over its cell and back", () => {
    const ctx = makeContext();
    geometry(ctx);
    place(ctx, 2, 1, { src: URL, alt: "Logo" });
    const id = convertCellImageToFloating(ctx, 2, 1);
    groupValuesRefresh(ctx);
    expect(id).toBeTruthy();
    expect(cell(ctx, "B3")).toBeNull();
    const floating = ctx.insertedImgs.find((i) => i.id === id);
    expect(floating).toMatchObject({
      src: URL,
      left: 74,
      top: 40,
      alt: "Logo",
    });
    expect(ctx.luckysheetfile[0].images).toHaveLength(1);
    expect(ctx.activeImg).toBe(id);

    // move it and place it back into the cell under its top-left corner
    floating.left = 150;
    floating.top = 65;
    expect(convertFloatingImageToCell(ctx)).toEqual({ r: 3, c: 2 });
    groupValuesRefresh(ctx);
    expect(ctx.insertedImgs).toHaveLength(0);
    expect(ctx.activeImg).toBeUndefined();
    expect(cell(ctx, "C4").img).toEqual({ src: URL, alt: "Logo" });
  });

  test("the formula of an IMAGE() cell is removed when placed over cells", () => {
    const ctx = makeContext();
    geometry(ctx);
    input(ctx, "A1", `=IMAGE("${URL}")`);
    input(ctx, "B1", "=ISTEXT(A1)");
    expect(convertCellImageToFloating(ctx, 0, 0)).toBeTruthy();
    groupValuesRefresh(ctx);
    expect(cell(ctx, "A1")).toBeNull();
    expect(value(ctx, "B1")).toBe(false);
  });
});

describe("copy, paste and fill", () => {
  beforeEach(() => clip.mockClipboard());

  test("a placed picture copies and pastes like a value", () => {
    const ctx = makeContext();
    place(ctx, 0, 0, { src: URL, alt: "Logo" });
    clip.copy(ctx, "A1");
    // copy as text is the alt text
    expect(clip.written.text.trim()).toBe("Logo");
    clip.paste(ctx, "C3");
    expect(cell(ctx, "C3").img).toEqual({ src: URL, alt: "Logo" });
    expect(value(ctx, "C3")).toBe("Logo");
  });

  test("Paste Values turns an IMAGE() result into a placed picture", () => {
    const ctx = makeContext();
    input(ctx, "A1", `=IMAGE("${URL}","Logo")`);
    clip.copy(ctx, "A1");
    clip.select(ctx, "B2");
    handlePasteSpecial(ctx, { paste: "values" });
    groupValuesRefresh(ctx);
    expect(cell(ctx, "B2").f).toBeUndefined();
    expect(cell(ctx, "B2").img).toEqual({ src: URL, alt: "Logo" });
  });

  test("filling copies the picture instead of extending a series", () => {
    const ctx = makeContext();
    ctx.visibledatarow = Array.from({ length: 12 }, (_, i) => (i + 1) * 20);
    ctx.visibledatacolumn = Array.from({ length: 8 }, (_, i) => (i + 1) * 74);
    ctx.luckysheetCellUpdate = [];
    place(ctx, 0, 0, { src: URL, alt: "Logo 1" });
    dropCellCache.copyRange = { row: [0, 0], column: [0, 0] };
    dropCellCache.applyRange = { row: [1, 2], column: [0, 0] };
    dropCellCache.direction = "down";
    dropCellCache.applyType = "2";
    dropCellCache.ctrlKey = false;
    updateDropCell(ctx);
    groupValuesRefresh(ctx);
    expect(cell(ctx, "A2").img).toEqual({ src: URL, alt: "Logo 1" });
    expect(value(ctx, "A3")).toBe("Logo 1");
  });
});

describe("image values", () => {
  test("are recognised by duck type", () => {
    expect(isImageValue({ type: "image", src: URL })).toBe(true);
    expect(isImageValue({ v: 1 })).toBe(false);
  });
});
