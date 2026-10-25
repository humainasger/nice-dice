// Commands and dispatch: the only way a player action changes state. Pure; an invalid command or
// a no-op returns the very same state object, so callers can tell "nothing happened" by identity.
// Every command that changed something is followed by the trophy check.
import type { ComboId, Id } from '@/content'
import { ascendDie, autoAscendAll, replaceDie } from './ascend'
import { dieDef, isComboId, rules } from './defs'
import { drawOffer, openDraftIfReady } from './draft'
import {
  autoRollInterval,
  bulkCost,
  comboLevel,
  comboUpgradeCost,
  draftRequirement,
  faceCap,
  faceUpgradeCost,
  findDie,
  levelCap,
  levelsBuyable,
  lowestFaceIndex,
  luckOnReset,
  unlockSatisfied,
} from './formulas'
import { N } from './num'
import { performRoll, unlockAutoRoll } from './roll'
import { createInitialState, initialDice, initialDraft } from './save'
import type { GameState } from './state'
import { checkTrophies } from './trophies'

export type Command =
  /** Manual roll, always allowed. */
  | { readonly type: 'roll' }
  /** Buy an unowned die whose unlock condition holds and whose baseCost is affordable. */
  | { readonly type: 'buyDie'; readonly id: Id }
  /**
   * Buy up to `count` levels of an owned die, as many as affordable and never past the cap; 'max'
   * buys every affordable level. With auto-ascend on, a die that reaches or sits at the cap ascends.
   */
  | { readonly type: 'levelDie'; readonly id: Id; readonly count: number | 'max' }
  /** Switch auto-roll on or off; only once it is unlocked. */
  | { readonly type: 'setAutoRoll'; readonly enabled: boolean }
  /** New game from a seed. */
  | { readonly type: 'reset'; readonly seed: number }
  /** Buy the next upgrade level of a hand. */
  | { readonly type: 'upgradeCombo'; readonly id: ComboId }
  /** Raise the lowest face of an owned die (level >= rules.face.unlockLevel) by one, up to the cap. */
  | { readonly type: 'upgradeFace'; readonly id: Id }
  /** Ascend an owned die at the level cap. */
  | { readonly type: 'ascend'; readonly id: Id }
  /** Take the charm at `index` of the open draft offer. */
  | { readonly type: 'pickCharm'; readonly index: number }
  /** Redraw the open offer, once per draft, free. */
  | { readonly type: 'rerollDraft' }
  /** Convert the run into luck; only while luckOnReset is at least 1. */
  | { readonly type: 'prestige' }
  /** Ascend dice automatically at the cap. */
  | { readonly type: 'setAutoAscend'; readonly enabled: boolean }
  /** The trophy toast was shown. */
  | { readonly type: 'clearNewTrophy' }

export function dispatch(state: GameState, command: Command): GameState {
  const next = apply(state, command)
  return next === state ? state : checkTrophies(next)
}

function apply(state: GameState, command: Command): GameState {
  switch (command.type) {
    case 'roll':
      return performRoll(state, state.playMs)
    case 'buyDie':
      return buyDie(state, command.id)
    case 'levelDie':
      return levelDie(state, command.id, command.count)
    case 'setAutoRoll':
      return setAutoRoll(state, command.enabled)
    case 'reset':
      return typeof command.seed === 'number' && Number.isFinite(command.seed) ? createInitialState(command.seed) : state
    case 'upgradeCombo':
      return upgradeCombo(state, command.id)
    case 'upgradeFace':
      return upgradeFace(state, command.id)
    case 'ascend':
      return ascendDie(state, command.id)
    case 'pickCharm':
      return pickCharm(state, command.index)
    case 'rerollDraft':
      return rerollDraft(state)
    case 'prestige':
      return prestige(state)
    case 'setAutoAscend':
      return setAutoAscend(state, command.enabled)
    case 'clearNewTrophy':
      return state.newTrophy === null ? state : { ...state, newTrophy: null }
    default:
      // Unknown type at runtime (a command built from untyped data): nothing happens.
      return state
  }
}

function buyDie(state: GameState, id: Id): GameState {
  const die = findDie(state, id)
  if (die === undefined || die.owned) return state
  const def = dieDef(id)
  if (!unlockSatisfied(def.unlock, state)) return state
  const cost = N.from(def.baseCost)
  if (N.lt(state.points, cost)) return state
  return unlockAutoRoll({
    ...state,
    points: N.max(N.sub(state.points, cost), N.zero),
    dice: replaceDie(state.dice, id, { ...die, owned: true, level: 1 }),
  })
}

function levelDie(state: GameState, id: Id, count: number | 'max'): GameState {
  const die = findDie(state, id)
  if (die === undefined || !die.owned) return state
  if (count !== 'max' && !(Number.isSafeInteger(count) && count >= 1)) return state
  const cap = levelCap()
  if (die.level >= cap) return state.autoAscend ? ascendDie(state, id) : state
  const def = dieDef(id)
  const buyable = levelsBuyable(def, die.level, state.points, die.ascensions)
  const levels = count === 'max' ? buyable : Math.min(count, buyable)
  if (levels <= 0) return state
  const level = die.level + levels
  const next = unlockAutoRoll({
    ...state,
    points: N.max(N.sub(state.points, bulkCost(def, die.level, levels, die.ascensions)), N.zero),
    dice: replaceDie(state.dice, id, { ...die, level }),
  })
  return next.autoAscend && level >= cap ? ascendDie(next, id) : next
}

function setAutoRoll(state: GameState, enabled: boolean): GameState {
  if (typeof enabled !== 'boolean') return state
  if (!state.autoRoll.unlocked || state.autoRoll.enabled === enabled) return state
  return { ...state, autoRoll: { ...state.autoRoll, enabled } }
}

function upgradeCombo(state: GameState, id: ComboId): GameState {
  if (typeof id !== 'string' || !isComboId(id)) return state
  const level = comboLevel(state, id)
  const cost = comboUpgradeCost(level)
  if (N.lt(state.points, cost)) return state
  return {
    ...state,
    points: N.max(N.sub(state.points, cost), N.zero),
    combos: { ...state.combos, [id]: level + 1 },
  }
}

function upgradeFace(state: GameState, id: Id): GameState {
  const die = findDie(state, id)
  if (die === undefined || !die.owned || die.level < rules.face.unlockLevel) return state
  const index = lowestFaceIndex(die.faces)
  const current = die.faces[index]
  if (current === undefined || current >= faceCap(state)) return state
  const cost = faceUpgradeCost(dieDef(id), die.faceUpgrades)
  if (N.lt(state.points, cost)) return state
  const faces = die.faces.map((face, i) => (i === index ? face + 1 : face))
  return {
    ...state,
    points: N.max(N.sub(state.points, cost), N.zero),
    dice: replaceDie(state.dice, id, { ...die, faces, faceUpgrades: die.faceUpgrades + 1 }),
  }
}

/** Re-derives the auto-roll interval from the held charms, keeping the partial interval below it. */
function withInterval(state: GameState): GameState {
  const intervalMs = autoRollInterval(state)
  if (intervalMs === state.autoRoll.intervalMs) return state
  const elapsedMs = Math.min(state.autoRoll.elapsedMs, intervalMs - 1)
  return { ...state, autoRoll: { ...state.autoRoll, intervalMs, elapsedMs } }
}

function pickCharm(state: GameState, index: number): GameState {
  const { draft } = state
  if (draft.offer === null || !Number.isInteger(index) || index < 0 || index >= draft.offer.length) return state
  const charm = draft.offer[index]
  if (charm === undefined) return state
  const requirement = draftRequirement(state)
  const picked: GameState = {
    ...state,
    charms: [...state.charms, charm],
    draft: { ...draft, progress: Math.max(0, draft.progress - requirement), taken: draft.taken + 1, offer: null, rerolled: false },
  }
  return openDraftIfReady(withInterval(picked))
}

function rerollDraft(state: GameState): GameState {
  const { draft } = state
  if (draft.offer === null || draft.rerolled) return state
  const { offer, rng } = drawOffer(state)
  if (offer.length === 0) return state
  return { ...state, rng, draft: { ...draft, offer, rerolled: true } }
}

/** Resets the run for luck. Keeps luck, trophies, stats, auto-ascend and the auto-roll unlock. */
function prestige(state: GameState): GameState {
  const gain = luckOnReset(state)
  if (gain < 1) return state
  return {
    ...state,
    points: N.zero,
    totalEarnedRun: N.zero,
    dice: initialDice(),
    autoRoll: { ...state.autoRoll, intervalMs: rules.autoRoll.baseIntervalMs, elapsedMs: 0 },
    lastRoll: null,
    combos: {},
    charms: [],
    draft: initialDraft(),
    luck: state.luck + gain,
    prestiges: state.prestiges + 1,
    stats: { ...state.stats, lastLuckAt: state.playMs },
  }
}

function setAutoAscend(state: GameState, enabled: boolean): GameState {
  if (typeof enabled !== 'boolean' || state.autoAscend === enabled) return state
  return autoAscendAll({ ...state, autoAscend: enabled })
}
