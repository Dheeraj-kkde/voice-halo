import { describe, it, expect } from "vitest";
import { buildHaloGeometry } from "../src/utils/geometry";

describe("buildHaloGeometry", () => {
  it("returns consistent buffer sizes", () => {
    const { positions, ringIdx, angles, count } = buildHaloGeometry(3, 10, 2.0);
    expect(count).toBe(30);
    expect(positions.length).toBe(count * 3);
    expect(ringIdx.length).toBe(count);
    expect(angles.length).toBe(count);
  });

  it("clamps invalid inputs to minimums", () => {
    const { count } = buildHaloGeometry(0, 0, 1.0);
    expect(count).toBe(1);
  });
});
