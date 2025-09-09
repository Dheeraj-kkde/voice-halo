import * as THREE from "three";
import * as React from "react";
import { isHaloMaterialValid } from "../three/HaloMaterial";
import { buildHaloGeometry } from "../utils/geometry";
import { computeRMS } from "../utils/audio";

type TestResult = { name: string; pass: boolean; details?: string };

function runSelfTests(): TestResult[] {
  const results: TestResult[] = [];

  // Test 1: WebGL + three availability
  try {
    const hasThree = !!THREE && typeof THREE.ShaderMaterial === "function";
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    results.push({ name: "WebGL context created", pass: !!gl });
    results.push({ name: "three.js present", pass: hasThree });
  } catch (e: any) {
    results.push({
      name: "WebGL/three check",
      pass: false,
      details: String(e?.message || e),
    });
  }

  // Test 2: shader strings exist
  results.push({
    name: "Shader strings defined",
    pass: isHaloMaterialValid(),
  });

  // Test 3: mic API availability (capability, not permission)
  const micCapable = !!navigator.mediaDevices?.getUserMedia;
  results.push({ name: "Mic API available", pass: micCapable });

  // Test 4: geometry sizes consistent
  try {
    const { positions, ringIdx, angles, count } = buildHaloGeometry(3, 10, 2.0);
    const ok =
      positions.length === count * 3 &&
      ringIdx.length === count &&
      angles.length === count &&
      count === 30;
    results.push({ name: "Geometry buffers consistent", pass: ok });
  } catch (e: any) {
    results.push({
      name: "Geometry generation",
      pass: false,
      details: String(e?.message || e),
    });
  }

  // Test 5: RMS helper sanity
  try {
    const zeros = new Array(8).fill(0);
    const ones = new Array(8).fill(1);
    const rmsZero = computeRMS(zeros);
    const rmsOne = computeRMS(ones);
    const ok = Math.abs(rmsZero - 0) < 1e-6 && Math.abs(rmsOne - 1) < 1e-6;
    results.push({ name: "RMS helper", pass: ok });
  } catch (e: any) {
    results.push({
      name: "RMS helper",
      pass: false,
      details: String(e?.message || e),
    });
  }

  return results;
}

export default function DiagnosticsPanel() {
  const [tests, setTests] = React.useState<TestResult[]>([]);
  React.useEffect(() => {
    setTests(runSelfTests());
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        left: 16,
        bottom: 16,
        padding: 12,
        borderRadius: 12,
        fontSize: 12,
        background: "rgba(15,17,25,0.65)",
        color: "#cbd5e1",
        backdropFilter: "blur(6px)",
        border: "1px solid rgba(148,163,184,0.25)",
        maxWidth: 320,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Diagnostics</div>
      {tests.map((t, i) => (
        <div
          key={i}
          style={{ display: "flex", gap: 8, alignItems: "baseline" }}
        >
          <span style={{ width: 14 }}>{t.pass ? "✅" : "❌"}</span>
          <span>{t.name}</span>
          {!t.pass && t.details ? (
            <span style={{ opacity: 0.7 }}> — {t.details}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
