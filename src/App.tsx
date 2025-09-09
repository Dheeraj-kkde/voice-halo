import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import ParticleHalo from "./ParticleHalo";

export default function App() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(1200px at 50% 40%, #0e1220 0%, #070a12 60%, #04060c 100%)",
      }}
    >
      <Canvas
        style={{ width: 500, height: 500 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{ position: [0, 0, 6], fov: 50 }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />

        <Suspense fallback={null}>
          <ParticleHalo
            // appearance
            ringCount={640}
            innerCount={1600}
            ringRadius={2.0}
            ringSize={0.06}
            innerSize={0.028}
            ringColor="#8ecbff"
            innerColor="#b8d9ff"
            ringGlow="#93c5fd"
            innerGlow="#9ac7ff"
            // motion
            pulseStrength={0.08}
            pulseSpeed={0.7}
            waveSpeed={1.6}
            waveCycles={3.0}
            audioGain={0.85}
            innerFlowSpeed={0.6} // organic flow of inner swarm
            innerAudioJitter={0.6} // how strongly inner particles jitter with audio
            autoStartMic={true}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
