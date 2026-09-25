import {
  cellImageRect,
  cellImageDecorator,
  clearCellImageCache,
  getCellImage,
  installCellImages,
  onCellImageLoad,
  setCellImageLoader,
  CELL_IMAGE_CACHE_SIZE,
} from "../../src/modules/cellImageDraw";
import {
  drawCellContentDecorators,
  hasCellDecorators,
} from "../../src/modules/extensions";

const box = { x: 10, y: 20, w: 104, h: 54 };
const SCRIPT_URL = ["javascript", "alert(1)"].join(":");
const flush = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

describe("cellImageRect", () => {
  test("fit keeps the aspect ratio and centres the picture", () => {
    // 200x50 into a 100x50 box (2px padding): 100 wide, 25 high
    expect(cellImageRect({}, 200, 50, box)).toEqual({
      x: 12,
      y: 20 + 2 + (50 - 25) / 2,
      w: 100,
      h: 25,
    });
  });

  test("fill stretches, original and custom use pixels times zoom", () => {
    expect(cellImageRect({ sizing: 1 }, 200, 50, box)).toEqual({
      x: 12,
      y: 22,
      w: 100,
      h: 50,
    });
    const original = cellImageRect({ sizing: 2 }, 40, 30, box, 2);
    expect([original.w, original.h]).toEqual([80, 60]);
    const custom = cellImageRect({ sizing: 3, h: 10, w: 30 }, 40, 30, box);
    expect([custom.w, custom.h]).toEqual([30, 10]);
    // only a height: the width follows the aspect ratio
    const tall = cellImageRect({ sizing: 3, h: 15 }, 40, 30, box);
    expect([tall.w, tall.h]).toEqual([20, 15]);
  });

  test("follows explicit cell alignment", () => {
    const left = cellImageRect({ sizing: 2 }, 10, 10, box, 1, 1, 1);
    expect([left.x, left.y]).toEqual([12, 22]);
    const right = cellImageRect({ sizing: 2 }, 10, 10, box, 1, "2", "2");
    expect([right.x, right.y]).toEqual([10 + 2 + 100 - 10, 20 + 2 + 50 - 10]);
  });
});

describe("cell image decorator", () => {
  let canvas;
  let g;
  let bitmap;
  let off;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    g = canvas.getContext("2d");
    bitmap = document.createElement("canvas");
    off = installCellImages();
  });

  afterEach(() => {
    off();
    setCellImageLoader(null);
  });

  const args = (cell) => ({
    ctx: { theme: "dark" },
    renderCtx: g,
    r: 0,
    c: 0,
    cell,
    ...box,
    zoom: 1,
  });

  test("is registered once and ignores cells without a picture", () => {
    expect(hasCellDecorators()).toBe(true);
    installCellImages();
    expect(drawCellContentDecorators(args({ v: 1 }))).toBe(false);
    expect(drawCellContentDecorators(args(null))).toBe(false);
  });

  test("draws a placeholder while loading, then the picture", async () => {
    let resolveLoad;
    setCellImageLoader(
      () =>
        new Promise((resolve) => {
          resolveLoad = resolve;
        })
    );
    const loaded = jest.fn();
    const stop = onCellImageLoad(loaded);
    const spy = jest.spyOn(g, "drawImage");
    const cell = { v: "Logo", img: { src: "https://example.com/a.png" } };

    expect(drawCellContentDecorators(args(cell))).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    expect(getCellImage(cell.img.src).status).toBe("loading");

    resolveLoad({ image: bitmap, width: 200, height: 50 });
    await flush();
    expect(loaded).toHaveBeenCalledWith(cell.img.src);
    expect(cellImageDecorator.drawContent(args(cell))).toBe(true);
    expect(spy).toHaveBeenCalledWith(bitmap, 12, 34.5, 100, 25);
    stop();
  });

  test("shows a broken picture when loading fails or the source is unsafe", async () => {
    setCellImageLoader(() => Promise.reject(new Error("404")));
    const loaded = jest.fn();
    const stop = onCellImageLoad(loaded);
    const cell = {
      v: "Logo",
      img: { src: "https://example.com/404.png", alt: "Logo" },
    };
    drawCellContentDecorators(args(cell));
    await flush();
    expect(getCellImage(cell.img.src).status).toBe("error");
    expect(loaded).toHaveBeenCalled();
    const text = jest.spyOn(g, "fillText");
    expect(drawCellContentDecorators(args(cell))).toBe(true);
    expect(text).toHaveBeenCalledWith(
      "Logo",
      expect.any(Number),
      expect.any(Number),
      expect.any(Number)
    );
    // never handed to the loader
    const loader = jest.fn(() => Promise.reject(new Error("x")));
    setCellImageLoader(loader);
    expect(getCellImage(SCRIPT_URL).status).toBe("error");
    expect(loader).not.toHaveBeenCalled();
    stop();
  });

  test("keeps a bounded number of pictures", () => {
    const loader = jest.fn(() => new Promise(() => {}));
    setCellImageLoader(loader);
    for (let i = 0; i < CELL_IMAGE_CACHE_SIZE + 5; i += 1) {
      getCellImage(`https://example.com/${i}.png`);
    }
    // the oldest entries were evicted: asking again loads again
    getCellImage("https://example.com/0.png");
    expect(loader).toHaveBeenCalledTimes(CELL_IMAGE_CACHE_SIZE + 6);
    // a recent one is still cached
    getCellImage(`https://example.com/${CELL_IMAGE_CACHE_SIZE + 4}.png`);
    expect(loader).toHaveBeenCalledTimes(CELL_IMAGE_CACHE_SIZE + 6);
    clearCellImageCache();
  });
});
