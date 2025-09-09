import * as React from "react";
import * as THREE from "three";
import { useFrame, type ReactThreeFiber } from "@react-three/fiber";
import { HaloMaterial } from "../three/HaloMaterial";
import useMicLevel from "../hooks/useMicLevel";
import { buildHaloGeometry } from "../utils/geometry";

// TS: ensure JSX knows about <haloMaterial/>
declare global {
  namespace JSX {
    interface IntrinsicElements {
      haloMaterial: ReactThreeFiber.Object3DNode<any, typeof HaloMaterial>;
    }
  }
}

type Props = {
  rings?: number;
  pointsPerRing?: number;
  baseRadius?: number;
  amplitude?: number;
  thickness?: number;
  micReactive?: boolean;
};

export default function VoiceHalo({
  rings = 10,
  pointsPerRing = 220,
  baseRadius = 2.6,
  amplitude = 0.3,
  thickness = 0.05,
  micReactive = true,
}: Props) {
  const matRef = React.useRef<any>(null);
  const { level: micLevel } = useMicLevel(micReactive);

  const { positions, ringIdx, angles, count } = React.useMemo(
    () => buildHaloGeometry(rings, pointsPerRing, baseRadius),
    [rings, pointsPerRing, baseRadius]
  );

  useFrame((_, dt) => {
    if (!matRef.current) return;
    matRef.current.uTime += dt;
    const boosted = Math.min(1, micLevel * 3.0);
    matRef.current.uMicAmp = boosted;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aRingIdx"
          count={count}
          array={ringIdx}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aAngle"
          count={count}
          array={angles}
          itemSize={1}
        />
      </bufferGeometry>
      {/* @ts-ignore custom material registered by extend() */}
      <haloMaterial
        ref={matRef}
        uBaseRadius={baseRadius}
        uAmplitude={amplitude}
        uThickness={thickness}
        blending={THREE.AdditiveBlending}
        transparent
        depthWrite={false}
        toneMapped={false}
        dithering
      />
    </points>
  );
}
