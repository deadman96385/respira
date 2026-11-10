import { describe, it, expect } from "vitest";
import { normalizePesCommands } from "./normalizeCommands";
import { encodeStitchesToPen } from "../pen/encoder";
import { decodePenData } from "../pen/decoder";
import { STITCH, MOVE, TRIM, STOP, END, COLOR_CHANGE } from "./constants";

const commands = {
  STITCH: 0,
  JUMP: 1,
  TRIM: 2,
  STOP: 3,
  END: 4,
  COLOR_CHANGE: 5,
  COMMAND_MASK: 255,
};
describe("PyStitch import semantics", () => {
  it("preserves all repeated placements, cuts, jumps and explicit boundaries", () => {
    const raw = [
      [0, 0, 1],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 2],
      [0, 0, 5],
      [100, 0, 1],
      [100, 0, 0],
      [100, 0, 3],
      [100, 0, 0],
      [100, 0, 4],
    ];
    const result = normalizePesCommands(raw, ["red", "blue"], commands);
    expect(result.stitches.map((r) => r[2])).toEqual([
      MOVE,
      STITCH,
      STITCH,
      TRIM,
      COLOR_CHANGE,
      MOVE,
      STITCH,
      STOP,
      STITCH,
      END,
    ]);
    expect(result.threads).toEqual(["red", "blue", "blue"]);
    expect(result.stitchCount).toBe(4);
    const final = decodePenData(
      new Uint8Array(encodeStitchesToPen(result.stitches).penBytes),
    );
    expect(
      final.stitches.filter((s) => !s.isFeed && !s.isCut && !s.isColorEnd),
    ).toHaveLength(4);
    expect(final.stitches.filter((s) => s.isCut)).toHaveLength(2);
    expect(final.colorBlocks).toHaveLength(3);
  });
  it("masks metadata, uses supplied enum IDs and stops at END", () => {
    const result = normalizePesCommands(
      [
        [0, 0, 65536],
        [0, 0, 4],
        [0, 0, 99],
      ],
      ["red"],
      commands,
    );
    expect(result.stitchCount).toBe(1);
    expect(result.stitches).toHaveLength(2);
  });
  it("reports unsupported commands rather than converting them to needles", () => {
    expect(() => normalizePesCommands([[0, 0, 7]], ["red"], commands)).toThrow(
      /not supported/,
    );
    expect(() => normalizePesCommands([[0, 0, 5]], ["red"], commands)).toThrow(
      /missing thread/,
    );
    expect(() =>
      normalizePesCommands([[NaN, 0, 0]], ["red"], commands),
    ).toThrow(/invalid stitch/);
  });
});
