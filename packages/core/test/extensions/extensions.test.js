import {
  registerCellDecorator,
  drawCellContentDecorators,
  drawCellForegroundDecorators,
  hasCellDecorators,
  registerShortcut,
  runShortcut,
} from "../../src/modules/extensions";

const renderCtx = { save: jest.fn(), restore: jest.fn() };
const args = (cell) => ({
  ctx: {},
  renderCtx,
  r: 0,
  c: 0,
  cell,
  x: 0,
  y: 0,
  w: 10,
  h: 10,
  zoom: 1,
});

describe("cell decorators", () => {
  it("lets a decorator replace the content and unregisters cleanly", () => {
    expect(hasCellDecorators()).toBe(false);
    const drawn = [];
    const off = registerCellDecorator("test", {
      drawContent: ({ cell }) => {
        if (!cell?.img) return false;
        drawn.push("img");
        return true;
      },
      drawForeground: () => drawn.push("fg"),
    });
    expect(drawCellContentDecorators(args({ v: 1 }))).toBe(false);
    expect(drawCellContentDecorators(args({ img: true }))).toBe(true);
    drawCellForegroundDecorators(args(null));
    expect(drawn).toEqual(["img", "fg"]);
    off();
    expect(hasCellDecorators()).toBe(false);
  });
});

describe("shortcuts", () => {
  const key = (k, mods = {}) => ({
    key: k,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...mods,
  });

  it("matches key and modifiers, respecting editing mode", () => {
    const hits = [];
    const off = registerShortcut("flash", {
      key: "e",
      mod: true,
      handler: () => hits.push("flash"),
    });
    const offAny = registerShortcut("recalc", {
      key: "F9",
      when: "any",
      handler: () => hits.push("recalc"),
    });
    expect(runShortcut({}, key("e"), false)).toBe(false);
    expect(runShortcut({}, key("E", { ctrlKey: true }), false)).toBe(true);
    expect(runShortcut({}, key("e", { metaKey: true }), true)).toBe(false);
    expect(runShortcut({}, key("F9"), true)).toBe(true);
    expect(hits).toEqual(["flash", "recalc"]);
    off();
    offAny();
    expect(runShortcut({}, key("F9"), false)).toBe(false);
  });

  it("falls through when the handler returns false", () => {
    const off = registerShortcut("maybe", {
      key: "x",
      handler: () => false,
    });
    expect(runShortcut({}, key("x"), false)).toBe(false);
    off();
  });
});
