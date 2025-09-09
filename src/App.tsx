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
            // counts
            ringCount={720}
            innerCount={1800}
            // ring look: *very thin*
            ringRadius={2.0}
            ringSize={0.028} // << smaller dots = thinner ring
            ringColor="#cfe7ff"
            ringGlow="#a7d0ff"
            // inner look
            innerSize={0.022}
            innerColor="#b8d9ff"
            innerGlow="#9ac7ff"
            // motion
            pulseStrength={0.08}
            pulseSpeed={0.7}
            waveSpeed={1.6}
            waveCycles={3.0}
            audioGain={0.85}
            // inner flow baseline
            innerFlowSpeed={0.65}
            innerAudioJitter={0.5}
            // NEW: gravity behaviour
            gravityStrength={0.9} // how close toward center (0..1)
            minCoreRadiusFrac={0.06} // don’t collapse to exact center (6% of ring radius)
            activationSoftness={0.12} // smooth edge when recruiting particles
            gammaLoudness={0.9} // map mic level -> recruitment (lower = recruit earlier)
            autoStartMic={true}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
