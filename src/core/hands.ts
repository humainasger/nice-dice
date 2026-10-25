// Poker-hand detection on the sides the dice landed on (1 to 6, never the printed values), and
// the pattern counts the expected-value formula needs: for n dice, how many of the sides^n
// patterns show each side on the first die and make each best hand. Both are pure functions of
// the content combos table; the counts are memoised per (n, sides) since they never change.
import type { ComboId } from '@/content'
import { combosByStrength } from './defs'

/** The shape of a set of sides, enough to decide every hand. */
interface Shape {
  readonly n: number
  /** Size of the largest group of equal sides. */
  readonly top: number
  /** Size of the second largest group. */
  readonly second: number
  readonly distinct: number
  /** Highest minus lowest side. */
  readonly span: number
}

function shapeOf(faces: readonly number[]): Shape {
  const counts = new Map<number, number>()
  let min = Infinity
  let max = -Infinity
  for (const face of faces) {
    counts.set(face, (counts.get(face) ?? 0) + 1)
    if (face < min) min = face
    if (face > max) max = face
  }
  const groups = [...counts.values()].sort((a, b) => b - a)
  return { n: faces.length, top: groups[0] ?? 0, second: groups[1] ?? 0, distinct: counts.size, span: max - min }
}

/** Whether the shape makes the hand. The group sizes are what the hand names say, not tuning. */
function matches(id: ComboId, shape: Shape): boolean {
  switch (id) {
    case 'pair':
      return shape.top >= 2
    case 'two_pair':
      return shape.top >= 2 && shape.second >= 2
    case 'three_kind':
      return shape.top >= 3 // literal-ok: three of a kind
    case 'straight':
      return shape.n >= 3 && shape.distinct === shape.n && shape.span === shape.n - 1 // literal-ok: a run needs three dice
    case 'full_house':
      return shape.top >= 3 && shape.second >= 2 // literal-ok: a triple and a pair
    case 'four_kind':
      return shape.top >= 4 // literal-ok: four of a kind
    case 'five_kind':
      return shape.top >= 5 // literal-ok: five of a kind
  }
}

/** The strongest hand the sides make (by base multiplier), or null with fewer than two dice or no hand. */
export function bestHand(faces: readonly number[]): ComboId | null {
  if (faces.length < 2) return null
  const shape = shapeOf(faces)
  for (const def of combosByStrength) {
    if (matches(def.id, shape)) return def.id
  }
  return null
}

/**
 * Which dice (indexes into `faces`) form the best hand, for the UI to ring them: every die of a
 * straight, full house or five of a kind; the matched groups otherwise (the largest, then the second
 * for two pair; the higher side wins a tie). Empty without a hand.
 */
export function handMembers(faces: readonly number[]): number[] {
  const hand = bestHand(faces)
  if (hand === null) return []
  if (hand === 'straight' || hand === 'full_house' || hand === 'five_kind') return faces.map((_, index) => index)
  const counts = new Map<number, number>()
  for (const face of faces) counts.set(face, (counts.get(face) ?? 0) + 1)
  const grouped = [...counts.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1] || b[0] - a[0])
  const kept = new Set(grouped.slice(0, hand === 'two_pair' ? 2 : 1).map(([face]) => face))
  return faces.flatMap((face, index) => (kept.has(face) ? [index] : []))
}

/** Best hand per pattern, counted. `null` keys stand for "no hand". */
export interface HandCounts {
  /** sides ^ n. */
  readonly patterns: number
  /** byFace.get(hand)[side - 1]: patterns whose first die shows `side` and whose best hand is `hand`. */
  readonly byFace: ReadonlyMap<ComboId | null, readonly number[]>
  /** Patterns per best hand. */
  readonly total: ReadonlyMap<ComboId | null, number>
}

const cache = new Map<string, HandCounts>()

/**
 * Enumerates every pattern of n dice with `sides` sides once and counts best hands, overall and
 * split by the first die's side. The dice are interchangeable, so the first die stands for any
 * die. Memoised; the table for five six-sided dice is 7776 patterns.
 */
export function handCounts(n: number, sides: number): HandCounts {
  if (!Number.isSafeInteger(n) || n < 1 || !Number.isSafeInteger(sides) || sides < 1) {
    throw new Error(`handCounts needs positive integer dice and sides, got ${n} and ${sides}`)
  }
  const key = `${n}:${sides}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit

  const byFace = new Map<ComboId | null, number[]>()
  const total = new Map<ComboId | null, number>()
  const pattern: number[] = Array.from({ length: n }, () => 1)
  let patterns = 0
  for (;;) {
    patterns += 1
    const hand = bestHand(pattern)
    let row = byFace.get(hand)
    if (row === undefined) {
      row = Array.from({ length: sides }, () => 0)
      byFace.set(hand, row)
    }
    const first = pattern[0] ?? 1
    row[first - 1] = (row[first - 1] ?? 0) + 1
    total.set(hand, (total.get(hand) ?? 0) + 1)
    // Odometer: bump the last die, carrying into the previous ones; done when every die wrapped.
    let i = n - 1
    while (i >= 0 && pattern[i] === sides) {
      pattern[i] = 1
      i -= 1
    }
    if (i < 0) break
    pattern[i] = (pattern[i] ?? 1) + 1
  }
  const counts: HandCounts = { patterns, byFace, total }
  cache.set(key, counts)
  return counts
}
