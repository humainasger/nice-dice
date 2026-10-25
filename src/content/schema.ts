// zod schemas for the content tables and the TypeScript types inferred from them. Tables hold
// plain JSON values only (numbers and strings), never Decimal instances; core converts at use.
// Objects are strict so a misspelled key in a table fails validation instead of being ignored.
import { z } from 'zod'

/** Stable string id: lowercase snake_case, starting with a letter. */
export const idSchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/, 'id must be lowercase snake_case')
export type Id = z.infer<typeof idSchema>

/** Named player stats an effect may target. Provisional set, grown as systems land from M3 on. */
export const statNameSchema = z.enum(['points_per_roll', 'roll_interval', 'cost_scale'])
export type StatName = z.infer<typeof statNameSchema>

export const unlockConditionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('always') }),
  z.strictObject({ kind: z.literal('totalEarned'), amount: z.number().nonnegative() }),
  z.strictObject({ kind: z.literal('owned'), id: idSchema, count: z.number().int().positive() }),
  z.strictObject({ kind: z.literal('prestiges'), count: z.number().int().positive() }),
])
export type UnlockCondition = z.infer<typeof unlockConditionSchema>

/** target is a stat name or the id of a content row; TypeScript collapses that union to string. */
export const effectSchema = z.strictObject({
  target: z.union([statNameSchema, idSchema]),
  op: z.enum(['add', 'mul']),
  value: z.number(),
})
export type Effect = z.infer<typeof effectSchema>

export const dieDefSchema = z.strictObject({
  id: idSchema,
  name: z.string().min(1),
  // Only six-sided dice exist for now. Widen to z.number().int().min(2) when other dice land.
  sides: z.literal(6),
  baseCost: z.number().positive(),
  costGrowth: z.number().gt(1),
  baseMultiplier: z.number().positive(),
  unlock: unlockConditionSchema,
  notes: z.string().optional(),
})
export type DieDef = z.infer<typeof dieDefSchema>

/**
 * The seven poker hands, a closed set: core has one detector per id (src/core/hands.ts), so a
 * new hand is a core change as well as a content row. Order here is weakest to strongest; the
 * table's `base` decides which hand counts as best when a roll matches several.
 */
export const comboIdSchema = z.enum(['pair', 'two_pair', 'three_kind', 'straight', 'full_house', 'four_kind', 'five_kind'])
export type ComboId = z.infer<typeof comboIdSchema>
export const COMBO_IDS: readonly ComboId[] = comboIdSchema.options

/** One poker hand (GDD section 5, Poker-hand combo row; docs/plans/active/m3-game.md section 1). */
export const comboDefSchema = z.strictObject({
  id: comboIdSchema,
  name: z.string().min(1),
  /** Points multiplier at level 0. Upgrades add rules.combo.step of it per level. */
  base: z.number().gt(1),
  notes: z.string().optional(),
})
export type ComboDef = z.infer<typeof comboDefSchema>

export const charmRaritySchema = z.enum(['common', 'rare', 'epic'])
export type CharmRarity = z.infer<typeof charmRaritySchema>

/**
 * What a charm changes. `points` multiplies every roll, `die:<id>` multiplies that die's output,
 * `combo` multiplies the combo multiplier of any hand, `autoroll` multiplies the auto-roll
 * interval (below 1 is faster), `face_cap` adds to the face cap and `draft_growth` adds to the
 * draft requirement growth (negative softens it).
 */
export const charmTargetSchema = z.union([
  z.enum(['points', 'combo', 'autoroll', 'face_cap', 'draft_growth']),
  z.templateLiteral(['die:', idSchema]),
])
export type CharmTarget = z.infer<typeof charmTargetSchema>

export const charmEffectSchema = z.strictObject({
  target: charmTargetSchema,
  op: z.enum(['add', 'mul']),
  value: z.number(),
})
export type CharmEffect = z.infer<typeof charmEffectSchema>

/** One draftable charm (docs/plans/active/m3-game.md section 4; GDD section 5, Draft picks row). */
export const charmDefSchema = z.strictObject({
  id: idSchema,
  name: z.string().min(1),
  flavour: z.string().min(1),
  rarity: charmRaritySchema,
  effect: charmEffectSchema,
  notes: z.string().optional(),
})
export type CharmDef = z.infer<typeof charmDefSchema>

/** When a trophy is earned. Every kind reads one field of the state; core evaluates them in src/core/trophies.ts. */
export const trophyConditionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('rolls'), count: z.number().int().positive() }),
  z.strictObject({ kind: z.literal('dieOwned'), id: idSchema }),
  z.strictObject({ kind: z.literal('ascensions'), count: z.number().int().positive() }),
  z.strictObject({ kind: z.literal('charms'), count: z.number().int().positive() }),
  z.strictObject({ kind: z.literal('prestiges'), count: z.number().int().positive() }),
  z.strictObject({ kind: z.literal('hand'), combo: comboIdSchema }),
  z.strictObject({ kind: z.literal('totalEarned'), amount: z.number().positive() }),
])
export type TrophyCondition = z.infer<typeof trophyConditionSchema>

/** One achievement (GDD section 10; docs/plans/active/m3-game.md section 6). Each held trophy multiplies points by rules.trophy.multiplier. */
export const trophyDefSchema = z.strictObject({
  id: idSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  condition: trophyConditionSchema,
  notes: z.string().optional(),
})
export type TrophyDef = z.infer<typeof trophyDefSchema>
