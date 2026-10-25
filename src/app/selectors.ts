// String and primitive selectors for the UI, so components never build objects or hand Decimals
// to React (CLAUDE.md rule 4). Object-shaped views go through useShallow at the call site.
import type { Id } from '@/content'
import { N, bulkCost, dieView, expectedPointsPerSecond, pointsPerRollExpected } from '@/core'
import type { StoreState } from './store'

export const selectPointsText = (s: StoreState): string => N.format(s.game.points)
export const selectPerRollText = (s: StoreState): string => N.format(pointsPerRollExpected(s.game))
export const selectPerSecondText = (s: StoreState): string => N.format(expectedPointsPerSecond(s.game))
export const selectRolls = (s: StoreState): number => s.game.rolls
export const selectLastGainedText = (s: StoreState): string =>
  s.game.lastRoll === null ? '' : N.format(s.game.lastRoll.gained)
export const selectAutoUnlocked = (s: StoreState): boolean => s.game.autoRoll.unlocked
export const selectAutoEnabled = (s: StoreState): boolean => s.game.autoRoll.enabled
export const selectAutoProgress = (s: StoreState): number => {
  const { elapsedMs, intervalMs } = s.game.autoRoll
  return intervalMs > 0 ? Math.min(1, elapsedMs / intervalMs) : 0
}
export const selectOfflineText = (s: StoreState): string => {
  const o = s.offline
  if (o === null) return ''
  const minutes = Math.round(o.elapsedMs / 60_000)
  const estimated = o.estimatedMs > 0 ? ', partly estimated' : ''
  return `Away ${minutes} min: ${o.rolls} rolls, ${N.format(o.gained)} points${estimated}`
}

export interface DieCardView {
  readonly name: string
  readonly owned: boolean
  readonly unlocked: boolean
  readonly level: number
  readonly multiplier: string
  readonly nextCost: string
  readonly cost10: string
  readonly affordable: boolean
  readonly maxAffordable: number
  readonly canBuy: boolean
  readonly face: number | null
}

/** Selector factory for one die card. index is the die's position in content order. */
export function selectDieCard(id: Id, index: number): (s: StoreState) => DieCardView {
  return (s) => {
    const v = dieView(s.game, id)
    const faces = s.game.lastRoll?.faces
    const face = faces !== undefined && index < faces.length ? (faces[index] ?? null) : null
    return {
      name: v.def.name,
      owned: v.owned,
      unlocked: v.unlocked,
      level: v.level,
      multiplier: N.format(v.multiplier),
      nextCost: N.format(v.nextCost),
      cost10: v.owned ? N.format(bulkCost(v.def, v.level, 10)) : '',
      affordable: v.affordable,
      maxAffordable: v.maxAffordable,
      canBuy: v.canBuy,
      face,
    }
  }
}
