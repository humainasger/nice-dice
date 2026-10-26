// The charms table: the fourteen draftable charms (docs/plans/active/m3-game.md section 4; GDD
// section 5, Draft picks row). Rarity picks the draw weight (rules.draft.rarityWeights); the effect
// says what the charm multiplies or adds. Charms stack multiplicatively and reset on luck (the
// memory upgrade keeps up to three). Plain values only; core applies them in src/core/formulas.ts.
// The die cups were x3 (common) and x6 (rare) in M3; x2 and x4 since 2026-10-26 (M4), the second
// lever of the late-game retune (docs/BALANCE_LOG.md).
import type { CharmDef } from './schema'

const NOTES = 'baseline from docs/plans/active/m3-game.md section 4, tune via GDD section 5'
const CUP_NOTES = 'm3-game.md section 4 baseline x3 common / x6 rare, retuned 2026-10-26 to x2 / x4 (docs/BALANCE_LOG.md); tune via GDD section 5'

export const charms: readonly CharmDef[] = [
  {
    id: 'worn_felt',
    name: 'Worn Felt',
    flavour: 'The table remembers every roll.',
    rarity: 'common',
    effect: { target: 'points', op: 'mul', value: 1.25 },
    notes: NOTES,
  },
  {
    id: 'chalk_mark',
    name: 'Chalk Mark',
    flavour: 'A tally nobody wipes away.',
    rarity: 'common',
    effect: { target: 'points', op: 'mul', value: 1.25 },
    notes: NOTES,
  },
  {
    id: 'silver_thimble',
    name: 'Silver Thimble',
    flavour: 'Catches the pips before they scatter.',
    rarity: 'rare',
    effect: { target: 'points', op: 'mul', value: 1.5 },
    notes: NOTES,
  },
  {
    id: 'golden_pip',
    name: 'Golden Pip',
    flavour: 'One dot on one die, worth the rest of the set.',
    rarity: 'epic',
    effect: { target: 'points', op: 'mul', value: 2 },
    notes: NOTES,
  },
  {
    id: 'oak_cup',
    name: 'Oak Cup',
    flavour: 'The first die rolls out of something older than the game.',
    rarity: 'common',
    effect: { target: 'die:die_1', op: 'mul', value: 2 },
    notes: CUP_NOTES,
  },
  {
    id: 'tin_cup',
    name: 'Tin Cup',
    flavour: 'Dented, loud and lucky for the second die.',
    rarity: 'common',
    effect: { target: 'die:die_2', op: 'mul', value: 2 },
    notes: CUP_NOTES,
  },
  {
    id: 'clay_cup',
    name: 'Clay Cup',
    flavour: 'Fired once, thrown a thousand times. Third die.',
    rarity: 'common',
    effect: { target: 'die:die_3', op: 'mul', value: 2 },
    notes: CUP_NOTES,
  },
  {
    id: 'copper_cup',
    name: 'Copper Cup',
    flavour: 'Warm to the touch; the fourth die comes out heavier.',
    rarity: 'rare',
    effect: { target: 'die:die_4', op: 'mul', value: 4 },
    notes: CUP_NOTES,
  },
  {
    id: 'ivory_cup',
    name: 'Ivory Cup',
    flavour: 'Kept for the fifth die and nothing else.',
    rarity: 'rare',
    effect: { target: 'die:die_5', op: 'mul', value: 4 },
    notes: CUP_NOTES,
  },
  {
    id: 'card_sharp',
    name: 'Card Sharp',
    flavour: 'Every hand reads a little richer.',
    rarity: 'rare',
    effect: { target: 'combo', op: 'mul', value: 1.25 },
    notes: NOTES,
  },
  {
    id: 'wound_spring',
    name: 'Wound Spring',
    flavour: 'The cup tips a beat sooner.',
    rarity: 'rare',
    effect: { target: 'autoroll', op: 'mul', value: 0.85 },
    notes: NOTES,
  },
  {
    id: 'quick_hand',
    name: 'Quick Hand',
    flavour: 'Gather, shake, throw. No pause between.',
    rarity: 'epic',
    effect: { target: 'autoroll', op: 'mul', value: 0.7 },
    notes: NOTES,
  },
  {
    id: 'whittling_knife',
    name: 'Whittling Knife',
    flavour: 'Room on every face for two more pips.',
    rarity: 'epic',
    effect: { target: 'face_cap', op: 'add', value: 2 },
    notes: NOTES,
  },
  {
    id: 'second_helping',
    name: 'Second Helping',
    flavour: 'The next draft comes around sooner.',
    rarity: 'epic',
    effect: { target: 'draft_growth', op: 'add', value: -0.05 },
    notes: NOTES,
  },
]
