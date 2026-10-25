// A CSS-only particle burst: 16 to 24 absolutely positioned spans flung from the centre of the
// parent (which must be position: relative) along the burst keyframes in index.css. Re-fires
// whenever `trigger` changes; the first value seen never fires, so a mount after a load is quiet.
// Gold for points and hands, cool for charms and luck. Skipped under reduced motion.
import { useEffect, useState, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { useReduceMotion } from './useReduceMotion'

export type ParticleKind = 'gold' | 'cool'

/** Longest a burst is on screen: the 700 ms animation plus the longest start delay. */
export const PARTICLE_MS = 800
const DEFAULT_COUNT = 20
const MIN_COUNT = 16
const MAX_COUNT = 24

interface ParticlesProps {
  /** A counter; every change fires one burst. */
  readonly trigger: number
  readonly kind?: ParticleKind
  /** 16 to 24 spans, default 20. */
  readonly count?: number
  /** Extra classes on the burst layer (it is absolute inset-0 by default). */
  readonly className?: string
}

/** A cheap hash on (seed, index, salt) to [0, 1): one trigger always draws the same burst, so StrictMode double renders agree. */
function unit(seed: number, index: number, salt: number): number {
  let h = (seed * 374761393 + index * 668265263 + salt * 2246822519) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const COLOUR_CLASSES: Record<ParticleKind, readonly string[]> = {
  gold: ['particle-gold', 'particle-gold-alt', 'particle-gold', 'particle-gold-ivory'],
  cool: ['particle-cool', 'particle-cool-alt', 'particle-cool', 'particle-cool-ivory'],
}

function particleStyle(seed: number, i: number, count: number): CSSProperties {
  const angle = (i / count) * Math.PI * 2 + (unit(seed, i, 1) - 0.5) * 0.6
  const distance = 36 + unit(seed, i, 2) * 64
  const dx = Math.cos(angle) * distance
  // A slight upward bias: the burst rises off the table instead of raining.
  const dy = Math.sin(angle) * distance - 24
  const size = 5 + unit(seed, i, 3) * 6
  const delay = unit(seed, i, 4) * 100
  const rot = (unit(seed, i, 5) - 0.5) * 720
  const endScale = 0.15 + unit(seed, i, 6) * 0.4
  return {
    '--dx': `${dx.toFixed(1)}px`,
    '--dy': `${dy.toFixed(1)}px`,
    '--size': `${size.toFixed(1)}px`,
    '--delay': `${delay.toFixed(0)}ms`,
    '--rot': `${rot.toFixed(0)}deg`,
    '--end-scale': endScale.toFixed(2),
  } as CSSProperties
}

export function Particles({ trigger, kind = 'gold', count = DEFAULT_COUNT, className }: ParticlesProps) {
  const reduce = useReduceMotion()
  /** The trigger value at mount: that one never bursts. */
  const [first] = useState(trigger)
  /** The trigger whose burst has finished, so the layer unmounts until the next change. */
  const [expired, setExpired] = useState<number | null>(null)
  const active = trigger !== first && expired !== trigger && !reduce

  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => setExpired(trigger), PARTICLE_MS + 100)
    return () => clearTimeout(timer)
  }, [active, trigger])

  if (!active) return null
  const n = Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.round(count)))
  const colours = COLOUR_CLASSES[kind]
  return (
    <div key={trigger} aria-hidden="true" className={cn('pointer-events-none absolute inset-0', className)}>
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className={cn('particle', colours[i % colours.length], i % 3 === 0 && 'particle-square')}
          style={particleStyle(trigger, i, n)}
        />
      ))}
    </div>
  )
}
