export function computeRMS(data: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = Number(data[i]);
    sum += v * v;
  }
  return Math.sqrt(sum / Math.max(1, data.length));
}
