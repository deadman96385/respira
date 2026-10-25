import { describe, it, expect } from "vitest";
import { expandPolyline } from "../stitchgen/running";
import { writePesx } from "./pen";
import { encode, unpackRecords, transferBegin } from "./pen";

describe("stitchgen -> pesx -> pen integration", () => {
  it("round trips a design through pesx into pen records", () => {
    const pts = expandPolyline([[5, 5], [25, 5], [25, 25]], 2.0);
    const pesxStr = writePesx(
      [{ points: pts, threadcode: "001", chartcode: 13, color: [255, 0, 0] }],
      40,
      40,
    );
    expect(pesxStr).toContain("x-bilemb-pesxversion");
    expect(pesxStr).toContain('x-bilemb-threadcode="001"');
    expect(pesxStr).toContain('x-bilemb-chartcode="13"');
    const r = encode(pesxStr);
    expect(r.stream.length).toBeGreaterThan(0);
    const recs = unpackRecords(r.stream);
    expect(recs.length).toBeGreaterThanOrEqual(5);
    const begin = transferBegin(r.stream);
    expect(begin[0]).toBe(3);
    const dv = new DataView(begin.buffer);
    expect(dv.getUint32(1, true)).toBe(r.stream.length);
  });
});
