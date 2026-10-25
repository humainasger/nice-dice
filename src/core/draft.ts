// The charm draft: which charms can be offered, how an offer is drawn from the state's RNG
// (weighted by rarity, distinct, with a preference for charms not yet held) and when a draft opens.
import { charmDieTarget, content, type CharmDef, type Id } from '@/content'
import { rules } from './defs'
import { draftRequirement, findDie } from './formulas'
import { restoreRng } from './rng'
import type { GameState } from './state'

/** Charms worth offering: a die charm needs its die owned, everything else is always eligible. */
export function eligibleCharms(state: GameState): CharmDef[] {
  return content.charms.filter((def) => {
    const die = charmDieTarget(def.effect.target)
    return die === null || findDie(state, die)?.owned === true
  })
}

/**
 * Draws rules.draft.offerSize distinct charms by rarity weight. Charms already held are left out
 * while enough others remain, so a run sees variety first and never runs dry. Returns the offer
 * and the advanced RNG state.
 */
export function drawOffer(state: GameState): { offer: Id[]; rng: readonly number[] } {
  const size = rules.draft.offerSize
  const eligible = eligibleCharms(state)
  const unheld = eligible.filter((def) => !state.charms.includes(def.id))
  const pool = unheld.length >= size ? unheld : eligible
  const rng = restoreRng(state.rng)
  const offer: Id[] = []
  const remaining = [...pool]
  while (offer.length < size && remaining.length > 0) {
    const weights = remaining.map((def) => rules.draft.rarityWeights[def.rarity])
    const total = weights.reduce((sum, w) => sum + w, 0)
    let pick = rng.next() * total
    let index = 0
    while (index < remaining.length - 1 && pick >= (weights[index] ?? 0)) {
      pick -= weights[index] ?? 0
      index += 1
    }
    const chosen = remaining.splice(index, 1)[0]
    if (chosen !== undefined) offer.push(chosen.id)
  }
  return { offer, rng: rng.getState() }
}

/** Opens a draft when progress has reached the requirement and none is open. Same object otherwise. */
export function openDraftIfReady(state: GameState): GameState {
  const { draft } = state
  if (draft.offer !== null || draft.progress < draftRequirement(state)) return state
  const { offer, rng } = drawOffer(state)
  if (offer.length === 0) return state
  return { ...state, rng, draft: { ...draft, offer, rerolled: false } }
}
