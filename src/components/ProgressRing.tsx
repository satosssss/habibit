export function ProgressRing({
  size, stroke, progress, color, children,
}: { size: number; stroke: number; progress: number; color: string; children?: React.ReactNode }) {
  const clamped = Math.max(0, Math.min(1, progress));
  // Radius insets the full stroke on both sides, so the ring never clips its box.
  const radius = (size - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                stroke="rgba(255,255,255,0.35)" strokeWidth={stroke} />
        <circle data-progress cx={size / 2} cy={size / 2} r={radius} fill="none"
                stroke={color} strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - clamped)}
                style={{ transition: 'stroke-dashoffset 300ms ease' }} />
      </svg>
      {children != null && <div className="absolute grid place-items-center">{children}</div>}
    </div>
  );
}
