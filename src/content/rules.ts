// The rules table: global tunables that belong to no single die. Auto-roll baseline and unlock
// (GDD section 6, Roll row), the offline policy (GDD section 9) and the M3 systems from
// docs/plans/active/m3-game.md: ascension (GDD section 4 and 5), combos (section 5), face editing
// (section 5 and 6), the charm draft (section 5), luck (section 7, with the M4 log formula and the
// auto-level cadence from docs/plans/active/m4-luck.md), the M5 luck sinks mastery and Fortune's
// Favour (section 7.1, docs/plans/active/m5-theme.md sections 1 and 2) and trophies (section 10).
// Plain numbers only; core reads them through src/core/defs.ts. The schema lives here because the
// table is one object, not rows with ids like dice.
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
    /** Absences shorter than this are not credited or shown (a quick reload is not "away"). */
    minAwayMs: z.number().int().positive(),
    /** A gap between frames longer than this (tab frozen, laptop asleep) goes through the offline policy. */
    foregroundCatchupMs: z.number().int().positive(),
  }),
  ascension: z.strictObject({
    /** A die stops levelling here and can ascend. GDD section 4: "Ascension at level 100". */
    level: z.number().int().positive(),
    /** Output multiplier per ascension, compounding. GDD section 4 and 5: x100 per ascension. */
    multiplier: z.number().gt(1),
    /**
     * Level cost multiplier per ascension, compounding, so a die's cost curve does not restart from
     * baseCost each cycle. Without it an ascension cycle costs the same ~250K every time while output
     * goes x100 and the game runs away within minutes of the first ascension; at 100 (a cycle costs
     * what it pays) charms and luck still tip it into a runaway inside the first hour. 300 kept the
     * first ascension at about 14 minutes and the first luck inside its window (docs/BALANCE_LOG.md,
     * 2026-10-25); 400 since 2026-10-26 (M4): each ascension now costs four times what it pays, which
     * caps a 20-minute run at about 12 ascensions per die instead of 15 to 21 and puts the 8 h
     * lifetime total inside its 1e25 to 1e45 window (docs/BALANCE_LOG.md). GDD section 4, level cost rule.
     */
    costMultiplier: z.number().min(1),
  }),
  combo: z.strictObject({
    /** Cost of the first upgrade level of any hand. m3-game.md section 1: 50. */
    upgradeCost: z.number().positive(),
    /** Cost growth per upgrade level. GDD section 5: "upgrade growth 2.35 baseline". */
    costGrowth: z.number().gt(1),
    /** Each level adds this share of the base multiplier: base x (1 + step x level). m3-game.md: 0.1. */
    step: z.number().positive(),
  }),
  face: z.strictObject({
    /** Highest value a face can be raised to before charms. m3-game.md section 2: 12. */
    cap: z.number().int().positive(),
    /** First face upgrade costs die baseCost x costFactor. m3-game.md: 5. */
    costFactor: z.number().positive(),
    /** Cost growth per face upgrade on the same die. m3-game.md: 1.6. */
    costGrowth: z.number().gt(1),
    /** Face editing opens on a die at this level or more. m3-game.md: 10. */
    unlockLevel: z.number().int().positive(),
  }),
  draft: z.strictObject({
    /**
     * Draft requirement = ceil(growth ^ charmsTaken) ascensions. GDD section 5: Idle Dice baseline
     * 1.15; 1.3 since 2026-10-26 (M4), the top of the brief's range, so a run holds about 14 charms
     * at 8 h instead of 20 (docs/BALANCE_LOG.md). The first draft still costs one ascension.
     */
    growth: z.number().gt(1),
    /** Charms offered per draft. m3-game.md section 4: three. */
    offerSize: z.number().int().positive(),
    /** Relative draw weights per rarity. m3-game.md section 4: common 6, rare 3, epic 1. */
    rarityWeights: z.strictObject({
      common: z.number().positive(),
      rare: z.number().positive(),
      epic: z.number().positive(),
    }),
  }),
  luck: z.strictObject({
    /**
     * Prestige opens once the run has earned this much. GDD section 7 trigger; m3-game.md section 5
     * baseline 1e6, retuned to 1e10 on 2026-10-25: the first ascension (about 14 min) multiplies
     * income thirtyfold at once, so 1e6 fell inside the same minute and the first luck landed at
     * 16 min against a 30 to 90 minute window (docs/BALANCE_LOG.md).
     */
    threshold: z.number().positive(),
    /** Points multiplier is 1 + perPoint x luckTotal (lifetime luck, spent or not). GDD section 7 formula; m3-game.md: 0.1. */
    perPoint: z.number().positive(),
    /**
     * Luck on reset = floor(perDecade x log10(totalEarnedRun / threshold)) + 1 once the run has
     * reached the threshold. A log curve so luck cannot run away with the run total. m4-luck.md
     * section 1: 10 to start, tuned by the sim (docs/BALANCE_LOG.md). GDD section 7 formula.
     */
    perDecade: z.number().positive(),
    /** Auto-level (the steady_hands upgrade) buys once per this much simulated time. m4-luck.md section 2: every simulated second. */
    autoLevelEveryMs: z.number().int().positive(),
  }),
  mastery: z.strictObject({
    /**
     * Luck price of the first mastery level on a die; the next level costs ceil(baseCost x
     * costGrowth ^ level). Unbounded and permanent across luck resets. m5-theme.md section 1: 2.
     * GDD section 7.1.
     */
    baseCost: z.number().positive(),
    /** Cost growth per mastery level on the same die. m5-theme.md section 1: 1.35. GDD section 7.1. */
    costGrowth: z.number().gt(1),
    /** Each mastery level multiplies that die's output by (1 + step x level). m5-theme.md section 1: 0.1. GDD section 7.1. */
    step: z.number().positive(),
  }),
  favour: z.strictObject({
    /**
     * Luck price of the next Fortune's Favour level: ceil(costGrowth ^ level), so level 0 costs 1.
     * Unbounded and permanent across luck resets. m5-theme.md section 2: 1.5. GDD section 7.1.
     */
    costGrowth: z.number().gt(1),
    /** Each favour level multiplies every roll by (1 + step x level). m5-theme.md section 2: 0.05. GDD section 7.1. */
    step: z.number().positive(),
  }),
  trophy: z.strictObject({
    /** Points multiplier per held trophy, compounding. GDD section 10; m3-game.md section 6: 1.02. */
    multiplier: z.number().gt(1),
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
    minAwayMs: 10000,
    foregroundCatchupMs: 60000,
  },
  ascension: {
    level: 100,
    multiplier: 100,
    costMultiplier: 400,
  },
  combo: {
    upgradeCost: 50,
    costGrowth: 2.35,
    step: 0.1,
  },
  face: {
    cap: 12,
    costFactor: 5,
    costGrowth: 1.6,
    unlockLevel: 10,
  },
  draft: {
    growth: 1.3,
    offerSize: 3,
    rarityWeights: { common: 6, rare: 3, epic: 1 },
  },
  luck: {
    threshold: 10000000000,
    perPoint: 0.1,
    perDecade: 10,
    autoLevelEveryMs: 1000,
  },
  mastery: {
    baseCost: 2,
    costGrowth: 1.35,
    step: 0.1,
  },
  favour: {
    costGrowth: 1.5,
    step: 0.05,
  },
  trophy: {
    multiplier: 1.02,
  },
}
