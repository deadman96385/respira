import { describe, expect, it } from "vitest";
import { preparePatternUpload } from "./prepareUpload";
import { encodeStitchesToPen } from "./encoder";
import { decodePenData } from "./decoder";
import { validatePenPlacement } from "./validate";
import type { PesPatternData } from "../import/pesImporter";

function pattern(): PesPatternData {
  const stitches = [
    [-100, -200, 0, 0],
    [100, -200, 0, 0],
    [100, 200, 0, 0],
    [-100, 200, 0, 0],
  ];
  const encoded = encodeStitchesToPen(stitches);
  const penData = new Uint8Array(encoded.penBytes);
  return {
    stitches,
    penData,
    penStitches: decodePenData(penData),
    bounds: encoded.bounds,
    threads: [],
    uniqueColors: [],
    colorCount: 1,
    stitchCount: 4,
  };
}
describe("shared final upload preparation", () => {
  it("retains exact bytes without rotation and derives bounds from those bytes", () => {
    const source = pattern();
    source.bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const result = preparePatternUpload(source, 0, { x: 0, y: 0 });
    expect(result.pattern.penData).toBe(source.penData);
    expect(result.pattern.bounds).toEqual({
      minX: -100,
      maxX: 100,
      minY: -200,
      maxY: 200,
    });
  });
  it("checks the same rounded rotation and offset that are uploaded", () => {
    const source = pattern();
    for (const angle of [0, 45, 90, 180, 270, 359]) {
      const result = preparePatternUpload(source, angle, { x: 20, y: 30 });
      const checked = validatePenPlacement(
        result.pattern.penData,
        result.offset,
      );
      expect(checked.bounds).toEqual(result.pattern.bounds);
      expect(
        result.pattern.penStitches.stitches.filter(
          (s) => !s.isFeed && !s.isCut,
        ),
      ).toHaveLength(4);
    }
  });
});
