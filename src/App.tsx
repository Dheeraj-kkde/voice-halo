import { Canvas } from "@react-three/fiber";
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
          "radial-gradient(1200px at 50% 40%, #1c1a15 0%, #0d0c09 60%, #070604 100%)",
      }}
    >
      <Canvas
        style={{ width: 500, height: 500 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{ position: [0, 0, 4], fov: 50 }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 3, 3]} intensity={1.2} />

        <Suspense fallback={null}>
          <ParticleRing
            count={512} // number of particles
            radius={1.5} // circle radius
            size={0.03} // particle size
            color="#f5e6c8" // particle color
            pulseStrength={0.1}
            pulseSpeed={0.7}
            waveCycles={3}
            waveSpeed={1.8}
            audioGain={1.0}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
