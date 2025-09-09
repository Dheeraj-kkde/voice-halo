import * as THREE from "three";
import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";

type Props = {
  // counts
  ringCount?: number;
  innerCount?: number;
  // sizes / colors
  ringRadius?: number;
  ringSize?: number;
  innerSize?: number;
  ringColor?: string;
  innerColor?: string;
  ringGlow?: string;
  innerGlow?: string;
  // motion
  pulseStrength?: number;
  pulseSpeed?: number;
  waveSpeed?: number;
  waveCycles?: number;
  audioGain?: number;
  innerFlowSpeed?: number;
  innerAudioJitter?: number;
  // mic
  autoStartMic?: boolean;
};

export default function ParticleHalo({
  ringCount = 640,
  innerCount = 1600,
  ringRadius = 2.0,
  ringSize = 0.06,
  innerSize = 0.028,
  ringColor = "#8ecbff",
  innerColor = "#b8d9ff",
  ringGlow = "#93c5fd",
  innerGlow = "#9ac7ff",
  pulseStrength = 0.08,
  pulseSpeed = 0.7,
  waveSpeed = 1.6,
  waveCycles = 3.0,
  audioGain = 0.85,
  innerFlowSpeed = 0.6,
  innerAudioJitter = 0.6,
  autoStartMic = true,
}: Props) {
  // ---------- Refs & helpers ----------
  const ringRef = useRef<THREE.InstancedMesh>(null!);
  const innerRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const timeRef = useRef(0);
  const levelSmooth = useRef(0);

  // ---------- Microphone ----------
  const analyserRef = useRef<AnalyserNode | null>(null);
  const fftArrayRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
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
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);
        analyserRef.current = analyser;
        fftArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      } catch (e) {
        console.warn("Mic permission denied/unavailable", e);
      }
    };
    if (autoStartMic) startMic();
  }, [autoStartMic]);

  // a light-weight overall level (0..1) from FFT
  const overallLevel = () => {
    const fft = fftArrayRef.current;
    if (!fft) return 0;
    const take = Math.min(fft.length, 128);
    let sum = 0;
    for (let i = 2; i < take; i++) sum += fft[i];
    return sum / (take - 2) / 255;
  };

  // ---------- Ring: even angle layout ----------
  const ringAngles = useMemo(
    () =>
      Float32Array.from(
        { length: ringCount },
        (_, i) => (i / ringCount) * Math.PI * 2
      ),
    [ringCount]
  );

  // ---------- Inner: base positions (uniform disc) ----------
  // Use r = R * sqrt(u) for uniform density, theta = 2πv
  const innerBase = useMemo(() => {
    const arr = new Float32Array(innerCount * 2); // x,y pairs
    const rng = mulberry32(123456); // deterministic for stable layout
    for (let i = 0; i < innerCount; i++) {
      const u = rng();
      const v = rng();
      const r = Math.sqrt(u) * (ringRadius * 0.98); // slightly inside ring
      const theta = v * Math.PI * 2;
      arr[i * 2 + 0] = Math.cos(theta) * r;
      arr[i * 2 + 1] = Math.sin(theta) * r;
    }
    return arr;
  }, [innerCount, ringRadius]);

  // small per-instance phase offsets to de-sync motion
  const innerPhase = useMemo(() => {
    const a = new Float32Array(innerCount);
    const rng = mulberry32(424242);
    for (let i = 0; i < innerCount; i++) a[i] = rng() * Math.PI * 2;
    return a;
  }, [innerCount]);

  // ---------- Frame loop ----------
  useFrame((_, delta) => {
    timeRef.current += delta;

    // sample mic
    if (analyserRef.current && fftArrayRef.current) {
      analyserRef.current.getByteFrequencyData(fftArrayRef.current);
      const lvl = overallLevel();
      levelSmooth.current = THREE.MathUtils.lerp(levelSmooth.current, lvl, 0.1);
    } else {
      // idle breathing if no mic
      levelSmooth.current = THREE.MathUtils.lerp(
        levelSmooth.current,
        0.15 + 0.05 * Math.sin(timeRef.current * 0.8),
        0.05
      );
    }

    // ----- RING -----
    {
      const inst = ringRef.current;
      if (inst) {
        const globalPulse =
          1 +
          pulseStrength *
            (0.35 +
              0.65 *
                (0.5 +
                  0.5 * Math.sin(timeRef.current * pulseSpeed * Math.PI * 2)));
        const wavePhase = timeRef.current * waveSpeed;

        for (let i = 0; i < ringCount; i++) {
          const theta = ringAngles[i];

          // traveling wave around the ring, shaped by audio
          const angularWave =
            Math.sin(theta * waveCycles - wavePhase) * 0.5 + 0.5; // 0..1
          const audioOffset =
            audioGain *
            (0.15 * levelSmooth.current +
              0.55 * angularWave * levelSmooth.current);

          const r = ringRadius * globalPulse * (1 + 0.25 * audioOffset);
          const x = Math.cos(theta) * r;
          const y = Math.sin(theta) * r;

          dummy.position.set(x, y, 0);
          // subtle size wobble with audioOffset (keeps ring lively)
          const s = 1 + 0.35 * audioOffset;
          dummy.scale.setScalar(s);
          dummy.lookAt(0, 0, 0);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
        }
        inst.instanceMatrix.needsUpdate = true;

        // emissive “glow” reacts to level
        const mat = inst.material as THREE.MeshStandardMaterial;
        (mat.emissiveIntensity as any) = 0.6 + 0.9 * levelSmooth.current;
      }
    }

    // ----- INNER SWARM -----
    {
      const inst = innerRef.current;
      if (inst) {
        const t = timeRef.current;
        const phase = t * innerFlowSpeed;
        const l = levelSmooth.current;

        for (let i = 0; i < innerCount; i++) {
          const bx = innerBase[i * 2 + 0];
          const by = innerBase[i * 2 + 1];

          // angle & radius from center (for coupling to ring wave)
          const theta = Math.atan2(by, bx);
          const baseR = Math.hypot(bx, by);

          // traveling wave synced with ring
          const wave = Math.sin(theta * waveCycles - t * waveSpeed) * 0.5 + 0.5;

          // organic “flow field” (cheap pseudo-noise)
          const ph = innerPhase[i];
          const nx =
            0.35 * Math.sin(0.85 * bx + 1.2 * by + phase + ph) +
            0.2 * Math.cos(1.7 * by - 0.6 * bx + phase * 0.7 + ph * 0.5);
          const ny =
            0.35 * Math.cos(0.95 * bx - 1.0 * by + phase + ph) +
            0.2 * Math.sin(1.3 * bx + 0.8 * by + phase * 0.6 - ph * 0.3);

          // audio-driven jitter (radial + tangential)
          const audioJitter = innerAudioJitter * l;
          const jr = audioJitter * (0.35 * wave + 0.65 * l); // more energetic near wave crest
          const jtheta =
            audioJitter * 0.4 * (Math.sin(t * 2.2 + ph) * 0.5 + 0.5);

          // apply offsets
          // flow: small screen-space displacement
          let x = bx + nx * 0.08 + jtheta * -Math.sin(theta);
          let y = by + ny * 0.08 + jtheta * Math.cos(theta);

          // radial breathing & audio pulse (keeps inside coherent with ring)
          const radialScale =
            1 + 0.05 * Math.sin(t * pulseSpeed * Math.PI * 2) + 0.12 * jr;
          const rFinal = Math.min(baseR * radialScale, ringRadius * 0.98);
          const ang = Math.atan2(y, x);
          x = Math.cos(ang) * rFinal;
          y = Math.sin(ang) * rFinal;

          dummy.position.set(x, y, 0);
          const s = 1 + 0.6 * l * (0.3 + 0.7 * wave);
          dummy.scale.setScalar(s);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
        }
        inst.instanceMatrix.needsUpdate = true;

        const mat = inst.material as THREE.MeshStandardMaterial;
        (mat.emissiveIntensity as any) = 0.45 + 0.8 * levelSmooth.current;
      }
    }
  });

  // ---------- Geometries & materials ----------
  const ringGeo = useMemo(
    () => new THREE.SphereGeometry(ringSize, 10, 10),
    [ringSize]
  );
  const innerGeo = useMemo(
    () => new THREE.SphereGeometry(innerSize, 8, 8),
    [innerSize]
  );

  const ringMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(ringColor),
      emissive: new THREE.Color(ringGlow),
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 0.95,
    });
    // @ts-ignore – emissiveIntensity is available at runtime
    m.emissiveIntensity = 0.9;
    return m;
  }, [ringColor, ringGlow]);

  const innerMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(innerColor),
      emissive: new THREE.Color(innerGlow),
      roughness: 0.3,
      metalness: 0.05,
      transparent: true,
      opacity: 0.95,
    });
    // @ts-ignore
    m.emissiveIntensity = 0.6;
    return m;
  }, [innerColor, innerGlow]);

  return (
    <>
      {/* Outer pulsating ring */}
      <instancedMesh
        ref={ringRef}
        args={[ringGeo, ringMat, ringCount]}
        frustumCulled={false}
      />
      {/* Inner lively swarm */}
      <instancedMesh
        ref={innerRef}
        args={[innerGeo, innerMat, innerCount]}
        frustumCulled={false}
      />
    </>
  );
}

/** Deterministic tiny RNG for stable inner layout */
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
