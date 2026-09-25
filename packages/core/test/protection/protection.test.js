import { createHash, webcrypto } from "crypto";
import {
  checkProtection,
  checkCellIsLocked,
  checkWorkbookStructure,
  protectSheet,
  unprotectSheet,
  setAllowEditRanges,
  unlockEditRange,
  protectWorkbook,
  unprotectWorkbook,
  isWorkbookStructureProtected,
  nextUnlockedCell,
  isCellContentHidden,
  isAllowEdit,
  deleteSelectedCellText,
  insertRowCol,
  deleteRowCol,
  hideSelected,
  handleBold,
  handleMerge,
  sortSelection,
  createFilter,
  addSheet,
  deleteSheet,
  renameSheet,
  moveSheet,
  duplicateSheet,
  hideSheets,
  checkProtectionSelectLockedOrUnLockedCells,
  protectionLocale,
  parseSqref,
} from "../../src";
import {
  sha512,
  iteratedPasswordHash,
  hashProtectionPassword,
  verifyProtectionPassword,
  legacyPasswordHash,
} from "../../src/modules/protectionHash";
import { makeSheet, makeCtx, putValue } from "../formula/recalc-helpers";

function setup() {
  const s1 = makeSheet("Sheet1", "s1", 6, 6, 0);
  const s2 = makeSheet("Sheet2", "s2", 3, 3, 1);
  const ctx = makeCtx([s1, s2]);
  ctx.config = s1.config ?? {};
  s1.config = ctx.config;
  ctx.luckysheetCellUpdate = [];
  return { ctx, s1, s2 };
}

function select(ctx, r1, c1, r2 = r1, c2 = c1) {
  ctx.luckysheet_select_save = [
    { row: [r1, r2], column: [c1, c2], row_focus: r1, column_focus: c1 },
  ];
}

const message = protectionLocale({ lang: "en" }).protectedMessage;

describe("password hashes", () => {
  it("sha512 matches node's implementation", () => {
    ["", "abc", "a".repeat(111), "a".repeat(112), "ü€".repeat(300)].forEach(
      (text) => {
        const bytes = new Uint8Array(Buffer.from(text));
        expect(Buffer.from(sha512(bytes)).toString("hex")).toBe(
          createHash("sha512").update(bytes).digest("hex")
        );
      }
    );
  });

  function nodeExcelHash(password, salt, spinCount) {
    let h = createHash("sha512")
      .update(Buffer.concat([salt, Buffer.from(password, "utf16le")]))
      .digest();
    for (let i = 0; i < spinCount; i += 1) {
      const it = Buffer.alloc(4);
      it.writeUInt32LE(i, 0);
      h = createHash("sha512")
        .update(Buffer.concat([h, it]))
        .digest();
    }
    return h.toString("base64");
  }

  it("computes Excel's iterated SHA-512 with and without WebCrypto", async () => {
    const salt = Buffer.from("0123456789abcdef");
    const expected = nodeExcelHash("Secret", salt, 1000);
    const js = await iteratedPasswordHash(
      "Secret",
      new Uint8Array(salt),
      "SHA-512",
      1000
    );
    expect(Buffer.from(js).toString("base64")).toBe(expected);

    const saved = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    Object.defineProperty(globalThis, "crypto", {
      value: webcrypto,
      configurable: true,
    });
    try {
      const web = await iteratedPasswordHash(
        "Secret",
        new Uint8Array(salt),
        "SHA-512",
        1000
      );
      expect(Buffer.from(web).toString("base64")).toBe(expected);
      const stored = await hashProtectionPassword("pw", 50);
      expect(stored.algorithmName).toBe("SHA-512");
      expect(stored.spinCount).toBe(50);
      expect(JSON.stringify(stored)).not.toContain('"pw"');
      await expect(verifyProtectionPassword(stored, "pw")).resolves.toBe(true);
      await expect(verifyProtectionPassword(stored, "PW")).resolves.toBe(false);
    } finally {
      if (saved) Object.defineProperty(globalThis, "crypto", saved);
      else delete globalThis.crypto;
    }
  });

  it("verifies stored hashes: Excel's, legacy and Luckysheet plain text", async () => {
    const salt = Buffer.from("fedcba9876543210");
    const stored = {
      algorithmName: "SHA-512",
      hashValue: nodeExcelHash("abc", salt, 100),
      saltValue: salt.toString("base64"),
      spinCount: 100,
    };
    await expect(verifyProtectionPassword(stored, "abc")).resolves.toBe(true);
    await expect(verifyProtectionPassword(stored, "abd")).resolves.toBe(false);
    expect(legacyPasswordHash("test")).toBe("CBEB");
    expect(legacyPasswordHash("password")).toBe("83AF");
    await expect(
      verifyProtectionPassword({ legacyHash: "CBEB" }, "test")
    ).resolves.toBe(true);
    await expect(
      verifyProtectionPassword({ legacyHash: "cbeb" }, "tset")
    ).resolves.toBe(false);
    await expect(
      verifyProtectionPassword({ password: "x", algorithmName: "None" }, "x")
    ).resolves.toBe(true);
    await expect(verifyProtectionPassword({}, "anything")).resolves.toBe(true);
  });
});

describe("sheet protection", () => {
  it("locks cells by default and lets unlocked cells be edited", () => {
    const { ctx, s1 } = setup();
    putValue(s1, 0, 0, 1);
    s1.data[1][1] = { v: 2, lo: 0 };
    expect(checkCellIsLocked(ctx, 0, 0, "s1")).toBe(false);
    protectSheet(ctx, "s1");
    expect(ctx.config.authority.sheet).toBe(1);
    expect(checkCellIsLocked(ctx, 0, 0, "s1")).toBe(true);
    expect(checkCellIsLocked(ctx, 5, 5, "s1")).toBe(true); // empty cell
    expect(checkCellIsLocked(ctx, 1, 1, "s1")).toBe(false);

    select(ctx, 0, 0);
    expect(isAllowEdit(ctx)).toBe(false);
    expect(checkProtection(ctx, "editCells")).toBe(false);
    expect(ctx.protectionAlert.message).toBe(message);
    const { seq } = ctx.protectionAlert;
    expect(deleteSelectedCellText(ctx)).toBe("protected");
    expect(ctx.protectionAlert.seq).toBe(seq + 1);
    expect(s1.data[0][0].v).toBe(1);

    select(ctx, 1, 1);
    expect(isAllowEdit(ctx)).toBe(true);
    expect(checkProtection(ctx, "editCells")).toBe(true);
    // other sheets are not affected
    expect(checkProtection(ctx, "editCells", null, "s2")).toBe(true);
  });

  it("enforces the allowed actions", () => {
    const { ctx, s1 } = setup();
    putValue(s1, 0, 0, 1);
    protectSheet(ctx, "s1", { allow: { insertRows: true, formatCells: true } });
    select(ctx, 0, 0);

    // formatting allowed on locked cells
    handleBold(ctx, {});
    expect(s1.data[0][0].bl).toBe(1);

    insertRowCol(ctx, {
      type: "row",
      index: 0,
      count: 1,
      direction: "lefttop",
      id: "s1",
    });
    expect(s1.data.length).toBe(7);

    ctx.protectionAlert = undefined;
    insertRowCol(ctx, {
      type: "column",
      index: 0,
      count: 1,
      direction: "lefttop",
      id: "s1",
    });
    expect(s1.data[0].length).toBe(6);
    expect(ctx.protectionAlert.message).toBe(message);

    deleteRowCol(ctx, { type: "row", start: 3, end: 3, id: "s1" });
    expect(s1.data.length).toBe(7);

    expect(hideSelected(ctx, "row")).toBe("protected");
    ctx.protectionAlert = undefined;
    handleMerge(ctx, "merge-all");
    expect(ctx.protectionAlert).toBeDefined();
    ctx.protectionAlert = undefined;
    createFilter(ctx);
    expect(ctx.protectionAlert).toBeDefined();
    ctx.protectionAlert = undefined;
    sortSelection(ctx, true);
    expect(ctx.protectionAlert).toBeDefined();
  });

  it("deleting rows needs the permission and no locked cells", () => {
    const { ctx, s1 } = setup();
    for (let c = 0; c < 6; c += 1) s1.data[2][c] = { lo: 0 };
    protectSheet(ctx, "s1", { allow: { deleteRows: true } });
    deleteRowCol(ctx, { type: "row", start: 1, end: 1, id: "s1" });
    expect(s1.data.length).toBe(6);
    deleteRowCol(ctx, { type: "row", start: 2, end: 2, id: "s1" });
    expect(s1.data.length).toBe(5);
  });

  it("uses the sheet's hint text and unprotects", () => {
    const { ctx } = setup();
    protectSheet(ctx, "s1", { hintText: "Read only!" });
    select(ctx, 0, 0);
    checkProtection(ctx, "formatCells");
    expect(ctx.protectionAlert.message).toBe("Read only!");
    unprotectSheet(ctx, "s1");
    expect(ctx.config.authority).toBeUndefined();
    expect(checkProtection(ctx, "formatCells")).toBe(true);
  });

  it("keeps password hashes, never passwords", () => {
    const { ctx } = setup();
    protectSheet(ctx, "s1", {
      password: {
        algorithmName: "SHA-512",
        hashValue: "aGFzaA==",
        saltValue: "c2FsdA==",
        spinCount: 100000,
        password: "plain",
      },
    });
    expect(ctx.config.authority.hashValue).toBe("aGFzaA==");
    expect(ctx.config.authority.password).toBeUndefined();
    unprotectSheet(ctx, "s1");
    expect(ctx.config.authority).toBeUndefined();
  });

  it("selection restrictions", () => {
    const { ctx, s1 } = setup();
    s1.data[0][0] = { lo: 0 };
    protectSheet(ctx, "s1", { allow: { selectLockedCells: false } });
    expect(checkProtectionSelectLockedOrUnLockedCells(ctx, 0, 0, "s1")).toBe(
      true
    );
    expect(checkProtectionSelectLockedOrUnLockedCells(ctx, 1, 0, "s1")).toBe(
      false
    );
  });

  it("hides formulas of hidden cells on protected sheets", () => {
    const { ctx, s1 } = setup();
    s1.data[0][0] = { v: 2, f: "=1+1", hi: 1 };
    expect(isCellContentHidden(ctx, 0, 0)).toBe(false);
    protectSheet(ctx, "s1");
    expect(isCellContentHidden(ctx, 0, 0)).toBe(true);
    expect(isCellContentHidden(ctx, 0, 1)).toBe(false);
  });

  it("Tab moves between unlocked cells", () => {
    const { ctx, s1 } = setup();
    s1.data[1][2] = { lo: 0 };
    s1.data[4][0] = { lo: 0 };
    expect(nextUnlockedCell(ctx, 0, 0)).toBeNull();
    protectSheet(ctx, "s1");
    expect(nextUnlockedCell(ctx, 0, 0)).toEqual({ r: 1, c: 2 });
    expect(nextUnlockedCell(ctx, 1, 2)).toEqual({ r: 4, c: 0 });
    expect(nextUnlockedCell(ctx, 4, 0)).toEqual({ r: 1, c: 2 });
    expect(nextUnlockedCell(ctx, 1, 2, true)).toEqual({ r: 4, c: 0 });
  });
});

describe("allow edit ranges", () => {
  it("parses references", () => {
    expect(parseSqref("$A$1:$B$2 D5")).toEqual([
      { row: [0, 1], column: [0, 1] },
      { row: [4, 4], column: [3, 3] },
    ]);
    expect(parseSqref("nope")).toBeNull();
  });

  it("opens ranges without a password and asks for the others", () => {
    const { ctx } = setup();
    expect(
      setAllowEditRanges(ctx, "s1", [
        { name: "Open", sqref: "$A$1:$B$2" },
        { name: "Secret", sqref: "$D$1", hashValue: "x", saltValue: "y" },
      ])
    ).toBe(true);
    protectSheet(ctx, "s1");
    expect(ctx.config.authority.allowRangeList).toHaveLength(2);
    // ranges can't be changed while protected
    expect(setAllowEditRanges(ctx, "s1", [])).toBe(false);

    select(ctx, 1, 1);
    expect(checkProtection(ctx, "editCells")).toBe(true);
    select(ctx, 0, 3);
    expect(checkProtection(ctx, "editCells")).toBe(false);
    expect(ctx.protectionUnlock).toEqual({ sheetId: "s1", name: "Secret" });
    unlockEditRange(ctx, "s1", "Secret");
    expect(ctx.protectionUnlock).toBeUndefined();
    expect(checkProtection(ctx, "editCells")).toBe(true);
    select(ctx, 0, 4);
    expect(checkProtection(ctx, "editCells")).toBe(false);
  });
});

describe("workbook structure protection", () => {
  it("blocks sheet operations", () => {
    const { ctx } = setup();
    expect(checkWorkbookStructure(ctx)).toBe(true);
    protectWorkbook(ctx, { legacyHash: "CBEB" });
    expect(isWorkbookStructureProtected(ctx)).toBe(true);
    expect(ctx.luckysheetfile[0].workbookProtection.lockStructure).toBe(true);

    addSheet(ctx, { generateSheetId: () => "s3" });
    expect(ctx.luckysheetfile).toHaveLength(2);
    deleteSheet(ctx, "s2");
    expect(ctx.luckysheetfile).toHaveLength(2);
    expect(renameSheet(ctx, "s2", "Renamed")).toBeNull();
    expect(ctx.luckysheetfile[1].name).toBe("Sheet2");
    moveSheet(ctx, "s2", "s1");
    expect(ctx.luckysheetfile[1].order).toBe(1);
    expect(duplicateSheet(ctx, "s1")).toBeNull();
    expect(hideSheets(ctx, ["s2"])).toBe(false);
    expect(ctx.protectionAlert.message).toBe(
      protectionLocale(ctx).workbookProtectedMessage
    );

    unprotectWorkbook(ctx);
    expect(isWorkbookStructureProtected(ctx)).toBe(false);
    expect(renameSheet(ctx, "s2", "Renamed")).toBeNull();
    expect(ctx.luckysheetfile[1].name).toBe("Renamed");
  });
});
