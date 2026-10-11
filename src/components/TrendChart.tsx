export type TrendChartProps = {
  points: (number | null)[]; // one point per bucket; null = gap
  max: number;               // y-domain top (rates use 1, streaks use the peak)
  ariaLabel: string;         // role="img" summary
  yTicks?: string[];         // HTML labels, top → bottom
  testId: string;
};

// Fixed viewBox stretched with preserveAspectRatio="none" so the line fills any
// card width; vector-effect keeps strokes (and lone-point caps) screen-crisp
// instead of stretching. No text lives in the SVG for the same reason — labels
// are HTML siblings (spec §6.5). Plot area: y 2 (max) … 38 (baseline).
const VB = { w: 100, h: 40, top: 2, bottom: 38 } as const;

export function TrendChart({ points, max, ariaLabel, yTicks, testId }: TrendChartProps) {
  const px = (i: number) => (points.length <= 1 ? 50 : (i / (points.length - 1)) * 100);
  const py = (v: number) => VB.bottom - (max > 0 ? Math.max(v, 0) / max : 0) * (VB.bottom - VB.top);

  // Contiguous runs of non-null points → one polyline each; nulls break the line.
  const runs: Array<Array<{ i: number; v: number }>> = [];
  points.forEach((v, i) => {
    if (v === null) return;
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1].i === i - 1) last.push({ i, v });
    else runs.push([{ i, v }]);
  });
  const lines = runs.filter((r) => r.length > 1);
  const solos = runs.filter((r) => r.length === 1).map((r) => r[0]);

  const chart = (
    <svg viewBox={`0 0 ${VB.w} ${VB.h}`} preserveAspectRatio="none" role="img"
         aria-label={ariaLabel} data-testid={testId} className="h-24 w-full flex-1">
      <line x1={0} y1={VB.bottom} x2={VB.w} y2={VB.bottom}
            stroke="var(--color-line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {lines.map((run, i) => (
        <polyline key={i} fill="none" stroke="var(--color-accent)" strokeWidth={1.5}
                  strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
                  points={run.map((p) => `${px(p.i)},${py(p.v)}`).join(' ')} />
      ))}
      {/* A single point has no line to draw; a zero-length round-capped line
          renders a dot that non-scaling-stroke keeps circular at 3px. */}
      {solos.map((p) => (
        <line key={`s${p.i}`} x1={px(p.i)} y1={py(p.v)} x2={px(p.i)} y2={py(p.v) + 0.01}
              stroke="var(--color-accent)" strokeWidth={3} strokeLinecap="round"
              vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );

  if (!yTicks?.length) return chart;
  return (
    <div className="flex gap-2">
      <div aria-hidden className="flex h-24 flex-col justify-between text-[10px] text-[var(--color-subtle)]">
        {yTicks.map((t) => <span key={t}>{t}</span>)}
      </div>
      {chart}
    </div>
  );
}
