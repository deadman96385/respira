import { describe, expect, it } from "vitest";
import {
  findBrotherColorByRGB,
  findNearestBrotherColor,
  getAllBrotherColors,
} from "./brotherColors";

describe("findNearestBrotherColor", () => {
  it("returns the exact chart color when the hex matches one", () => {
    const c = getAllBrotherColors()[0];
    const hex = `#${[c.R, c.G, c.B].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    expect(findNearestBrotherColor(hex)).toEqual(
      findBrotherColorByRGB(c.R, c.G, c.B),
    );
  });

  it("picks the closest color for an off-chart hex", () => {
    const c = getAllBrotherColors()[0];
    const nudge = (v: number) => Math.min(255, v + 1);
    const hex = `#${[c.R, c.G, c.B].map((v) => nudge(v).toString(16).padStart(2, "0")).join("")}`;
    expect(findNearestBrotherColor(hex)).toBeDefined();
  });

  it("returns undefined for an invalid hex", () => {
    expect(findNearestBrotherColor("not-a-color")).toBeUndefined();
  });
});
