import * as THREE from "three";
import { extend, type ReactThreeFiber } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";

// Vertex + fragment shaders
const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uBaseRadius;
  uniform float uAmplitude;
  uniform float uMicAmp;
  uniform float uThickness;
  attribute float aRingIdx;
  attribute float aAngle;

  void main() {
    float ring = aRingIdx;
    float t = uTime + ring * 0.2;
    float angle = aAngle;

    float travel = sin(angle * 2.0 + t * 1.1) * 0.25
                 + sin(angle * 5.0 - t * 0.7) * 0.15;

    float amp = uAmplitude + uMicAmp * 1.75;
    float radius = uBaseRadius + travel * amp;

    float ringJitter = (sin(angle * 17.0 + ring * 13.0) * 0.5 + 0.5) * uThickness;
    radius += ringJitter;

    vec3 pos = vec3(cos(angle) * radius, sin(angle) * radius, 0.0);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = 2.5 * (300.0 / max(0.001, -mvPosition.z));
  }
`;

const fragment = /* glsl */ `
  precision mediump float;
  void main(){
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float d = dot(uv, uv);
    float alpha = smoothstep(1.0, 0.7, d);
    gl_FragColor = vec4(0.85, 0.93, 1.0, alpha);
  }
`;

export const HaloMaterial = shaderMaterial(
  {
    uTime: 0,
    uBaseRadius: 2.6,
    uAmplitude: 0.3,
    uMicAmp: 0.0,
    uThickness: 0.05
  },
  vertex,
  fragment
);

// Register custom material so <haloMaterial /> works
extend({ HaloMaterial });

// TS: add to JSX namespace
declare global {
  namespace JSX {
    interface IntrinsicElements {
      haloMaterial: ReactThreeFiber.Object3DNode<any, typeof HaloMaterial>;
    }
  }
}

// Small sanity helper to check material has shader strings
export function isHaloMaterialValid(): boolean {
  try {
    const mat: any = new (HaloMaterial as any)();
    return (
      typeof mat.vertexShader === "string" &&
      mat.vertexShader.length > 0 &&
      typeof mat.fragmentShader === "string" &&
      mat.fragmentShader.length > 0
    );
  } catch {
    return false;
  }
}
