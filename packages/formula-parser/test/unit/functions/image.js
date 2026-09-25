import {
  createImageValue,
  imageValueText,
  isAllowedImageSource,
  isImageValue,
} from "../../../src/helper/image";
import { workbook } from "../../integration/parsing/batch2/workbook.mjs";

const URL = "https://example.com/a.png";
const DATA = "data:image/png;base64,iVBORw0KGgo=";
// a script URL, spelled so linters do not flag it as eval
const SCRIPT_URL = ["javascript", "alert(1)"].join(":");

/** Image values as plain comparable objects. */
function img(value) {
  if (Array.isArray(value)) return value.map(img);
  return isImageValue(value) ? { ...value } : value;
}

describe("IMAGE", () => {
  const evaluate = workbook([
    [URL, "Logo", 3],
    ["https://example.com/b.png", "Mark", 1],
    ["ftp://example.com/c.png", "", "x"],
  ]);

  it("returns an image value with its source, alt text and sizing", () => {
    expect(img(evaluate(`IMAGE("${URL}")`))).toEqual({
      type: "image",
      src: URL,
      alt: "",
      sizing: 0,
    });
    expect(img(evaluate(`IMAGE(A1,B1,1)`))).toEqual({
      type: "image",
      src: URL,
      alt: "Logo",
      sizing: 1,
    });
    expect(img(evaluate(`IMAGE("${DATA}","dot",3,20,30)`))).toEqual({
      type: "image",
      src: DATA,
      alt: "dot",
      sizing: 3,
      h: 20,
      w: 30,
    });
    // only one custom dimension: the other follows the aspect ratio
    expect(img(evaluate(`IMAGE(A1,,3,40)`))).toMatchObject({ h: 40 });
  });

  it("is #VALUE! for bad arguments", () => {
    expect(evaluate("IMAGE()")).toBe("#VALUE!");
    expect(evaluate('IMAGE("")')).toBe("#VALUE!");
    expect(evaluate("IMAGE(42)")).toBe("#VALUE!");
    expect(evaluate('IMAGE("logo.png")')).toBe("#VALUE!");
    expect(evaluate(`IMAGE("${SCRIPT_URL}")`)).toBe("#VALUE!");
    expect(evaluate('IMAGE("file:///etc/passwd")')).toBe("#VALUE!");
    expect(evaluate("IMAGE(A3)")).toBe("#VALUE!");
    expect(evaluate(`IMAGE(A1,"",4)`)).toBe("#VALUE!");
    expect(evaluate(`IMAGE(A1,"",-1)`)).toBe("#VALUE!");
    expect(evaluate(`IMAGE(A1,"",1.5)`)).toBe("#VALUE!");
    expect(evaluate(`IMAGE(A1,"",C3)`)).toBe("#VALUE!");
    // custom size needs a positive height or width
    expect(evaluate(`IMAGE(A1,"",3)`)).toBe("#VALUE!");
    expect(evaluate(`IMAGE(A1,"",3,0,10)`)).toBe("#VALUE!");
    expect(evaluate(`IMAGE(A1,"",3,10,-1)`)).toBe("#VALUE!");
    expect(evaluate("IMAGE(1/0)")).toBe("#DIV/0!");
  });

  it("is lifted over arrays (spills one picture per source)", () => {
    const out = img(evaluate("IMAGE(A1:A3,B1:B3)"));
    expect(out).toEqual([
      [{ type: "image", src: URL, alt: "Logo", sizing: 0 }],
      [
        {
          type: "image",
          src: "https://example.com/b.png",
          alt: "Mark",
          sizing: 0,
        },
      ],
      ["#VALUE!"],
    ]);
  });

  it("reads as its alt text in text contexts", () => {
    expect(evaluate(`IMAGE(A1,"Logo")&"!"`)).toBe("Logo!");
    expect(evaluate(`LEN(IMAGE(A1,"Logo"))`)).toBe(4);
    expect(evaluate(`UPPER(IMAGE(A1,"Logo"))`)).toBe("LOGO");
    expect(evaluate(`CONCAT(IMAGE(A1,"a"),IMAGE(A1,"b"))`)).toBe("ab");
    expect(evaluate(`TEXTJOIN("-",TRUE,IMAGE(A1:A2,B1:B2))`)).toBe("Logo-Mark");
  });

  it("flows through lookups and array functions", () => {
    expect(img(evaluate(`INDEX(IMAGE(A1:A2,B1:B2),2,1)`))).toMatchObject({
      alt: "Mark",
    });
    expect(
      img(evaluate(`XLOOKUP("Mark",B1:B2,IMAGE(A1:A2,B1:B2))`))
    ).toMatchObject({ src: "https://example.com/b.png" });
    expect(img(evaluate(`IF(TRUE,IMAGE(A1),0)`))).toMatchObject({ src: URL });
  });

  it("is ignored by numeric aggregates", () => {
    expect(evaluate(`SUM(1,C2,IMAGE(A1:A2))`)).toBe(2);
    expect(evaluate(`COUNTA(IMAGE(A1:A2))`)).toBe(2);
    expect(evaluate(`ISTEXT(IMAGE(A1))`)).toBe(false);
  });
});

describe("image value helpers", () => {
  it("recognises image values and their text form", () => {
    const v = createImageValue({ src: URL, alt: "x" });
    expect(isImageValue(v)).toBe(true);
    expect(isImageValue({ type: "image", src: URL })).toBe(true);
    expect(isImageValue({ type: "image" })).toBe(false);
    expect(isImageValue("x")).toBe(false);
    expect(isImageValue(null)).toBe(false);
    expect(String(v)).toBe("x");
    expect(imageValueText(v)).toBe("x");
    expect(imageValueText(createImageValue({ src: URL }))).toBe("");
  });

  it("allows only http(s) and data:image sources", () => {
    expect(isAllowedImageSource("https://a.b/c.png")).toBe(true);
    expect(isAllowedImageSource("HTTP://a.b")).toBe(true);
    expect(isAllowedImageSource(DATA)).toBe(true);
    expect(isAllowedImageSource("data:image/svg+xml;utf8,<svg/>")).toBe(true);
    expect(isAllowedImageSource("data:text/html,<b>")).toBe(false);
    expect(isAllowedImageSource("https://")).toBe(false);
    expect(isAllowedImageSource("//cdn.example.com/a.png")).toBe(false);
    expect(isAllowedImageSource("blob:https://a.b/1")).toBe(false);
    expect(isAllowedImageSource(SCRIPT_URL)).toBe(false);
    expect(isAllowedImageSource(3)).toBe(false);
  });
});
