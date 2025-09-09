export function buildHaloGeometry(
  rings: number,
  pointsPerRing: number,
  baseRadius: number
) {
  const safeRings = Math.max(1, Math.floor(rings));
  const safePPR = Math.max(1, Math.floor(pointsPerRing));
  const total = safeRings * safePPR;
  const positions = new Float32Array(total * 3);
  const ringIdx = new Float32Array(total);
  const angles = new Float32Array(total);

  let i = 0;
  for (let r = 0; r < safeRings; r++) {
    for (let p = 0; p < safePPR; p++) {
      const idx = i * 3;
      const t = (p / safePPR) * Math.PI * 2.0;
      positions[idx + 0] = Math.cos(t) * (baseRadius + r * 0.08);
      positions[idx + 1] = Math.sin(t) * (baseRadius + r * 0.08);
      positions[idx + 2] = 0;
      ringIdx[i] = r;
      angles[i] = t;
      i++;
    }
  }

  return { positions, ringIdx, angles, count: total };
}
