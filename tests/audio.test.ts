import { describe, it, expect } from "vitest";
import { computeRMS } from "../src/utils/audio";

describe("computeRMS", () => {
  it("returns 0 for all zeros", () => {
    expect(computeRMS(new Array(16).fill(0))).toBeCloseTo(0, 6);
  });

  it("returns 1 for all ones", () => {
    expect(computeRMS(new Array(16).fill(1))).toBeCloseTo(1, 6);
  });

  it("handles mixed values", () => {
    const data = [0, 1, 0, 1];
    expect(computeRMS(data)).toBeCloseTo(Math.SQRT1_2, 6);
  });
});
