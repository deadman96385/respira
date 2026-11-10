import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHandoffReport, sha256 } from "./handoffReport";
import { encodeStitchesToPen } from "./encoder";
import { decodePenData } from "./decoder";
import type { PesPatternData } from "../import/pesImporter";
import { MOVE } from "../import/constants";

function pattern(): PesPatternData {
  const stitches = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [100, 0, MOVE, 0],
    [100, 0, 0, 0],
  ];
  const encoded = encodeStitchesToPen(stitches);
  const penData = new Uint8Array(encoded.penBytes);
  return {
    sourcePesSha256: "fixture-source",
    stitches,
    penData,
    penStitches: decodePenData(penData),
    bounds: encoded.bounds,
    threads: [],
    uniqueColors: [],
    colorCount: 1,
    stitchCount: 3,
  };
}

afterEach(() => vi.unstubAllGlobals());
describe("checked transfer record", () => {
  it("binds the exact checked rotated bytes and retains duplicate needles", async () => {
    vi.stubGlobal("crypto", webcrypto);
    const source = pattern();
    const report = await createHandoffReport(source, 90, { x: 20, y: 30 });
    const bytes = Uint8Array.from(atob(report.penBase64), (c) =>
      c.charCodeAt(0),
    );
    expect(report.penSha256).toBe(await sha256(bytes));
    expect(report.sourcePesSha256).toBe(source.sourcePesSha256);
    expect(report.counts.needles).toBe(3);
    expect(report.placement).toMatchObject({ moveX: -30, moveY: 30 });
    expect(report.uploadConfirmed).toBe(false);
    expect(report.physicalSewOut).toBe("unsewn");
    expect(decodePenData(bytes).stitches[0]).toMatchObject({ x: 50, y: -50 });
  });
  it("rejects a source without identity and a final placement outside the hoop", async () => {
    vi.stubGlobal("crypto", webcrypto);
    const source = pattern();
    await expect(
      createHandoffReport(source, 0, { x: 1000, y: 0 }),
    ).rejects.toThrow("hoop bounds");
    delete source.sourcePesSha256;
    await expect(
      createHandoffReport(source, 0, { x: 0, y: 0 }),
    ).rejects.toThrow("Reimport");
  });
});
