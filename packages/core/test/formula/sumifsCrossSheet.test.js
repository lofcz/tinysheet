import { makeContext, input, value } from "./helpers";

test("SUMIFS combines cross-sheet ranges, local criteria and wildcard codes", () => {
  const ctx = makeContext();
  ctx.luckysheetfile[1].name = "Podrobný rozpočet";
  for (const [a1, v] of Object.entries({
    A1: "I.1.1",
    A2: "V.1.1",
    A3: "I.2.1",
    C1: "MŠMT",
    C2: "MŠMT",
    C3: "Zřizovatel",
    E1: 21200000,
    E2: 8100000,
    E3: 5200000,
  }))
    input(ctx, a1, String(v), "id_2");
  input(ctx, "A11", "MŠMT");
  input(
    ctx,
    "B11",
    "=SUMIFS('Podrobný rozpočet'!$E$1:$E$3,'Podrobný rozpočet'!$C$1:$C$3,$A11,'Podrobný rozpočet'!$A$1:$A$3,\"I.*\")"
  );
  input(
    ctx,
    "C11",
    "=SUMIFS('Podrobný rozpočet'!$E$1:$E$3,'Podrobný rozpočet'!$C$1:$C$3,$A11,'Podrobný rozpočet'!$A$1:$A$3,\"V.*\")"
  );
  expect(value(ctx, "B11")).toBe(21200000);
  expect(value(ctx, "C11")).toBe(8100000);
});
