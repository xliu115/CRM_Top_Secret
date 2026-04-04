/** Pure helper: given per-segment durations, compute start/end and total length in ms. */
export function computeSegmentOffsetsMs(durationsMs: number[]): {
  startMs: number[];
  endMs: number[];
  totalMs: number;
} {
  const startMs: number[] = [];
  const endMs: number[] = [];
  let acc = 0;
  for (const d of durationsMs) {
    startMs.push(acc);
    const end = acc + d;
    endMs.push(end);
    acc = end;
  }
  return { startMs, endMs, totalMs: acc };
}
