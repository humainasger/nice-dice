// Selectors for the bench beyond the die slot view (selectors.ts): the count of automations that
// are on for the Automation button, and the unlock copy the automation sheet shows on a switch it
// has to keep disabled. The last roll's faces and hand members for the callout live in selectors.ts
// (selectLastRollFaceList, selectLastRollMemberList). Primitives and strings only.
import { content } from '@/content'
import { luckUpgradeDef } from '@/core'
import { describeUnlock } from './selectors'
import type { StoreState } from './store'

/** The luck upgrade that unlocks auto-level (src/content/luckUpgrades.ts). */
const AUTO_LEVEL_UPGRADE = 'steady_hands'

/** How many of the three automations (roll, level, refine) are on, for the count on the Automation button. */
export const selectAutomationOnCount = (s: StoreState): number => {
  let n = 0
  if (s.game.autoRoll.unlocked && s.game.autoRoll.enabled) n += 1
  if (s.game.autoLevel) n += 1
  if (s.game.autoAscend) n += 1
  return n
}

/** "level the Pine Die to 2": what unlocks auto-roll, as a clause for the sheet's hint. */
export const selectAutoRollUnlockText = (): string => describeUnlock(content.rules.autoRoll.unlock)

/** "Steady Hands": the luck upgrade the auto-level switch waits for. */
export const selectAutoLevelUpgradeName = (): string => luckUpgradeDef(AUTO_LEVEL_UPGRADE).name
