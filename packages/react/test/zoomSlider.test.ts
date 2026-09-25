import {
  positionToZoom,
  stepZoom,
  zoomToPosition,
} from "../src/components/ZoomControl/slider";

describe("zoom slider scale (Excel)", () => {
  it("puts 100% in the middle, 10% and 400% at the ends", () => {
    expect(zoomToPosition(100)).toBe(0.5);
    expect(zoomToPosition(10)).toBe(0);
    expect(zoomToPosition(400)).toBe(1);
    expect(zoomToPosition(55)).toBeCloseTo(0.25);
    expect(zoomToPosition(250)).toBeCloseTo(0.75);
    // out of range: clamped
    expect(zoomToPosition(5)).toBe(0);
    expect(zoomToPosition(900)).toBe(1);
  });

  it("maps positions back to whole percents, snapping near the middle", () => {
    expect(positionToZoom(0)).toBe(10);
    expect(positionToZoom(1)).toBe(400);
    expect(positionToZoom(0.75)).toBe(250);
    expect(positionToZoom(0.25)).toBe(55);
    // 100px track: within 4px of the centre snaps to 100%
    expect(positionToZoom(0.53, 100)).toBe(100);
    expect(positionToZoom(0.47, 100)).toBe(100);
    expect(positionToZoom(0.56, 100)).toBe(136);
    for (let p = 0; p <= 400; p += 7) {
      const z = Math.max(10, p);
      expect(positionToZoom(zoomToPosition(z))).toBe(Math.min(400, z));
    }
  });

  it("steps by 10% like Excel's − / + buttons", () => {
    expect(stepZoom(100, 1)).toBe(110);
    expect(stepZoom(100, -1)).toBe(90);
    expect(stepZoom(115, 1)).toBe(120);
    expect(stepZoom(115, -1)).toBe(110);
    expect(stepZoom(10, -1)).toBe(10);
    expect(stepZoom(400, 1)).toBe(400);
  });
});
