// The two state transitions shared by dispatch and advance: one roll of every owned die, and the
// auto-roll unlock check that follows anything able to satisfy its condition.
import { dieDef, rules } from './defs'
import { rollPoints, unlockSatisfied } from './formulas'
import { N } from './num'
import { restoreRng } from './rng'
import type { GameState } from './state'

/**
 * Rolls every owned die once, in content order, with the RNG restored from the state and saved
 * back. Adds the points, counts the roll and records it as lastRoll at simulated time `at`. Runs
 * the auto-roll unlock check, since totalEarned grew.
 */
export function performRoll(state: GameState, at: number): GameState {
  const rng = restoreRng(state.rng)
  const faces: number[] = []
  for (const die of state.dice) {
    if (die.owned) faces.push(rng.rollDie(dieDef(die.id).sides))
  }
  const gained = rollPoints(state, faces)
  return unlockAutoRoll({
    ...state,
    rng: rng.getState(),
    points: N.add(state.points, gained),
    totalEarned: N.add(state.totalEarned, gained),
    rolls: state.rolls + 1,
    lastRoll: { faces, gained, at },
  })
}

/** Unlocks auto-roll (and switches it on) once the content rule holds. Same object otherwise. */
export function unlockAutoRoll(state: GameState): GameState {
  if (state.autoRoll.unlocked || !unlockSatisfied(rules.autoRoll.unlock, state)) return state
  return { ...state, autoRoll: { ...state.autoRoll, unlocked: true, enabled: true } }
}
