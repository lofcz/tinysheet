import { makeContext, input, value, cell } from "../formula/helpers";
import {
  validateCellData,
  getDropdownList,
  setDataVerification,
  removeDataVerification,
  getDataVerificationItem,
  getDataVerificationRules,
  deleteDataVerificationRule,
  getInvalidDataCells,
  setInvalidDataCircles,
  isShowingInvalidDataCircles,
  checkDataVerificationInput,
  acceptDataVerificationAlert,
  dismissDataVerificationAlert,
  confirmDataVerification,
  initDataVerificationDialog,
  clearDataVerificationDialog,
  setCellPlaceholder,
  cellsToRanges,
  getFailureText,
  isCellDataValid,
} from "../../src/modules/dataVerification";
import { locale } from "../../src/locale";
import { defaultContext } from "../../src/context";
import { handlePasteByClick } from "../../src/events/paste";
import { dropCellCache, updateDropCell } from "../../src/modules/dropCell";

function fill(ctx, cells) {
  Object.entries(cells).forEach(([a1, text]) => input(ctx, a1, text));
}

function setupCtx() {
  const ctx = makeContext({ rows: 12, cols: 6 });
  ctx.dataVerification = {
    ...defaultContext({}).dataVerification,
    dataRegulation: undefined,
  };
  ctx.lang = "en";
  return ctx;
}

const rule = (item) => ({
  type2: "",
  value1: "",
  value2: "",
  prohibitInput: true,
  hintShow: false,
  hintValue: "",
  ...item,
});

describe("list validation", () => {
  test("literal list, trimmed and case-insensitive", () => {
    const ctx = setupCtx();
    const item = rule({ type: "dropdown", value1: "Yes, No,Maybe" });
    expect(getDropdownList(ctx, item.value1)).toEqual(["Yes", "No", "Maybe"]);
    expect(validateCellData(ctx, item, "no")).toBe(true);
    expect(validateCellData(ctx, item, "Nope")).toBe(false);
    // blanks pass unless "Ignore blank" is off
    expect(validateCellData(ctx, item, "")).toBe(true);
    expect(validateCellData(ctx, { ...item, ignoreBlank: false }, "")).toBe(
      false
    );
  });

  test("list from a range (absolute, relative and other sheet)", () => {
    const ctx = setupCtx();
    fill(ctx, { E1: "red", E2: "green", E3: "red", E4: "10" });
    input(ctx, "A1", "blue", "id_2");
    expect(getDropdownList(ctx, "=$E$1:$E$4")).toEqual(["red", "green", "10"]);
    expect(getDropdownList(ctx, "E1:E2")).toEqual(["red", "green"]);
    expect(getDropdownList(ctx, "='My Sheet'!$A$1:$A$2")).toEqual(["blue"]);
    const item = rule({ type: "dropdown", value1: "=$E$1:$E$4" });
    expect(validateCellData(ctx, item, "GREEN")).toBe(true);
    expect(validateCellData(ctx, item, 10)).toBe(true);
    expect(validateCellData(ctx, item, "blue")).toBe(false);
  });

  test("list source from a formula", () => {
    const ctx = setupCtx();
    fill(ctx, { E1: "a", E2: "b", E3: "c" });
    expect(getDropdownList(ctx, "=OFFSET($E$1,1,0,2,1)")).toEqual(["b", "c"]);
    expect(getDropdownList(ctx, '={"x","y"}')).toEqual(["x", "y"]);
  });

  test("relative list source shifts from the rule's anchor", () => {
    const ctx = setupCtx();
    fill(ctx, { D1: "p", D2: "q", E1: "s", E2: "t" });
    setDataVerification(ctx, "A1:B1", {
      type: "dropdown",
      value1: "=D1:D2",
    });
    const b1 = getDataVerificationItem(ctx, 0, 1);
    expect(getDropdownList(ctx, b1.value1, 0, 1, b1.anchor)).toEqual([
      "s",
      "t",
    ]);
  });

  test("multi-select lists check every item", () => {
    const ctx = setupCtx();
    const item = rule({ type: "dropdown", type2: "true", value1: "a,b,c" });
    expect(validateCellData(ctx, item, "a,c")).toBe(true);
    expect(validateCellData(ctx, item, "a,d")).toBe(false);
  });
});

describe("numbers, dates, times and lengths", () => {
  const ctx = setupCtx();
  const check = (item, v) => validateCellData(ctx, rule(item), v, 0, 0);

  test("whole number with every operator", () => {
    const whole = (type2, value1, value2 = "") => ({
      type: "number_integer",
      type2,
      value1,
      value2,
    });
    expect(check(whole("between", "1", "10"), 5)).toBe(true);
    expect(check(whole("between", "1", "10"), 5.5)).toBe(false);
    expect(check(whole("between", "1", "10"), 11)).toBe(false);
    expect(check(whole("notBetween", "1", "10"), 11)).toBe(true);
    expect(check(whole("equal", "3"), 3)).toBe(true);
    expect(check(whole("notEqualTo", "3"), 3)).toBe(false);
    expect(check(whole("moreThanThe", "3"), 4)).toBe(true);
    expect(check(whole("lessThan", "3"), 3)).toBe(false);
    expect(check(whole("greaterOrEqualTo", "3"), 3)).toBe(true);
    expect(check(whole("lessThanOrEqualTo", "3"), 4)).toBe(false);
    expect(check(whole("equal", "3"), "abc")).toBe(false);
    expect(check(whole("equal", "3"), "3")).toBe(true);
  });

  test("decimal accepts integers too (Excel)", () => {
    const dec = {
      type: "number_decimal",
      type2: "between",
      value1: "0",
      value2: "1.5",
    };
    expect(check(dec, 1)).toBe(true);
    expect(check(dec, 1.25)).toBe(true);
    expect(check(dec, 2)).toBe(false);
  });

  test("dates, typed or as serials; formula bounds", () => {
    const date = {
      type: "date",
      type2: "between",
      value1: "2024-01-01",
      value2: "2024-12-31",
    };
    expect(check(date, 45306)).toBe(true); // 2024-01-15
    expect(check(date, "2024-06-01")).toBe(true);
    expect(check(date, "2025-01-01")).toBe(false);
    expect(check(date, "not a date")).toBe(false);
    expect(check({ ...date, type2: "earlierThan" }, "2023-12-31")).toBe(true);
    expect(check({ ...date, type2: "laterThan" }, "2023-12-31")).toBe(false);
    const withFormula = setupCtx();
    input(withFormula, "C1", "2024-03-01");
    expect(
      validateCellData(
        withFormula,
        rule({ type: "date", type2: "lessThan", value1: "=$C$1" }),
        "2024-02-01",
        0,
        0
      )
    ).toBe(true);
    expect(
      validateCellData(
        withFormula,
        rule({ type: "date", type2: "lessThan", value1: "=$C$1" }),
        "2024-04-01",
        0,
        0
      )
    ).toBe(false);
  });

  test("times", () => {
    const time = {
      type: "time",
      type2: "between",
      value1: "9:00",
      value2: "17:00",
    };
    expect(check(time, "10:30")).toBe(true);
    expect(check(time, 0.5)).toBe(true);
    expect(check(time, "18:00")).toBe(false);
    expect(check({ ...time, type2: "lessThan" }, "8:59")).toBe(true);
  });

  test("text length", () => {
    const len = {
      type: "text_length",
      type2: "lessThanOrEqualTo",
      value1: "3",
    };
    expect(check(len, "abc")).toBe(true);
    expect(check(len, "abcd")).toBe(false);
    expect(check(len, 1234)).toBe(false);
  });
});

describe("custom formula", () => {
  test("evaluates per cell with relative references", () => {
    const ctx = setupCtx();
    fill(ctx, { A1: "5", A2: "-1", B1: "10", B2: "10" });
    setDataVerification(ctx, "A1:A2", {
      type: "custom",
      value1: "=A1<B1",
      prohibitInput: true,
    });
    expect(isCellDataValid(ctx, 0, 0)).toBe(true);
    input(ctx, "B2", "-5");
    expect(isCellDataValid(ctx, 1, 0)).toBe(false);
    const item = getDataVerificationItem(ctx, 1, 0);
    expect(validateCellData(ctx, item, -10, 1, 0)).toBe(false); // uses cell
    // formula returning a number: nonzero is valid
    const num = rule({ type: "custom", value1: "=LEN(B1)" });
    expect(validateCellData(ctx, num, "x", 0, 0)).toBe(true);
    const err = rule({ type: "custom", value1: "=1/0" });
    expect(validateCellData(ctx, err, "x", 0, 0)).toBe(false);
  });

  test("works on a frozen context (canvas rendering)", () => {
    const ctx = setupCtx();
    fill(ctx, { A1: "5", B1: "10" });
    const item = rule({ type: "custom", value1: "=A1<B1" });
    const frozen = Object.freeze({ ...ctx });
    expect(validateCellData(frozen, item, 5, 0, 0)).toBe(true);
  });
});

describe("error alert styles on input", () => {
  test("Stop blocks invalid input", () => {
    const ctx = setupCtx();
    setDataVerification(ctx, "A1", {
      type: "number_integer",
      type2: "between",
      value1: "1",
      value2: "10",
      prohibitInput: true,
      errorStyle: "stop",
      errorTitle: "Oops",
      errorMessage: "1 to 10 please",
    });
    input(ctx, "A1", "50");
    expect(value(ctx, "A1")).toBeUndefined();
    expect(ctx.dataVerificationAlert).toMatchObject({
      r: 0,
      c: 0,
      value: "50",
      style: "stop",
      title: "Oops",
      message: "1 to 10 please",
    });
    dismissDataVerificationAlert(ctx);
    expect(ctx.dataVerificationAlert).toBeUndefined();
    expect(value(ctx, "A1")).toBeUndefined();
    input(ctx, "A1", "5");
    expect(value(ctx, "A1")).toBe(5);
  });

  test("Warning and Information allow continuing", () => {
    const ctx = setupCtx();
    setDataVerification(ctx, "A1:A2", {
      type: "dropdown",
      value1: "a,b",
      prohibitInput: true,
      errorStyle: "warning",
    });
    input(ctx, "A1", "zzz");
    expect(ctx.dataVerificationAlert.style).toBe("warning");
    // the default message describes the rule
    expect(ctx.dataVerificationAlert.message).toMatch(/drop-down/);
    acceptDataVerificationAlert(ctx);
    expect(value(ctx, "A1")).toBe("zzz");
    expect(ctx.dataVerificationAlert).toBeUndefined();
    // the accepted cell is now invalid
    expect(getInvalidDataCells(ctx)).toEqual([{ r: 0, c: 0 }]);
  });

  test("formulas are checked by their result", () => {
    const ctx = setupCtx();
    setDataVerification(ctx, "A1", {
      type: "number_integer",
      type2: "lessThan",
      value1: "10",
      prohibitInput: true,
    });
    input(ctx, "A1", "=2+3");
    expect(value(ctx, "A1")).toBe(5);
    input(ctx, "A1", "=20");
    expect(ctx.dataVerificationAlert).toBeTruthy();
  });

  test("without an error alert invalid values are accepted", () => {
    const ctx = setupCtx();
    setDataVerification(ctx, "A1", {
      type: "number_integer",
      type2: "lessThan",
      value1: "10",
      prohibitInput: false,
    });
    expect(checkDataVerificationInput(ctx, 0, 0, "99")).toBe(true);
    input(ctx, "A1", "99");
    expect(value(ctx, "A1")).toBe(99);
  });

  test("failure texts for new types", () => {
    const ctx = setupCtx();
    expect(
      getFailureText(ctx, rule({ type: "custom", value1: "=A1>0" }))
    ).toMatch(/=A1>0/);
    expect(
      getFailureText(
        ctx,
        rule({ type: "time", type2: "lessThan", value1: "9:00" })
      )
    ).toMatch(/less than 9:00/);
  });
});

describe("circles, rules and the dialog", () => {
  test("circle invalid data lists invalid cells", () => {
    const ctx = setupCtx();
    fill(ctx, { A1: "5", A2: "50", A3: "7" });
    setDataVerification(ctx, "A1:A4", {
      type: "number_integer",
      type2: "lessThan",
      value1: "10",
    });
    expect(getInvalidDataCells(ctx)).toEqual([{ r: 1, c: 0 }]);
    setInvalidDataCircles(ctx, true);
    expect(isShowingInvalidDataCircles(ctx)).toBe(true);
    expect(isShowingInvalidDataCircles(ctx, "id_2")).toBe(false);
    setInvalidDataCircles(ctx, false);
    expect(isShowingInvalidDataCircles(ctx)).toBe(false);
  });

  test("rules group cells into ranges; delete a rule", () => {
    const ctx = setupCtx();
    setDataVerification(ctx, "A1:B3,D1", { type: "dropdown", value1: "x" });
    setDataVerification(ctx, "C5", { type: "custom", value1: "=TRUE" });
    const rules = getDataVerificationRules(ctx);
    expect(rules).toHaveLength(2);
    expect(rules[0].ranges).toEqual([
      { row: [0, 2], column: [0, 1] },
      { row: [0, 0], column: [3, 3] },
    ]);
    expect(rules[0].cellCount).toBe(7);
    deleteDataVerificationRule(ctx, rules[0].id);
    expect(getDataVerificationRules(ctx)).toHaveLength(1);
    removeDataVerification(ctx, "C5");
    expect(getDataVerificationRules(ctx)).toHaveLength(0);
  });

  test("cellsToRanges", () => {
    expect(
      cellsToRanges([
        { r: 0, c: 0 },
        { r: 0, c: 1 },
        { r: 1, c: 0 },
        { r: 1, c: 1 },
        { r: 2, c: 0 },
      ])
    ).toEqual([
      { row: [0, 1], column: [0, 1] },
      { row: [2, 2], column: [0, 0] },
    ]);
  });

  test("dialog: init from selection, confirm, edit a rule, clear", () => {
    const ctx = setupCtx();
    const { generalDialog, dataVerification } = locale(ctx);
    ctx.luckysheet_select_save = [
      { row: [0, 3], column: [0, 0], row_focus: 0, column_focus: 0 },
    ];
    initDataVerificationDialog(ctx);
    expect(ctx.dataVerification.dataRegulation).toMatchObject({
      type: "any",
      rangeTxt: "A1:A4",
      prohibitInput: true,
      errorStyle: "stop",
      ignoreBlank: true,
    });
    Object.assign(ctx.dataVerification.dataRegulation, {
      type: "dropdown",
      value1: "",
    });
    expect(confirmDataVerification(ctx, generalDialog, dataVerification)).toBe(
      false
    );
    expect(ctx.warnDialog).toBe(dataVerification.tooltipInfo1);
    ctx.dataVerification.dataRegulation.value1 = "a,b";
    expect(confirmDataVerification(ctx, generalDialog, dataVerification)).toBe(
      true
    );
    expect(getDataVerificationItem(ctx, 3, 0)).toMatchObject({
      type: "dropdown",
      value1: "a,b",
      anchor: { r: 0, c: 0 },
    });
    // edit the rule from the sidebar: move it to C1:C2
    const [r0] = getDataVerificationRules(ctx);
    initDataVerificationDialog(ctx, r0.id);
    expect(ctx.dataVerification.dataRegulation.rangeTxt).toBe("A1:A4");
    ctx.dataVerification.dataRegulation.rangeTxt = "C1:C2";
    confirmDataVerification(ctx, generalDialog, dataVerification);
    expect(getDataVerificationItem(ctx, 0, 0)).toBeNull();
    expect(getDataVerificationItem(ctx, 1, 2)).toMatchObject({
      anchor: { r: 0, c: 2 },
    });
    initDataVerificationDialog(ctx, getDataVerificationRules(ctx)[0].id);
    clearDataVerificationDialog(ctx);
    expect(getDataVerificationRules(ctx)).toHaveLength(0);
  });

  test("dialog checks bounds", () => {
    const ctx = setupCtx();
    const { generalDialog, dataVerification } = locale(ctx);
    initDataVerificationDialog(ctx);
    Object.assign(ctx.dataVerification.dataRegulation, {
      rangeTxt: "A1",
      type: "number_integer",
      type2: "between",
      value1: "10",
      value2: "1",
    });
    expect(confirmDataVerification(ctx, generalDialog, dataVerification)).toBe(
      false
    );
    expect(ctx.warnDialog).toBe(dataVerification.tooltipInfo4);
    Object.assign(ctx.dataVerification.dataRegulation, {
      value1: "=B1",
      value2: "=B2",
    });
    expect(confirmDataVerification(ctx, generalDialog, dataVerification)).toBe(
      true
    );
    Object.assign(ctx.dataVerification.dataRegulation, {
      type: "time",
      value1: "9:00",
      value2: "nope",
    });
    expect(confirmDataVerification(ctx, generalDialog, dataVerification)).toBe(
      false
    );
    Object.assign(ctx.dataVerification.dataRegulation, {
      type: "custom",
      value1: "",
    });
    expect(confirmDataVerification(ctx, generalDialog, dataVerification)).toBe(
      false
    );
  });
});

describe("validation travels with cells", () => {
  test("copy/paste carries validation", () => {
    const ctx = setupCtx();
    ctx.hooks = {};
    setDataVerification(ctx, "A1", { type: "dropdown", value1: "a,b" });
    input(ctx, "A1", "a");
    ctx.luckysheet_copy_save = {
      dataSheetId: "id_1",
      copyRange: [{ row: [0, 0], column: [0, 0] }],
      RowlChange: false,
      HasMC: false,
    };
    ctx.luckysheet_select_save = [
      { row: [4, 4], column: [2, 2], row_focus: 4, column_focus: 2 },
    ];
    const el = document.createElement("div");
    el.id = "fortune-copy-content";
    el.innerHTML =
      '<table class="fortune-copy-action-table"><tr><td>a</td></tr></table>';
    document.body.appendChild(el);
    try {
      handlePasteByClick(ctx, "");
    } finally {
      el.remove();
    }
    expect(getDataVerificationItem(ctx, 4, 2)).toMatchObject({
      type: "dropdown",
    });
    expect(value(ctx, "C5")).toBe("a");
  });

  test("fill carries validation", () => {
    const ctx = setupCtx();
    setDataVerification(ctx, "A1", { type: "dropdown", value1: "a,b" });
    input(ctx, "A1", "a");
    dropCellCache.copyRange = { row: [0, 0], column: [0, 0] };
    dropCellCache.applyRange = { row: [1, 3], column: [0, 0] };
    dropCellCache.direction = "down";
    dropCellCache.applyType = "1";
    dropCellCache.ctrlKey = false;
    updateDropCell(ctx);
    expect(getDataVerificationItem(ctx, 3, 0)).toMatchObject({
      type: "dropdown",
    });
  });
});

describe("placeholders", () => {
  test("set and clear a placeholder", () => {
    const ctx = setupCtx();
    setCellPlaceholder(ctx, "A1:A2", "Enter a name");
    expect(getDataVerificationItem(ctx, 1, 0)).toMatchObject({
      type: "any",
      placeholder: "Enter a name",
    });
    // an existing rule keeps its settings
    setDataVerification(ctx, "B1", { type: "dropdown", value1: "x" });
    setCellPlaceholder(ctx, "B1", "Pick one");
    expect(getDataVerificationItem(ctx, 0, 1)).toMatchObject({
      type: "dropdown",
      placeholder: "Pick one",
    });
    setCellPlaceholder(ctx, "A1:B1", "");
    expect(getDataVerificationItem(ctx, 0, 0)).toBeNull();
    expect(getDataVerificationItem(ctx, 0, 1).placeholder).toBeUndefined();
    expect(cell(ctx, "A1")).toBeNull();
  });
});
