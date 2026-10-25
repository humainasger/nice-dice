// Trophy checks: after any state change that can complete one, every trophy not yet held is
// evaluated against its content condition; the newly earned ones are appended and the latest is
// surfaced in newTrophy for a toast. Same object back when nothing was earned.
import { content, type TrophyCondition } from '@/content'
import { findDie } from './formulas'
import { N } from './num'
import type { GameState } from './state'

/** Whether a trophy condition holds for the state. */
export function trophyEarned(condition: TrophyCondition, state: GameState): boolean {
  switch (condition.kind) {
    case 'rolls':
      return state.rolls >= condition.count
    case 'dieOwned':
      return findDie(state, condition.id)?.owned === true
    case 'ascensions':
      return state.dice.reduce((sum, die) => sum + die.ascensions, 0) >= condition.count
    case 'charms':
      return state.charms.length >= condition.count
    case 'prestiges':
      return state.prestiges >= condition.count
    case 'hand':
      return (state.stats.hands[condition.combo] ?? 0) >= 1
    case 'totalEarned':
      return N.gte(state.totalEarned, condition.amount)
  }
}

/** Awards every trophy whose condition holds and is not held yet. Same object when none is new. */
export function checkTrophies(state: GameState): GameState {
  let earned: string[] | null = null
  for (const def of content.trophies) {
    if (state.trophies.includes(def.id)) continue
    if (!trophyEarned(def.condition, state)) continue
    earned ??= []
    earned.push(def.id)
  }
  if (earned === null) return state
  const latest = earned[earned.length - 1] ?? state.newTrophy
  return { ...state, trophies: [...state.trophies, ...earned], newTrophy: latest }
}
