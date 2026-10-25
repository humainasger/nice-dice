// Seeded random numbers on pure-rand's xoroshiro128plus. pure-rand 8 only ships the mutating
// style: next() advances the generator in place, so the Rng object returned here is the one and
// only holder of that mutable state and nothing else in core may keep or copy a generator. The
// sim receives an Rng as an argument and persists it with getState() / restoreRng(). Nothing in
// core creates one from the wall clock; the app layer picks the seed.
import { uniformInt } from 'pure-rand/distribution/uniformInt'
import { xoroshiro128plus, xoroshiro128plusFromState } from 'pure-rand/generator/xoroshiro128plus'

export interface Rng {
  /** Uniform float in [0, 1) with 32 bits of resolution. */
  next(): number
  /** Uniform integer in [min, max], both ends inclusive. Bounds must be integers with min <= max. */
  nextInt(min: number, max: number): number
  /** Uniform integer in [1, sides]. */
  rollDie(sides: number): number
  /** Copy of the generator state for saving. restoreRng(state) continues the same sequence. */
  getState(): readonly number[]
}

type Generator = ReturnType<typeof xoroshiro128plus>

const STATE_LENGTH = 4
const INT32_MIN = -(2 ** 31)
const INT32_MAX = 2 ** 31 - 1
const UINT32_RANGE = 2 ** 32

function wrap(generator: Generator): Rng {
  const nextInt = (min: number, max: number): number => {
    // uniformInt does not validate and returns garbage for bad bounds, so check here.
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
      throw new Error(`nextInt needs integer bounds with min <= max, got ${min} and ${max}`)
    }
    return uniformInt(generator, min, max)
  }
  return {
    next: () => (generator.next() >>> 0) / UINT32_RANGE,
    nextInt,
    rollDie: (sides) => {
      if (!Number.isSafeInteger(sides) || sides < 1) {
        throw new Error(`rollDie needs a positive integer number of sides, got ${sides}`)
      }
      return nextInt(1, sides)
    },
    getState: () => [...generator.getState()],
  }
}

/** A fresh generator. pure-rand reduces the seed to 32 bits, so any finite number works. */
export function createRng(seed: number): Rng {
  if (!Number.isFinite(seed)) throw new Error(`createRng needs a finite seed, got ${seed}`)
  return wrap(xoroshiro128plus(seed))
}

/** A generator continuing from a state captured with getState(). Throws on a malformed state. */
export function restoreRng(state: readonly number[]): Rng {
  const isInt32 = (value: number) =>
    Number.isInteger(value) && value >= INT32_MIN && value <= INT32_MAX
  if (state.length !== STATE_LENGTH || !state.every(isInt32)) {
    throw new Error(`restoreRng needs ${STATE_LENGTH} int32 values, got ${JSON.stringify(state)}`)
  }
  if (state.every((value) => value === 0)) {
    throw new Error('restoreRng: an all-zero xoroshiro state would only ever produce zeros')
  }
  return wrap(xoroshiro128plusFromState(state))
}
