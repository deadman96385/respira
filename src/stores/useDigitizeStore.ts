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
  removeLast: () => set((s) => ({ points: s.points.slice(0, -1) })),
  clear: () => set({ points: [] }),
}));
