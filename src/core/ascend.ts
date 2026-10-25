// Ascension: a die at the level cap goes back to level 1 with one more ascension (output x
// rules.ascension.multiplier) and adds one to the draft progress, which may open a draft. Shared
// by the ascend command, levelDie's auto-ascend and the sweep in advance.
import type { Id } from '@/content'
import { openDraftIfReady } from './draft'
import { findDie, levelCap } from './formulas'
import type { DieState, GameState } from './state'

export function replaceDie(dice: readonly DieState[], id: Id, next: DieState): DieState[] {
  return dice.map((die) => (die.id === id ? next : die))
}

/** Whether the die is owned and sitting at the cap. */
export function canAscendDie(state: GameState, id: Id): boolean {
  const die = findDie(state, id)
  return die !== undefined && die.owned && die.level >= levelCap()
}

/** Ascends the die when it can; the same object otherwise. */
export function ascendDie(state: GameState, id: Id): GameState {
  const die = findDie(state, id)
  if (die === undefined || !die.owned || die.level < levelCap()) return state
  return openDraftIfReady({
    ...state,
    dice: replaceDie(state.dice, id, { ...die, level: 1, ascensions: die.ascensions + 1 }),
    draft: { ...state.draft, progress: state.draft.progress + 1 },
  })
}

/** With auto-ascend on, ascends every die at the cap. Same object when none is. */
export function autoAscendAll(state: GameState): GameState {
  if (!state.autoAscend) return state
  let next = state
  for (const die of state.dice) {
    if (die.owned && die.level >= levelCap()) next = ascendDie(next, die.id)
  }
  return next
}
