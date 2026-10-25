// The rules table: global tunables that belong to no single die. Auto-roll baseline and unlock
// (GDD section 6, Roll row) and the offline policy (GDD section 9). Plain numbers only; core
// reads them through src/core/defs.ts. The schema lives here because the table is one object,
// not rows with ids like dice.
import { z } from 'zod'
import { unlockConditionSchema } from './schema'

export const rulesSchema = z.strictObject({
  autoRoll: z.strictObject({
    /** Milliseconds between automatic rolls at baseline. GDD section 6: "auto-roll every 5 s baseline". */
    baseIntervalMs: z.number().int().positive(),
    /** When auto-roll unlocks. docs/plans/active/m1-core.md: die_1 reaches level 2. GDD section 6 unlock column: TODO owner. */
    unlock: unlockConditionSchema,
  }),
  offline: z.strictObject({
    /** Fixed tick length for replaying time away. GDD section 9: 100 ms. */
    tickMs: z.number().int().positive(),
    /** Ticks replayed before the expected-value remainder takes over. GDD section 9: 1e5. */
    maxTicks: z.number().int().positive(),
    /** Longest absence that earns anything. GDD section 9: 8 h baseline, TODO owner. */
    capMs: z.number().int().positive(),
  }),
})
export type RulesDef = z.infer<typeof rulesSchema>

export const rules: RulesDef = {
  autoRoll: {
    baseIntervalMs: 5000,
    unlock: { kind: 'owned', id: 'die_1', count: 2 },
  },
  offline: {
    tickMs: 100,
    maxTicks: 100000,
    capMs: 28800000,
  },
}
