import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePatternRotationUpload } from "./usePatternRotationUpload";
import { encodeStitchesToPen } from "../../formats/pen/encoder";
import { decodePenData } from "../../formats/pen/decoder";
import type { PesPatternData } from "../../formats/import/pesImporter";

function pattern(width: number): PesPatternData {
  const stitches = [
    [-width / 2, 0, 0, 0],
    [width / 2, 0, 0, 0],
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
    stitchCount: 2,
  };
}
describe("upload orchestration", () => {
  it("does not mark or transmit a pattern whose final coordinates do not fit", async () => {
    const uploadPattern = vi.fn().mockResolvedValue(undefined),
      setUploadedPattern = vi.fn();
    const { result } = renderHook(() =>
      usePatternRotationUpload({ uploadPattern, setUploadedPattern }),
    );
    await expect(
      result.current.handleUpload(
        pattern(1002),
        "too-wide.pes",
        { x: 0, y: 0 },
        0,
      ),
    ).rejects.toThrow(/hoop bounds/);
    expect(uploadPattern).not.toHaveBeenCalled();
    expect(setUploadedPattern).not.toHaveBeenCalled();
  });
  it("marks the exact prepared pattern only after a successful upload", async () => {
    const uploadPattern = vi
      .fn()
      .mockRejectedValueOnce(new Error("Bluetooth interrupted"))
      .mockResolvedValue(undefined);
    const setUploadedPattern = vi.fn();
    const { result } = renderHook(() =>
      usePatternRotationUpload({ uploadPattern, setUploadedPattern }),
    );
    const data = pattern(200);
    await expect(
      result.current.handleUpload(data, "sample.pes", { x: 10, y: 20 }, 90),
    ).rejects.toThrow(/interrupted/);
    expect(setUploadedPattern).not.toHaveBeenCalled();
    await act(() =>
      result.current.handleUpload(data, "sample.pes", { x: 10, y: 20 }, 90),
    );
    expect(setUploadedPattern).toHaveBeenCalledWith(
      uploadPattern.mock.lastCall![1],
      uploadPattern.mock.lastCall![3],
    );
  });
});
