import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePatternStore } from "./usePatternStore";
import { createWorkspaceStorage } from "../services/WorkspaceStorage";
import type { PesPatternData } from "../formats/import/pesImporter";

const defaultStorage = usePatternStore.persist.getOptions().storage!;
type Snapshot = Awaited<ReturnType<typeof defaultStorage.getItem>>;
let snapshot: Snapshot = null;
let ignoreWrites = false;
const data: PesPatternData = {
  stitches: [[10, 20, 0, 0]],
  threads: [],
  uniqueColors: [],
  penData: new Uint8Array([0, 128, 254, 255]),
  penStitches: {
    stitches: [],
    colorBlocks: [],
    bounds: { minX: 10, maxX: 10, minY: 20, maxY: 20 },
  },
  colorCount: 1,
  stitchCount: 1,
  bounds: { minX: 10, maxX: 10, minY: 20, maxY: 20 },
};

beforeEach(() => {
  snapshot = null;
  ignoreWrites = false;
  usePatternStore.persist.setOptions({
    storage: {
      getItem: () => snapshot,
      setItem: (_name, value) => {
        if (!ignoreWrites) snapshot = value;
      },
      removeItem: () => {
        snapshot = null;
      },
    },
  });
  usePatternStore.setState(usePatternStore.getInitialState(), true);
});
afterEach(() => {
  usePatternStore.persist.setOptions({ storage: defaultStorage });
  vi.unstubAllGlobals();
});

describe("saved artwork workspace", () => {
  it("restores original and uploaded artwork, bytes, rotation and offsets", async () => {
    const state = usePatternStore.getState();
    state.setPattern(data, "Kept artwork.pes");
    state.setPatternOffset(32, -18);
    state.setPatternRotation(90);
    state.setUploadedPattern(
      { ...data, penData: new Uint8Array([7, 8, 9]) },
      { x: 42, y: -8 },
    );
    ignoreWrites = true;
    usePatternStore.setState(usePatternStore.getInitialState(), true);
    await usePatternStore.persist.rehydrate();
    expect(usePatternStore.getState()).toMatchObject({
      currentFileName: "Kept artwork.pes",
      patternOffset: { x: 32, y: -18 },
      patternRotation: 90,
      uploadedPatternOffset: { x: 42, y: -8 },
      restoredFromStorage: true,
    });
    expect(usePatternStore.getState().pesData?.penData).toEqual(data.penData);
    expect(usePatternStore.getState().uploadedPesData?.penData).toEqual(
      new Uint8Array([7, 8, 9]),
    );
  });

  it("does not replace a new file when an older workspace finishes loading", async () => {
    usePatternStore.getState().setPattern(data, "Old artwork.pes");
    const oldSnapshot = snapshot;
    ignoreWrites = true;
    usePatternStore.setState(usePatternStore.getInitialState(), true);
    let release!: (value: Snapshot) => void;
    usePatternStore.persist.setOptions({
      storage: {
        getItem: () =>
          new Promise<Snapshot>((resolve) => {
            release = resolve;
          }),
        setItem: () => {},
        removeItem: () => {},
      },
    });
    const loading = usePatternStore.persist.rehydrate();
    usePatternStore.getState().setPattern(data, "New artwork.pes");
    release(oldSnapshot);
    await loading;
    expect(usePatternStore.getState().currentFileName).toBe("New artwork.pes");
    expect(usePatternStore.getState().restoredFromStorage).toBe(false);
  });

  it("keeps machine deletion editable after a refresh", async () => {
    usePatternStore.getState().setPattern(data, "Keep after deletion.pes");
    usePatternStore.getState().setUploadedPattern(data, { x: 10, y: 20 });
    usePatternStore.getState().clearUploadedPattern();
    ignoreWrites = true;
    usePatternStore.setState(usePatternStore.getInitialState(), true);
    await usePatternStore.persist.rehydrate();
    expect(usePatternStore.getState().pesData).toEqual(data);
    expect(usePatternStore.getState().uploadedPesData).toBeNull();
    expect(usePatternStore.getState().patternUploaded).toBe(false);
  });

  it("preserves Uint8Array bytes in the localStorage fallback", async () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    const storage = createWorkspaceStorage<{ penData: Uint8Array }>();
    await storage.setItem("workspace-test", {
      state: { penData: data.penData },
      version: 0,
    });
    const saved = await storage.getItem("workspace-test");
    expect(saved?.state.penData).toBeInstanceOf(Uint8Array);
    expect(saved?.state.penData).toEqual(data.penData);
    await storage.removeItem("workspace-test");
  });
});
