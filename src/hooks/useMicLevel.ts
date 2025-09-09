import { useEffect, useState } from "react";

type MicStatus = "idle" | "requested" | "granted" | "denied" | "unavailable";

export default function useMicLevel(enabled: boolean) {
  const [level, setLevel] = useState(0);
  const [status, setStatus] = useState<MicStatus>("idle");

  useEffect(() => {
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let raf = 0;
    let mounted = true;
    let stream: MediaStream | null = null;

    const canUseMic =
      enabled &&
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      ("AudioContext" in window || "webkitAudioContext" in window);

    if (!canUseMic) {
      setStatus(enabled ? "unavailable" : "idle");
      setLevel(0);
      return () => undefined;
    }

    setStatus("requested");

    (async () => {
      try {
        const req = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!mounted) return;
        stream = req ?? null;

        if (!stream || stream.getAudioTracks().length === 0) {
          setStatus("denied");
          setLevel(0);
          return;
        }

        // @ts-ignore - Safari fallback
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (!ctx) {
          setStatus("unavailable");
          setLevel(0);
          return;
        }

        try {
          await ctx.resume();
        } catch {}

        if (!ctx || !stream) {
          setStatus("unavailable");
          setLevel(0);
          return;
        }

        const src = ctx.createMediaStreamSource(stream);
        if (!src) {
          setStatus("unavailable");
          setLevel(0);
          return;
        }

        analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        src.connect(analyser);

        setStatus("granted");

        const data = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
          if (!mounted || !analyser) return;
          analyser.getByteTimeDomainData(data);

          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          setLevel((prev) => prev * 0.8 + rms * 0.2);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch (e) {
        if (mounted) {
          console.warn("Mic permission denied or not available:", e);
          setStatus("denied");
          setLevel(0);
        }
      }
    })();

    return () => {
      mounted = false;
      if (raf) cancelAnimationFrame(raf);
      try {
        if (ctx) ctx.close();
      } catch {}
      try {
        if (stream) stream.getTracks().forEach((t) => t.stop());
      } catch {}
    };
  }, [enabled]);

  return { level, status };
}
