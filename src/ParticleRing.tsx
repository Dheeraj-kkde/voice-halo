import * as THREE from "three";
import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";

type Props = {
  count?: number;
  radius?: number;
  size?: number;
  color?: string;
  pulseStrength?: number;
  pulseSpeed?: number;
  waveCycles?: number;
  waveSpeed?: number;
  audioGain?: number;
};

export default function ParticleRing({
  count = 512,
  radius = 1.5,
  size = 0.03,
  color = "#ffffff",
  pulseStrength = 0.1,
  pulseSpeed = 0.6,
  waveCycles = 3,
  waveSpeed = 1.5,
  audioGain = 1.0,
}: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // 🎤 Microphone analyser
  const analyserRef = useRef<AnalyserNode | null>(null);
  const fftArrayRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    const initMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const ctx = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.7;
        source.connect(analyser);
        analyserRef.current = analyser;
        fftArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      } catch (err) {
        console.warn("Mic not available", err);
      }
    };
    initMic();
  }, []);

  // evenly spaced angles
  const angles = useMemo(
    () =>
      Float32Array.from({ length: count }, (_, i) => (i / count) * Math.PI * 2),
    [count]
  );

  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const inst = meshRef.current;
    if (!inst) return;

    // global pulse
    const lfo =
      (1 + Math.sin(timeRef.current * pulseSpeed * Math.PI * 2)) * 0.5;
    const pulse = 1 + pulseStrength * lfo;

    // grab mic data
    let audioData = 0;
    if (analyserRef.current && fftArrayRef.current) {
      analyserRef.current.getByteFrequencyData(fftArrayRef.current);
      audioData =
        fftArrayRef.current.reduce((a, b) => a + b, 0) /
        (fftArrayRef.current.length * 255);
    }

    const wavePhase = timeRef.current * waveSpeed;

    for (let i = 0; i < count; i++) {
      const theta = angles[i];
      const baseR = radius * pulse;

      // traveling wave around circle
      const wave = Math.sin(theta * waveCycles - wavePhase) * 0.5 + 0.5;
      const audioOffset = audioGain * wave * audioData * 0.4;

      const r = baseR * (1 + audioOffset);

      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r;

      dummy.position.set(x, y, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  });

  // geometry + material
  const geo = useMemo(() => new THREE.SphereGeometry(size, 6, 6), [size]);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
      }),
    [color]
  );

  return <instancedMesh ref={meshRef} args={[geo, mat, count]} />;
}
