// A d6 face as inline SVG: rounded square plus pips. Pure presentation, themed by CSS variables.
const PIPS: Record<number, ReadonlyArray<readonly [number, number]>> = {
  1: [[32, 32]],
  2: [[19, 19], [45, 45]],
  3: [[19, 19], [32, 32], [45, 45]],
  4: [[19, 19], [45, 19], [19, 45], [45, 45]],
  5: [[19, 19], [45, 19], [32, 32], [19, 45], [45, 45]],
  6: [[19, 19], [45, 19], [19, 32], [45, 32], [19, 45], [45, 45]],
}

export function DieFace({ face, size = 72, rolling = false }: { face: number | null; size?: number; rolling?: boolean }) {
  const pips = face === null ? [] : (PIPS[face] ?? [])
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label={face === null ? 'Die, not rolled yet' : `Die showing ${face}`}
      className={rolling ? 'die-rolling' : undefined}
    >
      <rect x="2" y="2" width="60" height="60" rx="12" className="fill-primary stroke-border" strokeWidth="2" />
      {pips.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="5.5" className="fill-primary-foreground" />
      ))}
    </svg>
  )
}
