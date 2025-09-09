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
  // gravity behaviour (NEW)
  gravityStrength?: number; // 0..1 (1 = can pull all the way to center floor)
  minCoreRadiusFrac?: number; // keep a tiny core radius (fraction of ringRadius)
  activationSoftness?: number; // 0..0.5 – soft edge when recruiting particles
  gammaLoudness?: number; // loudness curve; <1 recruits earlier, >1 later
  // mic
  autoStartMic?: boolean;
};

export default function ParticleHalo({
  ringCount = 720,
  innerCount = 1800,
  ringRadius = 2.0,
  ringSize = 0.028,
  innerSize = 0.022,
  ringColor = "#cfe7ff",
  innerColor = "#b8d9ff",
  ringGlow = "#a7d0ff",
  innerGlow = "#9ac7ff",
  pulseStrength = 0.08,
  pulseSpeed = 0.7,
  waveSpeed = 1.6,
  waveCycles = 3.0,
  audioGain = 0.85,
  innerFlowSpeed = 0.65,
  innerAudioJitter = 0.5,
  gravityStrength = 0.9,
  minCoreRadiusFrac = 0.06,
  activationSoftness = 0.12,
  gammaLoudness = 0.9,
  autoStartMic = true,
}: Props) {
  const ringRef = useRef<THREE.InstancedMesh>(null!);
  const innerRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const timeRef = useRef(0);
  const levelSmooth = useRef(0);

  // ---- Microphone ----
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

  const overallLevel = () => {
    const fft = fftArrayRef.current;
    if (!fft) return 0;
    const take = Math.min(fft.length, 128);
    let sum = 0;
    for (let i = 2; i < take; i++) sum += fft[i];
    return sum / (take - 2) / 255;
  };

  // ---- Ring layout (even angles) ----
  const ringAngles = useMemo(
    () =>
      Float32Array.from(
        { length: ringCount },
        (_, i) => (i / ringCount) * Math.PI * 2
      ),
    [ringCount]
  );

  // ---- Inner initial positions: uniform in disc ----
  const innerBase = useMemo(() => {
    const arr = new Float32Array(innerCount * 2);
    const rng = mulberry32(987654);
    for (let i = 0; i < innerCount; i++) {
      const u = rng();
      const v = rng();
      const r = Math.sqrt(u) * (ringRadius * 0.98);
      const t = v * Math.PI * 2;
      arr[i * 2 + 0] = Math.cos(t) * r;
      arr[i * 2 + 1] = Math.sin(t) * r;
    }
    return arr;
  }, [innerCount, ringRadius]);

  // ---- Inner recruitment order (stable) ----
  // Each particle gets a rank in [0,1); lower ranks get recruited first as loudness rises.
  const innerRank = useMemo(() => {
    const order = new Float32Array(innerCount);
    const rng = mulberry32(24681357);
    for (let i = 0; i < innerCount; i++) order[i] = rng();
    return order; // not sorted; we compare l^gamma vs rank directly
  }, [innerCount]);

  useFrame((_, delta) => {
    timeRef.current += delta;

    // mic sampling + smoothing
    if (analyserRef.current && fftArrayRef.current) {
      analyserRef.current.getByteFrequencyData(fftArrayRef.current);
      const lvl = overallLevel();
      levelSmooth.current = THREE.MathUtils.lerp(levelSmooth.current, lvl, 0.1);
    } else {
      levelSmooth.current = THREE.MathUtils.lerp(
        levelSmooth.current,
        0.12 + 0.05 * Math.sin(timeRef.current * 0.8),
        0.05
      );
    }

    // ----- RING: thin + wave pulse -----
    {
      const inst = ringRef.current;
      if (inst) {
        const l = levelSmooth.current;
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
          const angularWave =
            Math.sin(theta * waveCycles - wavePhase) * 0.5 + 0.5; // 0..1
          const audioOffset = audioGain * (0.2 * l + 0.6 * l * angularWave);
          const r = ringRadius * globalPulse * (1 + 0.18 * audioOffset);
          const x = Math.cos(theta) * r;
          const y = Math.sin(theta) * r;

          dummy.position.set(x, y, 0);
          dummy.scale.setScalar(1); // keep dot size steady → visually thin ring
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
        }
        inst.instanceMatrix.needsUpdate = true;

        const mat = inst.material as THREE.MeshStandardMaterial;
        // subtle emissive lift with loudness
        // @ts-ignore
        mat.emissiveIntensity = 0.7 + 0.8 * levelSmooth.current;
      }
    }

    // ----- INNER: flow + *gravitational recruitment* -----
    {
      const inst = innerRef.current;
      if (inst) {
        const t = timeRef.current;
        const l0 = levelSmooth.current;
        // Map loudness through gamma (shapes how fast we recruit)
        const loud = Math.pow(Math.min(Math.max(l0, 0), 1), gammaLoudness);
        const phase = t * innerFlowSpeed;

        const minR = Math.max(minCoreRadiusFrac, 0.0) * ringRadius; // floor radius
        const gStrength = THREE.MathUtils.clamp(gravityStrength, 0, 1);

        for (let i = 0; i < innerCount; i++) {
          const bx = innerBase[i * 2 + 0];
          const by = innerBase[i * 2 + 1];

          const baseR = Math.hypot(bx, by);
          const theta = Math.atan2(by, bx);

          // traveling wave to add liveliness while gravitating
          const wave = Math.sin(theta * waveCycles - t * waveSpeed) * 0.5 + 0.5;

          // light flow field (organic motion)
          const nx =
            0.32 * Math.sin(0.85 * bx + 1.2 * by + phase) +
            0.18 * Math.cos(1.6 * by - 0.6 * bx + phase * 0.7);
          const ny =
            0.32 * Math.cos(0.95 * bx - 1.0 * by + phase) +
            0.18 * Math.sin(1.2 * bx + 0.8 * by + phase * 0.6);

          // small tangential audio jitter to keep the inside alive
          const j = innerAudioJitter * l0 * (0.25 + 0.75 * wave);
          let x = bx + nx * 0.07 + j * -Math.sin(theta);
          let y = by + ny * 0.07 + j * Math.cos(theta);

          // ---- recruitment toward center ----
          // Each particle has rank r in [0,1). If loud >= r → recruited.
          // Use a soft band so recruitment looks smooth.
          const rnk = innerRank[i];
          const s = activationSoftness; // softness width (0..0.5)
          const a = smoothstep(rnk - s, rnk + s, loud); // 0..1 activation

          // target radius when fully recruited (pulls toward minR)
          const targetR = THREE.MathUtils.lerp(baseR, minR, gStrength * a);
          const ang = Math.atan2(y, x);
          x = Math.cos(ang) * targetR;
          y = Math.sin(ang) * targetR;

          dummy.position.set(x, y, 0);
          // Slight size lift for recruited particles (visual feedback)
          const sizeBoost = 1 + 0.5 * a * (0.3 + 0.7 * l0);
          dummy.scale.setScalar(sizeBoost);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
        }
        inst.instanceMatrix.needsUpdate = true;

        const mat = inst.material as THREE.MeshStandardMaterial;
        // @ts-ignore
        mat.emissiveIntensity = 0.55 + 0.75 * levelSmooth.current;
      }
    }
  });

  // ---- Geometries & materials ----
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
      opacity: 0.96,
    });
    // @ts-ignore
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
      opacity: 0.96,
    });
    // @ts-ignore
    m.emissiveIntensity = 0.6;
    return m;
  }, [innerColor, innerGlow]);

  return (
    <>
      <instancedMesh
        ref={ringRef}
        args={[ringGeo, ringMat, ringCount]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={innerRef}
        args={[innerGeo, innerMat, innerCount]}
        frustumCulled={false}
      />
    </>
  );
}

/* ---------- utils ---------- */

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// smoothstep(x0,x1,t) with clamped t
function smoothstep(edge0: number, edge1: number, x: number) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0 || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
}
