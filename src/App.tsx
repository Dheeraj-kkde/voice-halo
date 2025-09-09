import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense } from "react";
import ParticleRing from "./ParticleRing";

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
          <ParticleRing
            count={640}
            radius={2.0}
            size={0.06}
            color="#8ecbff"
            glow="#93c5fd"
            pulseStrength={0.08}
            pulseSpeed={0.7}
            waveSpeed={1.6}
            waveCycles={3.0}
            audioGain={0.85}
            autoStartMic={true}
          />
        </Suspense>

        <OrbitControls enablePan={false} enableZoom={false} />
      </Canvas>
    </div>
  );
}
