import { contextFactory, selectionFactory } from "../factories/context";
import {
  handleAccountingFormat,
  handleCurrencyFormat,
  handleNumberDecrease,
  handleNumberIncrease,
  handlePercentageFormat,
} from "../../src/modules/toolbar";
import { getFlowdata } from "../../src/context";

describe("number format", () => {
  const getContext = () =>
    contextFactory({
      luckysheet_select_save: selectionFactory([1, 1], [1, 1], 1, 1),
      luckysheetfile: [
        {
          id: "id_1",
          data: [
            [null, null],
            [null, { m: "5", v: "5" }],
          ],
        },
      ],
    });
  const cellInput = document.createElement("div");
  const ctx = getContext();

  // Excel: Ctrl+Shift+$ applies Currency with negatives in parentheses.
  test("currency", async () => {
    handleCurrencyFormat(ctx, cellInput);
    const flowdata = getFlowdata(ctx);
    expect(flowdata[1][1].m).toBe("$5.00 ");
  });

  test("accounting (ribbon currency button)", async () => {
    handleAccountingFormat(ctx, cellInput);
    const flowdata = getFlowdata(ctx);
    expect(flowdata[1][1].m).toBe(" $5.00 ");
  });

  // Excel's Percent Style button: 0%.
  test("percentage", async () => {
    handlePercentageFormat(ctx, cellInput);
    const flowdata = getFlowdata(ctx);
    expect(flowdata[1][1].m).toBe("500%");
  });

  test("number increase", async () => {
    handleNumberIncrease(ctx, cellInput);
    const flowdata = getFlowdata(ctx);
    expect(flowdata[1][1].m).toBe("500.0%");
  });

  test("number decrease", async () => {
    handleNumberDecrease(ctx, cellInput);
    handleNumberDecrease(ctx, cellInput);
    const flowdata = getFlowdata(ctx);
    expect(flowdata[1][1].m).toBe("500%");
    expect(flowdata[1][1].ct.fa).toBe("0%");
  });
});
