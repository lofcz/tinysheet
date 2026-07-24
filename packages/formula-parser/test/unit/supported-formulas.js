import SUPPORTED_FORMULAS from "../../src/supported-formulas";

describe(".SUPPORTED_FORMULAS", () => {
  it("should be defined", () => {
    expect(SUPPORTED_FORMULAS.length).toBeGreaterThan(0);
    expect(SUPPORTED_FORMULAS).toContain("SUM");
  });
});
