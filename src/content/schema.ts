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
