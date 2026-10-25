import { create } from "zustand";
import type { StitchType } from "../lib/digitize/types";

interface DigitizeState {
  active: boolean;
  stitchType: StitchType;
  points: [number, number][];
  hex: string;
  setActive: (v: boolean) => void;
  setStitchType: (v: StitchType) => void;
  setHex: (v: string) => void;
  addPoint: (p: [number, number]) => void;
  updatePoint: (index: number, p: [number, number]) => void;
  deletePoint: (index: number) => void;
  removeLast: () => void;
  clear: () => void;
}

export const useDigitizeStore = create<DigitizeState>((set) => ({
  active: false,
  stitchType: "running",
  points: [],
  hex: "#FF0000",
  setActive: (v) => set({ active: v }),
  setStitchType: (v) => set({ stitchType: v }),
  setHex: (v) => set({ hex: v }),
  addPoint: (p) => set((s) => ({ points: [...s.points, p] })),
  updatePoint: (i, p) =>
    set((s) => {
      const next = s.points.slice();
      if (i >= 0 && i < next.length) next[i] = p;
      return { points: next };
    }),
  deletePoint: (i) =>
    set((s) => ({ points: s.points.filter((_, idx) => idx !== i) })),
  removeLast: () => set((s) => ({ points: s.points.slice(0, -1) })),
  clear: () => set({ points: [] }),
}));
