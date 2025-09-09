import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import VoiceHalo from "./components/VoiceHalo";
import DiagnosticsPanel from "./components/DiagnosticsPanel";

export default function App() {
  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[0, 0, 5]} intensity={0.8} />
        <VoiceHalo rings={1} pointsPerRing={360} amplitude={0.35} thickness={0.06} micReactive />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          enableRotate={false}
        />
      </Canvas>

      <div className="hint">
        Allow microphone for reactive motion. It still idles if you deny access.
      </div>

      <DiagnosticsPanel />
    </div>
  );
}
