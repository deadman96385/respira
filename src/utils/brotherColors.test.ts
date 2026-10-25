import { describe, it, expect } from "vitest";
import { findNearestBrotherColor } from "./brotherColors";

describe("brotherColors nearest", () => {
  it("finds white for near-white", () => {
    const c = findNearestBrotherColor(239, 239, 239);
    expect(c.ColorCode).toBe("001");
  });
  it("finds black for near-black", () => {
    const c = findNearestBrotherColor(5, 5, 5);
    expect(c.ColorCode).toBe("900");
  });
});
