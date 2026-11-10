import { afterEach, describe, expect, it, vi } from "vitest";
import { BrotherPP1Service } from "./BrotherPP1Service";
import { encodeStitchesToPen } from "../formats/pen/encoder";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("upload validation before machine mutation", () => {
  it("rejects invalid final bytes before deleting or sending a pattern", async () => {
    const service = new BrotherPP1Service();
    const remove = vi.spyOn(service, "deletePattern").mockResolvedValue();
    const send = vi.spyOn(service, "sendDataInfo").mockResolvedValue();
    const tooWide = new Uint8Array(
      encodeStitchesToPen([
        [-501, 0, 0, 0],
        [501, 0, 0, 0],
      ]).penBytes,
    );
    await expect(
      service.uploadPattern(tooWide, undefined, {
        minX: 0,
        maxX: 10,
        minY: 0,
        maxY: 0,
      }),
    ).rejects.toThrow(/hoop bounds/);
    await expect(
      service.uploadPattern(new Uint8Array([0, 0, 0])),
    ).rejects.toThrow(/Invalid PEN/);
    expect(remove).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("sends layout from final bytes even if caller bounds are stale", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const service = new BrotherPP1Service();
    vi.spyOn(service, "deletePattern").mockResolvedValue();
    vi.spyOn(service, "sendDataInfo").mockResolvedValue();
    vi.spyOn(service, "sendDataChunk").mockResolvedValue();
    vi.spyOn(service, "sendUUID").mockResolvedValue();
    const layout = vi.spyOn(service, "sendLayout").mockResolvedValue();
    const bytes = new Uint8Array(
      encodeStitchesToPen([
        [-100, -200, 0, 0],
        [100, 200, 0, 0],
      ]).penBytes,
    );
    const pending = service.uploadPattern(
      bytes,
      undefined,
      { minX: 0, maxX: 1, minY: 0, maxY: 1 },
      { x: 20, y: -30 },
    );
    await vi.runAllTimersAsync();
    await pending;
    expect(layout).toHaveBeenCalledWith(
      20,
      -30,
      100,
      100,
      0,
      0,
      0,
      -80,
      -230,
      120,
      170,
      20,
      -30,
    );
  });
});
