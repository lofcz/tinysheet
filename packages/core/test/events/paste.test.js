import { contextFactory, selectionFactory } from "../factories/context";
import { pastedHtmlFactory } from "../factories/pasted-html";
import { handlePaste } from "../../src/events/paste";
import { selectionCache } from "../../src";

describe("paste", () => {
  const getContext = () =>
    contextFactory({
      luckysheet_select_save: selectionFactory([0, 0], [0, 0], 0, 0),
    });

  test("handlePaste", async () => {
    const contents = new Array(10);
    const ctx = getContext();
    ctx.luckysheetfile[0].data = [
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];

    document.execCommand = jest.fn();
    const newEvent = new Event("paste");
    const clipboardData = {};
    clipboardData.getData = jest.fn().mockImplementation(() => "abcd");
    clipboardData.files = [];
    newEvent.clipboardData = clipboardData;
    handlePaste(ctx, newEvent);
    expect(document.execCommand).toHaveBeenCalledWith(
      "insertText",
      false,
      "abcd"
    );
    expect(newEvent.clipboardData.getData).toHaveBeenCalledWith("text/plain");

    ctx.luckysheet_copy_save = { copyRange: [] };
    selectionCache.isPasteAction = true;
    clipboardData.getData = jest.fn().mockImplementation((p) => {
      contents.push(p);
      return pastedHtmlFactory("WPS");
    });
    handlePaste(ctx, newEvent);
    expect(newEvent.clipboardData.getData).toHaveBeenCalledWith("text/html");
    expect(ctx.luckysheetfile[0].data[0][0].v).toBe(1);
    expect(ctx.luckysheetfile[0].data[3][0].v).toBe(6);
    // WPS writes 12pt fonts, an explicit colour, bold via font-weight and a
    // solid fill via background + mso-pattern; black text is "automatic"
    // and text-align:general leaves the alignment to Excel's General rule
    expect(ctx.luckysheetfile[0].data[0][2]).toEqual({
      bl: 1,
      ct: {
        fa: "General",
        t: "n",
      },
      fc: "#ed7d31",
      ff: "宋体",
      fs: 12,
      m: "3",
      v: 3,
      vt: 0,
    });
    expect(ctx.luckysheetfile[0].data[1][0]).toEqual({
      bg: "#ed7d31",
      ct: {
        fa: "General",
        t: "n",
      },
      ff: "宋体",
      fs: 12,
      m: "4",
      v: 4,
      vt: 0,
    });
    expect(ctx.luckysheetfile[0].data[2][0].un).toBe(1);
    expect(ctx.luckysheetfile[0].data[3][0].it).toBe(1);
  });
});
