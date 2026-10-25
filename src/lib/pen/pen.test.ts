import { describe, it, expect } from "vitest";
import { encode, unpackRecords, transferBegin } from "./pen";

describe("pen encoder", () => {
  it("encodes a simple line with END flag", () => {
    const pesx =
      '<svg width="100.0mm" height="100.0mm" viewBox="0 0 100 100">' +
      '<path d="m 0.0 0.0 l 5.0 0.0 l 5.0 5.0" fill="rgb(255,0,0)" ' +
      'x-bilemb-threadcode="801" x-bilemb-chartcode="1"/></svg>';
    const r = encode(pesx);
    expect(r.stream.length).toBeGreaterThan(0);
    const recs = unpackRecords(r.stream);
    expect(recs.length).toBeGreaterThan(0);
    const last = recs[recs.length - 1];
    expect(last[2] & 0x01).toBeTruthy();
    expect(last[2] & 0x04).toBeTruthy();
  });

  it("color change sets color flag", () => {
    const pesx =
      '<svg width="50.0mm" height="50.0mm" viewBox="0 0 50 50">' +
      '<path d="m 0.0 0.0 l 5.0 0.0" fill="rgb(255,0,0)"/>' +
      '<path d="m 0.0 0.0 l 5.0 0.0" fill="rgb(0,0,255)"/></svg>';
    const r = encode(pesx);
    expect(r.colorNum.length).toBe(1);
    const off = r.colorNum[0];
    expect(off).toBeGreaterThanOrEqual(0);
    expect(off).toBeLessThan(r.stream.length - 4);
    const rec = unpackRecords(r.stream.slice(off, off + 4))[0];
    expect(rec[2] & 0x02).toBeTruthy();
  });

  it("transferBegin framing", () => {
    const pesx =
      '<svg width="10.0mm" height="10.0mm" viewBox="0 0 10 10">' +
      '<path d="m 0.0 0.0 l 1.0 0.0" fill="rgb(0,0,0)"/></svg>';
    const r = encode(pesx);
    const begin = transferBegin(r.stream);
    expect(begin[0]).toBe(3);
    const dv = new DataView(begin.buffer);
    expect(dv.getUint32(1, true)).toBe(r.stream.length);
  });
});
