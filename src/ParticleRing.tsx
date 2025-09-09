import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";

type Props = {
  count?: number;
  radius?: number;
  size?: number;
  color?: string;
  glow?: string;
  pulseStrength?: number;
  pulseSpeed?: number;
  waveSpeed?: number;
  waveCycles?: number;
  audioGain?: number;
  autoStartMic?: boolean;
};

export default function ParticleRing({
  count = 512,
  radius = 2,
  size = 0.06,
  color = "#8ecbff",
  glow = "#93c5fd",
  pulseStrength = 0.08,
  pulseSpeed = 0.7,
  waveSpeed = 1.6,
  waveCycles = 3.0,
  audioGain = 0.9,
  autoStartMic = true,
}: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const [ready, setReady] = useState(autoStartMic ? "starting" : "idle");

  /** =========================
   *  Microphone + analyser
   *  ========================= */
  const analyserRef = useRef<AnalyserNode | null>(null);
  const fftArrayRef = useRef<Uint8Array | null>(null);
  const [hasMic, setHasMic] = useState(false);

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      const ctx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024; // 512 bins usable
      analyser.smoothingTimeConstant = 0.75; // buttery
      source.connect(analyser);
      analyserRef.current = analyser;
      fftArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      setHasMic(true);
      setReady("ok");
    } catch (e) {
      console.warn("Mic permission denied or unavailable", e);
      setReady("blocked");
    }
  };

  useEffect(() => {
    if (autoStartMic) startMic();
  }, []);

  /** =========================
   *  Static ring layout
   *  ========================= */
  const angles = useMemo(() => {
    // Evenly spaced angles
    return Float32Array.from(
      { length: count },
      (_, i) => (i / count) * Math.PI * 2
    );
  }, [count]);

  /** =========================
   *  Frame update
   *  ========================= */
  // smoothers
  const timeRef = useRef(0);
  const pulseLFO = useRef(0);
  const levelSmooth = useRef(0); // smoothed amplitude 0..1

  // utility: compute overall level from FFT
  const overallLevel = () => {
    const fft = fftArrayRef.current;
    if (!fft) return 0;
    // focus on voice-dominant low/mid bands
    const take = Math.min(fft.length, 128);
    let sum = 0;
    for (let i = 2; i < take; i++) sum += fft[i];
    const avg = sum / (take - 2);
    return avg / 255;
  };

  useFrame((_, delta) => {
    timeRef.current += delta;

    // LFO for global pulse
    const lfo =
      (1 + Math.sin(timeRef.current * pulseSpeed * Math.PI * 2)) * 0.5; // 0..1
    pulseLFO.current = lfo;

    // Sample mic
    const analyser = analyserRef.current;
    if (analyser && fftArrayRef.current) {
      analyser.getByteFrequencyData(fftArrayRef.current);
      // smooth overall level
      const lvl = overallLevel();
      levelSmooth.current = THREE.MathUtils.lerp(levelSmooth.current, lvl, 0.1);
    } else {
      // idle breathing when mic not ready
      levelSmooth.current = THREE.MathUtils.lerp(
        levelSmooth.current,
        0.15 + 0.05 * Math.sin(timeRef.current * 0.9),
        0.05
      );
    }

    // Prep instances
    const inst = meshRef.current;
    if (!inst) return;

    // global pulsing radius
    const globalPulse = 1 + pulseStrength * (0.35 + 0.65 * pulseLFO.current);

    // traveling wave phase (radians)
    const wavePhase = timeRef.current * waveSpeed;

    for (let i = 0; i < count; i++) {
      const theta = angles[i];

      // Map angle to a moving FFT bin (creates the "wave around the circle")
      // Shifted by wavePhase to make the bump travel clockwise
      if (fftArrayRef.current) {
        const bins = fftArrayRef.current.length;
        // base index for this angle
        let idx = Math.floor(
          ((theta / (Math.PI * 2)) * bins +
            wavePhase * 18) /* scale travel speed */ %
            bins
        );
        if (idx < 0) idx += bins;
        var binAmp = fftArrayRef.current[idx] / 255;
      } else {
        var binAmp = 0.15; // idle bump
      }

      // shape the audio modulation with an extra sinusoid to add “teeth”
      const angularWave = Math.sin(theta * waveCycles - wavePhase) * 0.5 + 0.5; // 0..1
      const audioOffset =
        audioGain * (0.15 * levelSmooth.current + 0.55 * binAmp * angularWave);

      const r = radius * globalPulse * (1 + 0.25 * audioOffset);

      // final position on the ring
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r;
      const z = 0;

      dummy.position.set(x, y, z);

      // size jitter with audio (very subtle)
      const s = size * (1 + 0.5 * audioOffset);
      dummy.scale.setScalar(s / size); // relative scale, base size comes from geometry

      // face outward slightly (not really visible for spheres, but future-proof)
      dummy.lookAt(0, 0, 0);

      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }

    inst.instanceMatrix.needsUpdate = true;

    // Optional: fade emissive with level for extra “alive” feel
    const mat = inst.material as THREE.MeshStandardMaterial;
    const e = THREE.Color.NAMES ? new THREE.Color(glow) : new THREE.Color(glow);
    const emissiveIntensity = 0.6 + 0.9 * levelSmooth.current;
    mat.emissive.copy(e).multiplyScalar(emissiveIntensity);
  });

  /** =========================
   *  Geometry & material
   *  ========================= */
  const geo = useMemo(() => new THREE.SphereGeometry(size, 10, 10), [size]);
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      emissive: new THREE.Color(glow),
      roughness: 0.25,
      metalness: 0.1,
    });
    // Additive-like feel without full add blending (keeps it clean)
    m.transparent = true;
    m.opacity = 0.95;
    return m;
  }, [color, glow]);

  /** =========================
   *  Minimal mic UI
   *  ========================= */
  if (!autoStartMic && ready !== "ok") {
    return (
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[3.8, 1.4]} />
        <meshBasicMaterial transparent opacity={0}>
          {/* invisible click area; UI is HTML overlay in your app if you want */}
        </meshBasicMaterial>
        {/* @ts-ignore */}
        <primitive object={new THREE.Group()} onClick={startMic} />
      </mesh>
    );
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, count]}
      frustumCulled={false}
    />
  );
}
