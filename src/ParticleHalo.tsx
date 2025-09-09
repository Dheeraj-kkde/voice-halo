import * as THREE from "three";
import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";

type Props = {
  ringCount?: number;
  innerCount?: number;
  ringRadius?: number;
  ringSize?: number;
  featherSize?: number;
  innerSize?: number;

  // If you passed ringColorStart/End before, we'll just use the END and lighten it.
  ringColorStart?: string;
  ringColorEnd?: string;
  innerColorStart?: string;
  innerColorEnd?: string;

  // motion
  pulseStrength?: number;
  pulseSpeed?: number;
  waveSpeed?: number;
  waveCycles?: number;
  audioGain?: number;
  innerFlowSpeed?: number;
  innerAudioJitter?: number;

  // gravity
  gravityStrength?: number;
  minCoreRadiusFrac?: number;
  activationSoftness?: number;
  gammaLoudness?: number;

  // strict anti-cluster
  vanishThresholdFrac?: number;
  vanishGuardFrac?: number;
  vanishJitterFrac?: number;
  reappearDelay?: number;
  respawnFadeIn?: number;

  autoStartMic?: boolean;
};

export default function ParticleHalo({
  ringCount = 720,
  innerCount = 900,
  ringRadius = 2.0,
  ringSize = 0.012,
  featherSize = 0.026,
  innerSize = 0.022,

  ringColorStart = "#00338D",
  ringColorEnd = "#005EB8",
  innerColorStart = "#6DA9FF",
  innerColorEnd = "#3B5BA9",

  pulseStrength = 0.085,
  pulseSpeed = 0.7,
  waveSpeed = 1.55,
  waveCycles = 3.0,
  audioGain = 0.9,
  innerFlowSpeed = 0.62,
  innerAudioJitter = 0.45,

  gravityStrength = 0.9,
  minCoreRadiusFrac = 0.06,
  activationSoftness = 0.12,
  gammaLoudness = 0.9,

  vanishThresholdFrac = 0.018,
  vanishGuardFrac = 0.012,
  vanishJitterFrac = 0.18,
  reappearDelay = 0.18,
  respawnFadeIn = 0.12,

  autoStartMic = true,
}: Props) {
  const ringCoreRef = useRef<THREE.InstancedMesh>(null!);
  const ringFeatherRef = useRef<THREE.InstancedMesh>(null!);
  const innerRef = useRef<THREE.InstancedMesh>(null!);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const timeRef = useRef(0);
  const levelSmooth = useRef(0);

  /* ---------------- MIC ---------------- */
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

  /* ------------- STATIC LAYOUTS ------------- */
  const ringAngles = useMemo(
    () =>
      Float32Array.from(
        { length: ringCount },
        (_, i) => (i / ringCount) * Math.PI * 2
      ),
    [ringCount]
  );

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

  // recruitment order + per-particle vanish jitter
  const innerRank = useMemo(() => {
    const order = new Float32Array(innerCount);
    const rng = mulberry32(24681357);
    for (let i = 0; i < innerCount; i++) order[i] = rng();
    return order;
  }, [innerCount]);

  const innerThreshJitter = useMemo(() => {
    const arr = new Float32Array(innerCount);
    const rng = mulberry32(13579);
    for (let i = 0; i < innerCount; i++) arr[i] = rng() - 0.5;
    return arr;
  }, [innerCount]);

  /* ------------- GEOMETRY & MATERIALS ------------- */
  const ringGeo = useMemo(
    () => new THREE.SphereGeometry(ringSize, 10, 10),
    [ringSize]
  );
  const ringFeatherGeo = useMemo(
    () => new THREE.SphereGeometry(featherSize, 10, 10),
    [featherSize]
  );
  const innerGeo = useMemo(
    () => new THREE.SphereGeometry(innerSize, 8, 8),
    [innerSize]
  );

  // Build **solid light colors** (no vertexColors; fully deterministic)
  const ringLight = useMemo(() => lighten(ringColorEnd, 0.35), [ringColorEnd]);
  const featherLight = useMemo(
    () => lighten(ringColorEnd, 0.55),
    [ringColorEnd]
  );
  const innerLight = useMemo(
    () => lighten(innerColorStart, 0.45),
    [innerColorStart]
  );

  const ringMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(ringLight),
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [ringLight]
  );

  const featherMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(featherLight),
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [featherLight]
  );

  const innerMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(innerLight),
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [innerLight]
  );

  /* ------------- TIMERS ------------- */
  const cooldownRef = useRef<Float32Array>();
  if (!cooldownRef.current || cooldownRef.current.length !== innerCount) {
    cooldownRef.current = new Float32Array(innerCount);
  }
  const respawnRef = useRef<Float32Array>();
  if (!respawnRef.current || respawnRef.current.length !== innerCount) {
    respawnRef.current = new Float32Array(innerCount);
  }

  /* ------------- FRAME LOOP ------------- */
  useFrame((_, delta) => {
    timeRef.current += delta;

    // mic smoothing
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

    // OUTER RING (core + feather)
    {
      const l = levelSmooth.current;
      const globalPulse =
        1 +
        pulseStrength *
          (0.35 +
            0.65 *
              (0.5 +
                0.5 * Math.sin(timeRef.current * pulseSpeed * Math.PI * 2)));
      const wavePhase = timeRef.current * waveSpeed;

      const updateRing = (
        inst: THREE.InstancedMesh | null,
        radiusScale = 1
      ) => {
        if (!inst) return;
        for (let i = 0; i < ringCount; i++) {
          const theta = ringAngles[i];
          const angularWave =
            Math.sin(theta * waveCycles - wavePhase) * 0.5 + 0.5;
          const audioOffset = audioGain * (0.2 * l + 0.6 * l * angularWave);
          const r =
            ringRadius * globalPulse * (1 + 0.18 * audioOffset) * radiusScale;
          dummy.position.set(Math.cos(theta) * r, Math.sin(theta) * r, 0);
          dummy.scale.setScalar(1);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
        }
        inst.instanceMatrix.needsUpdate = true;
      };

      updateRing(ringCoreRef.current, 1.0);
      updateRing(ringFeatherRef.current, 1.02);
    }

    // INNER SWARM (strict no-center render + fade-in respawn)
    {
      const inst = innerRef.current;
      if (inst) {
        const t = timeRef.current;
        const l0 = levelSmooth.current;
        const loud = Math.pow(THREE.MathUtils.clamp(l0, 0, 1), gammaLoudness);
        const phase = t * innerFlowSpeed;

        const minR = Math.max(minCoreRadiusFrac, 0.0) * ringRadius;
        const baseVanishR = Math.max(vanishThresholdFrac, 0.0) * ringRadius;
        const guard = Math.max(vanishGuardFrac, 0) * ringRadius;
        const gStrength = THREE.MathUtils.clamp(gravityStrength, 0, 1);

        const cooldown = cooldownRef.current!;
        const respawn = respawnRef.current!;

        for (let i = 0; i < innerCount; i++) {
          if (cooldown[i] > 0) {
            cooldown[i] -= delta;
            if (cooldown[i] <= 0) respawn[i] = respawnFadeIn;
            const bx = innerBase[i * 2 + 0];
            const by = innerBase[i * 2 + 1];
            dummy.position.set(bx, by, 0);
            dummy.scale.setScalar(0);
            dummy.updateMatrix();
            inst.setMatrixAt(i, dummy.matrix);
            continue;
          }

          const bx = innerBase[i * 2 + 0];
          const by = innerBase[i * 2 + 1];
          const baseR = Math.hypot(bx, by);
          const theta = Math.atan2(by, bx);

          const nx =
            0.32 * Math.sin(0.85 * bx + 1.2 * by + phase) +
            0.18 * Math.cos(1.6 * by - 0.6 * bx + phase * 0.7);
          const ny =
            0.32 * Math.cos(0.95 * bx - 1.0 * by + phase) +
            0.18 * Math.sin(1.2 * bx + 0.8 * by + phase * 0.6);
          const wave = Math.sin(theta * waveCycles - t * waveSpeed) * 0.5 + 0.5;
          const j = innerAudioJitter * l0 * (0.25 + 0.75 * wave);

          let x = bx + nx * 0.07 + j * -Math.sin(theta);
          let y = by + ny * 0.07 + j * Math.cos(theta);

          const rnk = innerRank[i];
          const s = activationSoftness;
          const a = smoothstep(rnk - s, rnk + s, loud);

          const targetR = THREE.MathUtils.lerp(baseR, minR, gStrength * a);
          const jitter = innerThreshJitter[i] * vanishJitterFrac;
          const vanishRi = baseVanishR * (1 + jitter) + guard;

          if (a > 0.4 && targetR <= vanishRi) {
            cooldown[i] = reappearDelay;
            const bx2 = innerBase[i * 2 + 0];
            const by2 = innerBase[i * 2 + 1];
            dummy.position.set(bx2, by2, 0);
            dummy.scale.setScalar(0);
            dummy.updateMatrix();
            inst.setMatrixAt(i, dummy.matrix);
            continue;
          }

          const ang = Math.atan2(y, x);
          const rFinal = targetR;
          x = Math.cos(ang) * rFinal;
          y = Math.sin(ang) * rFinal;

          let scale = 1 + 0.12 * a;
          if (respawn[i] > 0) {
            respawn[i] -= delta;
            const k =
              1 - Math.max(respawn[i], 0) / Math.max(respawnFadeIn, 0.0001);
            scale *= THREE.MathUtils.clamp(k, 0, 1);
            if (respawn[i] <= 0) respawn[i] = 0;
          }

          dummy.position.set(x, y, 0);
          dummy.scale.setScalar(scale);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
        }

        inst.instanceMatrix.needsUpdate = true;
      }
    }
  });

  return (
    <>
      <instancedMesh
        ref={ringCoreRef}
        args={[ringGeo, ringMat, ringCount]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={ringFeatherRef}
        args={[ringFeatherGeo, featherMat, ringCount]}
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

/* ---------------- utils ---------------- */

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0 || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
}

/** lighten a hex color by factor in [0..1] */
function lighten(hex: string, factor = 0.3) {
  const c = new THREE.Color(hex);
  return new THREE.Color()
    .copy(c)
    .lerp(new THREE.Color("#ffffff"), THREE.MathUtils.clamp(factor, 0, 1))
    .getStyle();
}
