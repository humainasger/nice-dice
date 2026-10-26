// Public surface of the pure simulation layer. The app, the ui and the sim import core through
// this file. roll.ts (performRoll, unlockAutoRoll), ascend.ts and draft.ts stay internal apart
// from the read helpers below: every state change outside core goes through dispatch and advance.
export * from './num'
export * from './rng'
export * from './state'
export { dieDef, comboDef, charmDef, trophyDef, luckUpgradeDef, isComboId, isCharmId, isTrophyId, isLuckUpgradeId, combosByStrength, rarityOrder } from './defs'
export * from './formulas'
export { bestHand, handCounts, handMembers, type HandCounts } from './hands'
export { trophyEarned } from './trophies'
export { eligibleCharms } from './draft'
export * from './commands'
export * from './advance'
export * from './save'
export * from './selectors'
