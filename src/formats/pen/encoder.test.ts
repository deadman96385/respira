import { describe, it, expect } from "vitest";
import { encodeStitchPosition, encodeStitchesToPen } from "./encoder";
import { decodePenData } from "./decoder";
import { validatePenPlacement } from "./validate";
import {
  STITCH,
  MOVE,
  TRIM,
  STOP,
  COLOR_CHANGE,
  END,
} from "../import/constants";

const decoded = (rows: number[][]) =>
  decodePenData(new Uint8Array(encodeStitchesToPen(rows).penBytes));

describe("authored embroidery commands through PEN", () => {
  it("preserves coincident needle placements and an explicit trim", () => {
    const result = decoded([
      [0, 0, STITCH, 0],
      [0, 0, STITCH, 0],
      [0, 0, TRIM, 0],
      [20, 0, MOVE, 0],
      [20, 0, STITCH, 0],
      [20, 0, END, 0],
    ]);
    expect(result.stitches.map((s) => [s.x, s.y, s.isFeed, s.isCut])).toEqual([
      [0, 0, false, false],
      [0, 0, false, false],
      [0, 0, false, true],
      [20, 0, true, false],
      [20, 0, false, false],
    ]);
    expect(result.stitches.at(-1)?.isDataEnd).toBe(true);
  });

  it("does not invent locks or cuts on a long authored jump", () => {
    const result = decoded([
      [0, 0, STITCH, 0],
      [400, 0, MOVE, 0],
      [400, 0, STITCH, 0],
    ]);
    expect(result.stitches).toHaveLength(3);
    expect(result.stitches.filter((s) => s.isCut)).toHaveLength(0);
    expect(result.stitches[1].isFeed).toBe(true);
  });

  it("keeps trims adjacent to a color change as one cut boundary", () => {
    const result = decoded([
      [0, 0, STITCH, 0],
      [0, 0, TRIM, 0],
      [0, 0, COLOR_CHANGE, 0],
      [200, 0, MOVE, 1],
      [200, 0, STITCH, 1],
    ]);
    expect(result.stitches.filter((s) => s.isCut)).toHaveLength(1);
    expect(result.stitches.filter((s) => s.isColorEnd)).toHaveLength(1);
    expect(result.colorBlocks).toHaveLength(2);
    expect(
      result.stitches.filter((s) => !s.isCut && !s.isFeed).map((s) => s.x),
    ).toEqual([0, 200]);
  });

  it("preserves a mandatory same-thread stop", () => {
    const result = decoded([
      [0, 0, STITCH, 0],
      [0, 0, STOP, 0],
      [0, 0, STITCH, 1],
      [10, 0, STITCH, 1],
    ]);
    expect(result.stitches.filter((s) => s.isColorEnd)).toHaveLength(1);
    expect(result.colorBlocks).toHaveLength(2);
    expect(
      result.stitches.filter((s) => !s.isCut && !s.isFeed).map((s) => s.x),
    ).toEqual([0, 0, 10]);
  });

  it("combines a following authored trim with its pause without cutting twice", () => {
    const result = decoded([
      [0, 0, STITCH, 0],
      [0, 0, COLOR_CHANGE, 0],
      [0, 0, TRIM, 1],
      [10, 0, MOVE, 1],
      [10, 0, STITCH, 1],
    ]);
    expect(result.stitches.filter((s) => s.isCut)).toHaveLength(1);
    const repeated = decoded([
      [0, 0, STITCH, 0],
      [0, 0, COLOR_CHANGE, 0],
      [0, 0, TRIM, 1],
      [0, 0, TRIM, 1],
      [10, 0, STITCH, 1],
    ]);
    expect(repeated.stitches.filter((s) => s.isCut)).toHaveLength(2);
  });

  it("retains a trailing pause and terminates without another penetration", () => {
    const result = decoded([
      [0, 0, STITCH, 0],
      [0, 0, STOP, 0],
      [0, 0, END, 1],
    ]);
    expect(result.stitches).toHaveLength(3);
    expect(result.stitches[1].isColorEnd).toBe(true);
    expect(result.stitches[2].isDataEnd).toBe(true);
    expect(result.stitches[2].isFeed).toBe(true);
  });

  it("supports color-index boundaries in cached patterns without sewing a bridge", () => {
    const result = decoded([
      [0, 0, STITCH, 0],
      [100, 0, STITCH, 1],
    ]);
    expect(result.stitches.map((s) => [s.x, s.isFeed, s.isColorEnd])).toEqual([
      [0, false, false],
      [0, false, true],
      [100, true, false],
      [100, false, false],
    ]);
  });

  it("uses every final move for bounds, without adding edge penetrations", () => {
    const rows = Array.from({ length: 101 }, (_, i) => [
      -500 + i * 10,
      0,
      STITCH,
      0,
    ]);
    const encoded = encodeStitchesToPen(rows);
    expect(encoded.bounds).toEqual({ minX: -500, maxX: 500, minY: 0, maxY: 0 });
    expect(decoded(rows).stitches).toHaveLength(rows.length);
    expect(
      encodeStitchesToPen([
        [0, 0, STITCH, 0],
        [600, 0, MOVE, 0],
        [10, 0, STITCH, 0],
      ]).bounds.maxX,
    ).toBe(600);
  });

  it("does not encode an END command as a stitch or read past it", () => {
    const result = decoded([
      [0, 0, STITCH, 0],
      [10, 0, STITCH, 0],
      [10, 0, END, 0],
      [300, 0, STITCH, 0],
    ]);
    expect(result.stitches.map((s) => s.x)).toEqual([0, 10]);
    expect(result.stitches.filter((s) => s.isDataEnd)).toHaveLength(1);
  });

  it("rounds to the machine grid and rejects coordinate overflow and NaN", () => {
    expect(decoded([[1.5, -2.4, STITCH, 0]]).stitches[0]).toMatchObject({
      x: 2,
      y: -2,
    });
    expect(encodeStitchPosition(-1, 1)).toEqual([248, 255, 8, 0]);
    expect(() => encodeStitchPosition(4096, 0)).toThrow(/coordinate range/);
    expect(() => encodeStitchPosition(NaN, 0)).toThrow(/coordinate range/);
    expect(() => decoded([[0, 0, 8, 0]])).toThrow(/invalid embroidery command/);
  });
});

describe("final placed PEN validation", () => {
  const bytes = (rows: number[][]) =>
    new Uint8Array(encodeStitchesToPen(rows).penBytes);
  it("checks encoded bounds and the rounded placement", () => {
    const data = bytes([
      [-500, 0, STITCH, 0],
      [500, 0, STITCH, 0],
    ]);
    expect(validatePenPlacement(data).bounds.maxX).toBe(500);
    expect(() => validatePenPlacement(data, { x: 1, y: 0 })).toThrow(/right/);
    expect(() => validatePenPlacement(data, { x: NaN, y: 0 })).toThrow(
      /finite/,
    );
  });
  it("rejects a travel move outside the hoop even if needles fit", () => {
    const data = bytes([
      [0, 0, STITCH, 0],
      [1100, 0, MOVE, 0],
      [10, 0, STITCH, 0],
    ]);
    expect(() => validatePenPlacement(data)).toThrow(/hoop bounds/);
  });
  it("rejects unterminated, trailing, unsupported and non-sewing data", () => {
    const data = bytes([
      [0, 0, STITCH, 0],
      [10, 0, STITCH, 0],
    ]);
    expect(() =>
      validatePenPlacement(new Uint8Array([...data, 0, 0, 0, 0])),
    ).toThrow(/final encoded command/);
    expect(() => validatePenPlacement(new Uint8Array([0, 0, 0, 0]))).toThrow(
      /end exactly once/,
    );
    expect(() => validatePenPlacement(new Uint8Array([5, 0, 4, 0]))).toThrow(
      /unsupported/,
    );
    expect(() => validatePenPlacement(bytes([[0, 0, MOVE, 0]]))).toThrow(
      /no needle/,
    );
    expect(() => validatePenPlacement(new Uint8Array())).toThrow(/Invalid PEN/);
  });
});
