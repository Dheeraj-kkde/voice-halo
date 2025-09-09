import { describe, it, expect } from "vitest";
import { isHaloMaterialValid } from "../src/three/HaloMaterial";

describe("HaloMaterial", () => {
  it("has vertex & fragment shader strings", () => {
    expect(isHaloMaterialValid()).toBe(true);
  });
});
