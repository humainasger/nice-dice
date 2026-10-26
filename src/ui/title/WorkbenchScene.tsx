// The title screen's hero as hand-coded inline SVG, no raster: a dicewright's bench at night. A dark
// wall, a lamp hanging top right with its glow pooling over the bench, the warm wood bench top with
// grain and a knot, one large ivory die mid-tumble above its soft shadow, a few pine shavings and
// dust motes drifting through the light (CSS keyframes in index.css, hidden under reduce motion).
// Two crops of the same drawing are rendered and CSS shows one: the 16:9 frame in landscape, a
// square frame around the die in portrait, both with preserveAspectRatio slice so the scene always
// fills the viewport. Gradient and filter ids carry the crop's prefix so the two never collide.
// The colours are the scene's own night palette, the same in both themes.
import type { CSSProperties } from 'react'

/** Die face edge in scene units; the top and right faces recede by 0.75 and 0.55 of it. */
const S = 180
const RECEDE_X = 0.75
const RECEDE_Y = 0.55
/** Hexagonal silhouette of the die in die-local units, front face at (0, 0) to (S, S). */
const SILHOUETTE = [
  [0, 0],
  [S * RECEDE_X, -S * RECEDE_Y],
  [S + S * RECEDE_X, -S * RECEDE_Y],
  [S + S * RECEDE_X, S - S * RECEDE_Y],
  [S, S],
  [0, S],
] as const
const TOP_FACE = [
  [0, 0],
  [S, 0],
  [S + S * RECEDE_X, -S * RECEDE_Y],
  [S * RECEDE_X, -S * RECEDE_Y],
] as const
const RIGHT_FACE = [
  [S, 0],
  [S + S * RECEDE_X, -S * RECEDE_Y],
  [S + S * RECEDE_X, S - S * RECEDE_Y],
  [S, S],
] as const
/** The die's bounding box centre in die-local units, for the rotation and placement. */
const DIE_CENTRE = [(S + S * RECEDE_X) / 2, (S - S * RECEDE_Y) / 2] as const
/** Where the die hangs in the scene and how far it has turned. */
const DIE_AT = [1150, 430] as const
const DIE_TILT = -16

const PIP_R = 15
/** Pip layouts on a face of S units: the three-step grid at a quarter, half and three quarters. */
const Q = S / 4
const FRONT_PIPS: ReadonlyArray<readonly [number, number]> = [
  [Q, Q],
  [3 * Q, Q],
  [2 * Q, 2 * Q],
  [Q, 3 * Q],
  [3 * Q, 3 * Q],
]
const TOP_PIPS: ReadonlyArray<readonly [number, number]> = [
  [Q, Q],
  [2 * Q, 2 * Q],
  [3 * Q, 3 * Q],
]
const RIGHT_PIPS: ReadonlyArray<readonly [number, number]> = [
  [Q + 8, Q - 6],
  [3 * Q - 8, Q - 6],
  [Q + 8, 2 * Q],
  [3 * Q - 8, 2 * Q],
  [Q + 8, 3 * Q + 6],
  [3 * Q - 8, 3 * Q + 6],
]

interface Mote {
  readonly x: number
  readonly y: number
  readonly r: number
  readonly dur: number
  readonly delay: number
  readonly dx: number
  readonly dy: number
  readonly alpha: number
}

/** Hand-placed motes, most of them in the lamp's light so the drift reads; the left few are for wide frames. */
const MOTES: readonly Mote[] = [
  { x: 1240, y: 150, r: 3, dur: 14, delay: -2, dx: -46, dy: -70, alpha: 0.75 },
  { x: 1370, y: 260, r: 2.5, dur: 11, delay: -6, dx: -30, dy: -90, alpha: 0.6 },
  { x: 1090, y: 120, r: 2, dur: 16, delay: -9, dx: -40, dy: -60, alpha: 0.5 },
  { x: 1460, y: 180, r: 3.5, dur: 13, delay: -4, dx: -60, dy: -80, alpha: 0.7 },
  { x: 1300, y: 420, r: 2.5, dur: 12, delay: -1, dx: -36, dy: -96, alpha: 0.55 },
  { x: 1020, y: 330, r: 2, dur: 15, delay: -11, dx: -24, dy: -70, alpha: 0.45 },
  { x: 1180, y: 560, r: 3, dur: 13, delay: -7, dx: -50, dy: -110, alpha: 0.6 },
  { x: 1420, y: 520, r: 2, dur: 17, delay: -3, dx: -44, dy: -84, alpha: 0.5 },
  { x: 950, y: 500, r: 2.5, dur: 14, delay: -12, dx: -30, dy: -80, alpha: 0.5 },
  { x: 1520, y: 360, r: 2.5, dur: 12, delay: -8, dx: -56, dy: -66, alpha: 0.65 },
  { x: 1120, y: 250, r: 1.8, dur: 18, delay: -5, dx: -34, dy: -100, alpha: 0.45 },
  { x: 1340, y: 620, r: 2.2, dur: 15, delay: -10, dx: -40, dy: -76, alpha: 0.5 },
  { x: 1000, y: 640, r: 2.8, dur: 13, delay: -14, dx: -26, dy: -90, alpha: 0.55 },
  { x: 1560, y: 100, r: 2, dur: 16, delay: -6, dx: -70, dy: -50, alpha: 0.6 },
  { x: 620, y: 220, r: 2.2, dur: 17, delay: -4, dx: -30, dy: -70, alpha: 0.4 },
  { x: 420, y: 380, r: 1.8, dur: 19, delay: -9, dx: -24, dy: -80, alpha: 0.35 },
  { x: 760, y: 480, r: 2.5, dur: 15, delay: -13, dx: -36, dy: -76, alpha: 0.42 },
]

function points(list: ReadonlyArray<readonly [number, number]>): string {
  return list.map(([x, y]) => `${x},${y}`).join(' ')
}

function moteStyle(m: Mote): CSSProperties {
  return {
    '--mote-dur': `${m.dur}s`,
    '--mote-delay': `${m.delay}s`,
    '--mote-dx': `${m.dx}px`,
    '--mote-dy': `${m.dy}px`,
    '--mote-alpha': m.alpha,
  } as CSSProperties
}

interface CropProps {
  /** Prefix for the gradient and filter ids of this instance. */
  readonly id: string
  readonly viewBox: string
  readonly className: string
  readonly motes: boolean
}

function Crop({ id, viewBox, className, motes }: CropProps) {
  const u = (name: string): string => `url(#${id}-${name})`
  return (
    <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1726" />
          <stop offset="1" stopColor="#0c0b12" />
        </linearGradient>
        <linearGradient id={`${id}-bench`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#452815" />
          <stop offset="0.55" stopColor="#5e3a1f" />
          <stop offset="1" stopColor="#7d4d29" />
        </linearGradient>
        <linearGradient id={`${id}-bench-depth`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000000" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#000000" stopOpacity="0.1" />
          <stop offset="1" stopColor="#000000" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2e1b0f" />
          <stop offset="1" stopColor="#150c07" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} gradientUnits="userSpaceOnUse" cx="1330" cy="40" r="680">
          <stop offset="0" stopColor="#ffe3a3" stopOpacity="0.85" />
          <stop offset="0.16" stopColor="#f6c25a" stopOpacity="0.5" />
          <stop offset="0.45" stopColor="#f2b134" stopOpacity="0.16" />
          <stop offset="1" stopColor="#f2b134" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-pool`} gradientUnits="userSpaceOnUse" cx="1330" cy="610" r="620">
          <stop offset="0" stopColor="#f2b134" stopOpacity="0.3" />
          <stop offset="1" stopColor="#f2b134" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-face-front`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3ebd8" />
          <stop offset="1" stopColor="#dfd3b7" />
        </linearGradient>
        <linearGradient id={`${id}-face-right`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6eedc" />
          <stop offset="1" stopColor="#e6dbc1" />
        </linearGradient>
        <filter id={`${id}-blur`} x="-30%" y="-120%" width="160%" height="340%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <filter id={`${id}-bulb`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

      {/* Wall */}
      <rect x="0" y="0" width="1600" height="900" fill={u('wall')} />

      {/* Bench top, the depth shade towards the back, the lit back edge */}
      <rect x="0" y="560" width="1600" height="220" fill={u('bench')} />
      <rect x="0" y="560" width="1600" height="220" fill={u('bench-depth')} />
      <rect x="0" y="560" width="1600" height="3" fill="#a8743f" opacity="0.45" />
      {/* Grain: long gentle waves, a knot, a few lighter streaks */}
      <g fill="none" stroke="#2c180c" strokeLinecap="round" opacity="0.5">
        <path d="M0 586 C 260 578, 520 600, 820 588 S 1320 574, 1600 590" strokeWidth="2" />
        <path d="M0 612 C 300 604, 540 626, 880 612 S 1380 600, 1600 616" strokeWidth="1.5" />
        <path d="M0 644 C 240 640, 500 660, 760 646 S 1240 630, 1600 650" strokeWidth="2.5" />
        <path d="M0 676 C 320 668, 600 690, 900 676 S 1360 664, 1600 682" strokeWidth="1.5" />
        <path d="M0 708 C 280 702, 520 722, 840 708 S 1300 696, 1600 712" strokeWidth="2" />
        <path d="M0 740 C 260 734, 560 752, 820 740 S 1320 730, 1600 746" strokeWidth="1.5" />
        <path d="M0 766 C 300 760, 580 776, 900 764 S 1380 756, 1600 770" strokeWidth="2" />
      </g>
      <g fill="none" stroke="#b07f4a" strokeLinecap="round" opacity="0.22">
        <path d="M0 598 C 260 592, 520 612, 820 600 S 1320 588, 1600 602" strokeWidth="1.2" />
        <path d="M0 690 C 320 684, 600 704, 900 690 S 1360 680, 1600 696" strokeWidth="1.2" />
        <path d="M0 752 C 260 748, 560 764, 820 752 S 1320 744, 1600 758" strokeWidth="1.2" />
      </g>
      <g fill="none" stroke="#2c180c" opacity="0.55">
        <ellipse cx="560" cy="700" rx="34" ry="11" strokeWidth="2.5" />
        <ellipse cx="560" cy="700" rx="20" ry="6" strokeWidth="2" />
        <ellipse cx="560" cy="700" rx="8" ry="2.5" strokeWidth="2" fill="#2c180c" />
        <path d="M400 702 C 470 694, 520 688, 526 700 M 594 700 C 620 712, 700 710, 760 704" strokeWidth="2" />
      </g>
      {/* Lamp pool on the wood, drawn over the grain so the grain shows through the light */}
      <rect x="0" y="560" width="1600" height="220" fill={u('pool')} />

      {/* Front edge: the lit bevel, the shadow line under it, the dark front face with its own grain */}
      <rect x="0" y="778" width="1600" height="20" fill="#8a5a33" />
      <rect x="0" y="778" width="1600" height="4" fill="#c08a52" opacity="0.6" />
      <rect x="0" y="798" width="1600" height="6" fill="#1a0f08" opacity="0.9" />
      <rect x="0" y="804" width="1600" height="96" fill={u('front')} />
      <g stroke="#0e0804" strokeWidth="1.5" opacity="0.45">
        <path d="M0 836 L1600 832" />
        <path d="M0 866 L1600 870" />
      </g>

      {/* Lamp glow over wall and bench */}
      <rect className="title-glow" x="0" y="0" width="1600" height="900" fill={u('glow')} />

      {/* The lamp: cord, shade, bulb */}
      <line x1="1330" y1="0" x2="1330" y2="34" stroke="#241a14" strokeWidth="4" />
      <path d="M1298 34 L1362 34 L1424 112 Q 1330 128 1236 112 Z" fill="#1d1510" />
      <path d="M1236 112 Q 1330 128 1424 112 Q 1330 140 1236 112 Z" fill="#f6c25a" opacity="0.85" />
      <circle cx="1330" cy="106" r="26" fill="#fff3cf" filter={u('bulb')} opacity="0.95" />
      <circle cx="1330" cy="110" r="12" fill="#fffaf0" />

      {/* Shavings: a shadow pass, then the pale curl with a highlight */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <g stroke="#1a0f08" strokeWidth="10" opacity="0.35" transform="translate(4 6)">
          <path d="M960 752 c 18 -34 54 -42 72 -18 c 14 18 -6 42 -30 36 c -16 -4 -16 -24 -2 -30 c 12 -6 26 2 24 16" />
          <path d="M1250 700 c 30 -28 72 -24 84 0 c 8 16 -10 30 -28 24 c -16 -6 -14 -26 4 -30" />
          <path d="M400 690 c 24 -30 60 -34 76 -10 c 10 16 -8 36 -30 30 c -18 -6 -16 -28 4 -32" />
          <path d="M630 742 c 22 -26 52 -28 66 -8 c 10 14 -4 32 -24 28 c -14 -4 -16 -22 -2 -28" />
        </g>
        <g stroke="#d9a86c" strokeWidth="9">
          <path d="M960 752 c 18 -34 54 -42 72 -18 c 14 18 -6 42 -30 36 c -16 -4 -16 -24 -2 -30 c 12 -6 26 2 24 16" />
          <path d="M1250 700 c 30 -28 72 -24 84 0 c 8 16 -10 30 -28 24 c -16 -6 -14 -26 4 -30" />
          <path d="M400 690 c 24 -30 60 -34 76 -10 c 10 16 -8 36 -30 30 c -18 -6 -16 -28 4 -32" />
          <path d="M630 742 c 22 -26 52 -28 66 -8 c 10 14 -4 32 -24 28 c -14 -4 -16 -22 -2 -28" />
        </g>
        <g stroke="#f3cf95" strokeWidth="3" opacity="0.8" transform="translate(-1 -2)">
          <path d="M960 752 c 18 -34 54 -42 72 -18" />
          <path d="M1250 700 c 30 -28 72 -24 84 0" />
          <path d="M400 690 c 24 -30 60 -34 76 -10" />
          <path d="M630 742 c 22 -26 52 -28 66 -8" />
        </g>
      </g>
      {/* Sawdust */}
      <g fill="#d9a86c" opacity="0.6">
        <circle cx="1046" cy="764" r="2.5" />
        <circle cx="1070" cy="758" r="1.8" />
        <circle cx="1230" cy="724" r="2" />
        <circle cx="1352" cy="716" r="2.4" />
        <circle cx="1120" cy="748" r="1.6" />
        <circle cx="500" cy="712" r="2" />
        <circle cx="720" cy="756" r="1.8" />
      </g>

      {/* The die's shadow on the bench, then the die itself, tilted mid-tumble and floating above it */}
      <ellipse className="title-shadow" cx="1108" cy="700" rx="172" ry="30" fill="#140a04" opacity="0.55" filter={u('blur')} />
      <g className="title-die">
        <g transform={`translate(${DIE_AT[0]} ${DIE_AT[1]}) rotate(${DIE_TILT}) translate(${-DIE_CENTRE[0]} ${-DIE_CENTRE[1]})`}>
          {/* Silhouette with a thick round-joined stroke: the softened edges of a carved die */}
          <polygon points={points(SILHOUETTE)} fill="#e8dec6" stroke="#e8dec6" strokeWidth="14" strokeLinejoin="round" />
          {/* Front face, 5 */}
          <g>
            <rect x="0" y="0" width={S} height={S} fill={u('face-front')} />
            {FRONT_PIPS.map(([cx, cy]) => (
              <circle key={`f${cx}-${cy}`} cx={cx} cy={cy} r={PIP_R} fill="#1a1826" />
            ))}
          </g>
          {/* Top face, 3, receding up and right */}
          <g transform={`matrix(1 0 ${RECEDE_X} ${-RECEDE_Y} 0 0)`}>
            <rect x="0" y="0" width={S} height={S} fill="#fbf6ea" />
            {TOP_PIPS.map(([cx, cy]) => (
              <circle key={`t${cx}-${cy}`} cx={cx} cy={cy} r={PIP_R} fill="#1a1826" />
            ))}
          </g>
          {/* Right face, 6, receding right */}
          <g transform={`matrix(${RECEDE_X} ${-RECEDE_Y} 0 1 ${S} 0)`}>
            <rect x="0" y="0" width={S} height={S} fill={u('face-right')} />
            {RIGHT_PIPS.map(([cx, cy]) => (
              <circle key={`r${cx}-${cy}`} cx={cx} cy={cy} r={PIP_R} fill="#1a1826" />
            ))}
          </g>
          {/* Edges between the faces */}
          <g fill="none" stroke="#cfc3a8" strokeWidth="2" strokeLinejoin="round" opacity="0.9">
            <polygon points={points(TOP_FACE)} />
            <polygon points={points(RIGHT_FACE)} />
            <rect x="0" y="0" width={S} height={S} />
          </g>
        </g>
      </g>

      {/* Dust in the lamplight */}
      {motes && (
        <g fill="#ffe3a8">
          {MOTES.map((m) => (
            <circle key={`${m.x}-${m.y}`} className="title-mote" cx={m.x} cy={m.y} r={m.r} style={moteStyle(m)} />
          ))}
        </g>
      )}
    </svg>
  )
}

interface WorkbenchSceneProps {
  /** Render the drifting motes; TitleScreen passes false under reduce motion so no DOM is spent on them. */
  readonly motes?: boolean
  readonly className?: string
}

/** The scene, filling its container: the 16:9 frame in landscape, the square frame around the die in portrait. */
export function WorkbenchScene({ motes = true, className }: WorkbenchSceneProps) {
  return (
    <div className={className} aria-hidden="true">
      <Crop id="wb-wide" viewBox="0 0 1600 900" className="hidden size-full landscape:block" motes={motes} />
      <Crop id="wb-tall" viewBox="700 0 900 900" className="size-full landscape:hidden" motes={motes} />
    </div>
  )
}
