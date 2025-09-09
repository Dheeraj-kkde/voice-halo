import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useRef } from "react";
import * as THREE from "three";
import ParticleHalo from "./ParticleHalo";

const KPMG = {
  bg: "radial-gradient(1200px at 50% 40%, #061333 0%, #05112b 55%, #010a20 100%)",
  ringStart: "#00338D", // deep royal
  ringEnd: "#005EB8", // KPMG blue
  innerStart: "#6DA9FF", // light tint
  innerEnd: "#3B5BA9", // mid blue
};

export default function App() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: KPMG.bg,
      }}
    >
      <Canvas
        style={{ width: 500, height: 500 }}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 6], fov: 50 }}
      >
        {/* ambient just to avoid a super-flat feel (materials are additive anyway) */}
        <ambientLight intensity={0.25} />
        <directionalLight position={[4, 6, 8]} intensity={0.4} />

        <Suspense fallback={null}>
          <SceneDrift>
            <ParticleHalo
              // counts & layout
              ringCount={720}
              innerCount={900}
              ringRadius={2.0}
              ringSize={0.012} // thin core ring
              featherSize={0.026} // soft outer halo ring (polish)
              // palette
              ringColorStart={KPMG.ringStart}
              ringColorEnd={KPMG.ringEnd}
              innerColorStart={KPMG.innerStart}
              innerColorEnd={KPMG.innerEnd}
              // motion
              pulseStrength={0.085}
              pulseSpeed={0.7}
              waveSpeed={1.55}
              waveCycles={3.0}
              audioGain={0.9}
              innerFlowSpeed={0.62}
              innerAudioJitter={0.45}
              // gravity + strict anti-cluster
              gravityStrength={0.9}
              minCoreRadiusFrac={0.06}
              activationSoftness={0.12}
              gammaLoudness={0.9}
              vanishThresholdFrac={0.018}
              vanishGuardFrac={0.012}
              vanishJitterFrac={0.18}
              reappearDelay={0.18}
              respawnFadeIn={0.12}
              autoStartMic={true}
            />
          </SceneDrift>
        </Suspense>
      </Canvas>
    </div>
  );
}

/** Subtle scene drift for a premium, “alive” feel */
function SceneDrift({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null!);
  useFrame(() => {
    const t = performance.now() * 0.001;
    if (!ref.current) return;
    ref.current.rotation.z = Math.sin(t * 0.08) * 0.02;
    ref.current.rotation.x = Math.cos(t * 0.06) * 0.015;
    ref.current.position.y = Math.sin(t * 0.5) * 0.02;
  });
  return <group ref={ref}>{children}</group>;
}
