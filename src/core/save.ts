// The save format: SAVE_VERSION, the initial state, exact serialisation with every Num as
// N.serialize text, and parseSave, which migrates, deep-merges over defaults, validates with zod
// and never throws on bad input. A state-shape change bumps SAVE_VERSION, adds a migration to the
// ordered map and a fixture in tests/fixtures/saves (see save.migration.test.ts).
//
// Defaults policy: a field the save lacks (at any version) takes the value of a fresh initial
// state, so a save written before a field existed still loads. A truncated save therefore heals
// rather than fails; the invariants below (first die owned, totalEarned >= totalEarnedRun >=
// points, luckTotal >= luck, faces consistent with their upgrades and cap, elapsedMs below
// intervalMs, auto-roll enabled only once unlocked) are what the schema does refuse, so that every
// state parseSave accepts is one advance and dispatch keep loadable. Ids of content rows that no
// longer exist (dice, combos, charms, trophies, luck upgrades, mastery) are dropped on load
// instead of refused, and a luck upgrade level above its content cap is clamped.
import { z } from 'zod'
import { content, idSchema, type ComboId, type Id, type LuckUpgradeId } from '@/content'
import { isCharmId, isComboId, isDieId, isLuckUpgradeId, isTrophyId, luckUpgradeDef, rules } from './defs'
import { charmEffectsOf } from './formulas'
import { bestHand } from './hands'
import { N, type Num } from './num'
import { createRng, restoreRng } from './rng'
import type { DieState, Draft, GameState, Stats } from './state'

export const SAVE_VERSION = 4 // literal-ok: the save format version, not a balance value

/** The sides of a fresh die: 1 to sides. */
export function defaultFaces(sides: number): number[] {
  return Array.from({ length: sides }, (_, index) => index + 1)
}

const sidesOf = (id: string): number => content.dice.find((def) => def.id === id)?.sides ?? content.dice[0]?.sides ?? 1

/** One slot per content die, in content order; the first die starts owned at level 1. */
export function initialDice(): DieState[] {
  return content.dice.map((def, index) => ({
    id: def.id,
    owned: index === 0,
    level: index === 0 ? 1 : 0,
    faces: defaultFaces(def.sides),
    ascensions: 0,
    faceUpgrades: 0,
  }))
}

export function initialDraft(): Draft {
  return { progress: 0, taken: 0, offer: null, rerolled: false }
}

export function initialStats(): Stats {
  return { bestRoll: N.zero, hands: {}, lastLuckAt: 0 }
}

/** A new game. Throws on a non-finite seed (createRng). */
export function createInitialState(seed: number): GameState {
  return {
    version: SAVE_VERSION,
    seed,
    rng: createRng(seed).getState(),
    points: N.zero,
    totalEarned: N.zero,
    totalEarnedRun: N.zero,
    rolls: 0,
    playMs: 0,
    dice: initialDice(),
    autoRoll: { unlocked: false, enabled: false, intervalMs: rules.autoRoll.baseIntervalMs, elapsedMs: 0 },
    lastRoll: null,
    combos: {},
    charms: [],
    draft: initialDraft(),
    luck: 0,
    luckTotal: 0,
    luckUpgrades: {},
    mastery: {},
    favour: 0,
    prestiges: 0,
    trophies: [],
    newTrophy: null,
    autoAscend: true,
    autoLevel: false,
    stats: initialStats(),
  }
}

const nonNegativeNum = N.schema.refine((n) => N.gte(n, 0), { message: 'must not be negative' })
const nonNegativeInt = z.number().int().nonnegative()

const dieStateSchema = z
  .strictObject({
    id: idSchema,
    owned: z.boolean(),
    level: nonNegativeInt,
    faces: z.array(z.number().int().positive()),
    ascensions: nonNegativeInt,
    faceUpgrades: nonNegativeInt,
  })
  .refine((die) => (die.owned ? die.level >= 1 : die.level === 0), {
    message: 'an owned die has level >= 1, an unowned die level 0',
  })
  .refine((die) => die.faces.length === sidesOf(die.id), { message: 'one face per side', path: ['faces'] })
  .refine((die) => die.faces.every((face, index) => face >= index + 1), {
    message: 'a face is never below its starting value',
    path: ['faces'],
  })
  .refine((die) => die.faces.reduce((sum, face, index) => sum + face - (index + 1), 0) === die.faceUpgrades, {
    message: 'faceUpgrades must equal the total raise of the faces',
    path: ['faceUpgrades'],
  })

const rngSchema = z.array(z.number()).superRefine((state, ctx) => {
  try {
    restoreRng(state)
  } catch (error) {
    ctx.addIssue({ code: 'custom', message: error instanceof Error ? error.message : String(error) })
  }
})

/** The starting die is never lost by play; a save that lists it must own it (a slot it lacks is defaulted by alignDice). */
const FIRST_DIE_ID = content.dice[0]?.id

const diceSchema = z
  .array(dieStateSchema)
  .refine((dice) => new Set(dice.map((die) => die.id)).size === dice.length, { message: 'die ids must be unique' })
  .refine((dice) => dice.every((die) => die.id !== FIRST_DIE_ID || die.owned), {
    message: 'the first content die is always owned',
  })

const autoRollSchema = z
  .strictObject({
    unlocked: z.boolean(),
    enabled: z.boolean(),
    // Whole milliseconds from 1: advance rolls once per interval per tick, so a tiny or fractional
    // interval would turn one 100 ms tick into an unbounded number of rolls.
    intervalMs: z.number().int().positive(),
    elapsedMs: z.number().nonnegative(),
  })
  // advance always leaves elapsedMs below intervalMs; a backlog here would stamp rolls before time
  // zero and stall the next tick on one roll per interval of backlog.
  .refine((auto) => auto.elapsedMs < auto.intervalMs, {
    message: 'elapsedMs must be below intervalMs',
    path: ['elapsedMs'],
  })
  .refine((auto) => auto.unlocked || !auto.enabled, {
    message: 'auto-roll cannot be enabled before it is unlocked',
    path: ['enabled'],
  })

const draftSchema = z.strictObject({
  progress: nonNegativeInt,
  taken: nonNegativeInt,
  offer: z.array(idSchema).min(1).nullable(),
  rerolled: z.boolean(),
})

const statsSchema = z.strictObject({
  bestRoll: nonNegativeNum,
  hands: z.record(z.string(), nonNegativeInt),
  lastLuckAt: z.number().nonnegative(),
})

/** a <= b, with one point absolute plus one part per million of slack for the rounding of two sums kept at different magnitudes. */
const atMost = (a: Num, b: Num): boolean => N.lte(a, N.add(N.mul(b, 1.000001), 1)) // literal-ok: tolerance of the sanity check, not a balance value

const saveSchema = z
  .strictObject({
    version: z.literal(SAVE_VERSION),
    seed: z.number(),
    rng: rngSchema,
    points: nonNegativeNum,
    totalEarned: nonNegativeNum,
    totalEarnedRun: nonNegativeNum,
    rolls: nonNegativeInt,
    playMs: z.number().nonnegative(),
    dice: diceSchema,
    autoRoll: autoRollSchema,
    lastRoll: z
      .strictObject({
        faces: z.array(z.number().int().positive()),
        gained: nonNegativeNum,
        at: z.number().nonnegative(),
        hand: z.string().nullable(),
      })
      .nullable(),
    combos: z.record(z.string(), nonNegativeInt),
    charms: z.array(idSchema),
    draft: draftSchema,
    luck: nonNegativeInt,
    luckTotal: nonNegativeInt,
    luckUpgrades: z.record(z.string(), nonNegativeInt),
    mastery: z.record(z.string(), nonNegativeInt),
    favour: nonNegativeInt,
    prestiges: nonNegativeInt,
    trophies: z.array(idSchema).refine((ids) => new Set(ids).size === ids.length, { message: 'trophy ids must be unique' }),
    newTrophy: idSchema.nullable(),
    autoAscend: z.boolean(),
    autoLevel: z.boolean(),
    stats: statsSchema,
  })
  // Points are only ever earned into all three totals or spent from points, and the run total
  // resets with the purse, so lifetime >= run >= purse. The sums are rounded at their own
  // magnitudes (break_infinity keeps 14 digits per add), so the checks carry a small tolerance.
  // Tampered or corrupt saves are still refused; a rounding hair never quarantines a real save.
  // Luck is earned into both counters and spent from luck alone, so luckTotal >= luck exactly.
  // Runs only on a save whose fields all parsed, so the Nums are real.
  .superRefine((save, ctx) => {
    if (!atMost(save.points, save.totalEarned)) {
      ctx.addIssue({ code: 'custom', message: 'must be at least points', path: ['totalEarned'] })
    }
    if (!atMost(save.totalEarnedRun, save.totalEarned)) {
      ctx.addIssue({ code: 'custom', message: 'must be at least totalEarnedRun', path: ['totalEarned'] })
    }
    if (!atMost(save.points, save.totalEarnedRun)) {
      ctx.addIssue({ code: 'custom', message: 'must be at least points', path: ['totalEarnedRun'] })
    }
    if (save.luck > save.luckTotal) {
      ctx.addIssue({ code: 'custom', message: 'must be at least luck', path: ['luckTotal'] })
    }
    const cap = rules.face.cap + charmEffectsOf(save.charms.filter(isCharmId)).faceCap
    save.dice.forEach((die, index) => {
      if (die.faces.some((face) => face > cap)) {
        ctx.addIssue({ code: 'custom', message: `faces cannot exceed the cap of ${cap}`, path: ['dice', index, 'faces'] })
      }
    })
  }, { when: (payload) => payload.issues.length === 0 })

/** The plain JSON shape of a save: a GameState with every Num as N.serialize text. */
export type SaveShape = z.input<typeof saveSchema>

/** A string-keyed Partial record as the schema wants it: only the entries that hold a number. */
function plainLevels(record: Readonly<Partial<Record<string, number>>>): Record<string, number> {
  const plain: Record<string, number> = {}
  for (const [id, level] of Object.entries(record)) {
    if (level !== undefined) plain[id] = level
  }
  return plain
}

function toPlain(state: GameState): SaveShape {
  return {
    version: SAVE_VERSION,
    seed: state.seed,
    rng: [...state.rng],
    points: N.serialize(state.points),
    totalEarned: N.serialize(state.totalEarned),
    totalEarnedRun: N.serialize(state.totalEarnedRun),
    rolls: state.rolls,
    playMs: state.playMs,
    dice: state.dice.map((die) => ({
      id: die.id,
      owned: die.owned,
      level: die.level,
      faces: [...die.faces],
      ascensions: die.ascensions,
      faceUpgrades: die.faceUpgrades,
    })),
    autoRoll: { ...state.autoRoll },
    lastRoll:
      state.lastRoll === null
        ? null
        : { faces: [...state.lastRoll.faces], gained: N.serialize(state.lastRoll.gained), at: state.lastRoll.at, hand: state.lastRoll.hand },
    combos: { ...state.combos },
    charms: [...state.charms],
    draft: { ...state.draft, offer: state.draft.offer === null ? null : [...state.draft.offer] },
    luck: state.luck,
    luckTotal: state.luckTotal,
    luckUpgrades: { ...state.luckUpgrades },
    mastery: plainLevels(state.mastery),
    favour: state.favour,
    prestiges: state.prestiges,
    trophies: [...state.trophies],
    newTrophy: state.newTrophy,
    autoAscend: state.autoAscend,
    autoLevel: state.autoLevel,
    stats: { bestRoll: N.serialize(state.stats.bestRoll), hands: { ...state.stats.hands }, lastLuckAt: state.stats.lastLuckAt },
  }
}

/** Compact JSON of the save shape. parseSave(serializeState(s)) gives back a state equal to s. */
export function serializeState(state: GameState): string {
  return JSON.stringify(toPlain(state))
}

export type ParseSaveReason = 'invalid-json' | 'future-version' | 'schema'
export type ParseSaveResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly reason: ParseSaveReason; readonly detail: string }

/** Takes the raw JSON object of a version v save to version v + 1. Must not mutate its input. */
export type Migration = (raw: unknown) => unknown

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * v1 to v2 (M3): every die gains its six starting faces, zero ascensions and zero face upgrades,
 * with the level clamped to the new cap (auto-ascend takes it from there); lastRoll gains the
 * hand its sides made; the run total starts equal to the lifetime total (no prestige yet). The
 * other new fields (combos, charms, draft, luck, prestiges, trophies, newTrophy, autoAscend,
 * stats) take their defaults from the deep merge.
 */
function migrateV1(raw: unknown): unknown {
  if (!isPlainObject(raw)) return raw
  const dice = Array.isArray(raw['dice'])
    ? raw['dice'].map((die: unknown) => {
        if (!isPlainObject(die)) return die
        const id = typeof die['id'] === 'string' ? die['id'] : ''
        const level = typeof die['level'] === 'number' ? Math.min(die['level'], rules.ascension.level) : die['level']
        return { ...die, level, faces: defaultFaces(sidesOf(id)), ascensions: 0, faceUpgrades: 0 }
      })
    : raw['dice']
  const lastRoll = raw['lastRoll']
  const migratedRoll = isPlainObject(lastRoll)
    ? {
        ...lastRoll,
        hand:
          Array.isArray(lastRoll['faces']) && lastRoll['faces'].every((face: unknown) => typeof face === 'number')
            ? bestHand(lastRoll['faces'] as number[])
            : null,
      }
    : lastRoll
  return { ...raw, version: 2, dice, lastRoll: migratedRoll, totalEarnedRun: raw['totalEarned'] } // literal-ok: the version this migration produces
}

/**
 * v2 to v3 (M4): luck becomes spendable, so lifetime luck starts equal to the luck held (nothing
 * was spent before upgrades existed) and no upgrade is owned. autoLevel takes its default (off)
 * from the deep merge.
 */
function migrateV2(raw: unknown): unknown {
  if (!isPlainObject(raw)) return raw
  return { ...raw, version: 3, luckTotal: raw['luck'], luckUpgrades: {} } // literal-ok: the version this migration produces
}

/**
 * v3 to v4 (M5): the luck sinks. No die is mastered and Fortune's Favour is at level 0, so the
 * save keeps exactly the multipliers it had; its spendable luck can go into the sinks straight
 * away. Both fields would also default from the deep merge; they are set here so the migration
 * states the shape it produces.
 */
function migrateV3(raw: unknown): unknown {
  if (!isPlainObject(raw)) return raw
  return { ...raw, version: 4, mastery: {}, favour: 0 } // literal-ok: the version this migration produces
}

/** Keyed by source version and applied in order up to SAVE_VERSION. */
export const migrations: Readonly<Record<number, Migration>> = { 1: migrateV1, 2: migrateV2, 3: migrateV3 } // literal-ok: source save versions

/** raw over defaults: objects merge key by key, anything else in raw (arrays included) wins outright. */
function deepMerge(defaults: unknown, raw: unknown): unknown {
  if (raw === undefined) return defaults
  if (!isPlainObject(defaults) || !isPlainObject(raw)) return raw
  const merged: Record<string, unknown> = { ...defaults }
  for (const key of Object.keys(raw)) {
    if (key === '__proto__') continue
    // Own keys only: a save key named like an Object.prototype member is unknown, not a default.
    merged[key] = Object.hasOwn(defaults, key) ? deepMerge(defaults[key], raw[key]) : raw[key]
  }
  return merged
}

/**
 * One slot per content die in content order, taken from the save where it has one and from the
 * defaults where it does not (a die added to content after the save was written). Saved slots for
 * ids no longer in content are dropped.
 */
function alignDice(saved: readonly DieState[]): DieState[] {
  return initialDice().map((fallback) => saved.find((die) => die.id === fallback.id) ?? fallback)
}

/** Only the entries whose key names a hand still in content. */
function alignCombos(saved: Readonly<Record<string, number>>): Partial<Record<ComboId, number>> {
  const combos: Partial<Record<ComboId, number>> = {}
  for (const [id, level] of Object.entries(saved)) {
    if (isComboId(id)) combos[id] = level
  }
  return combos
}

/** Only the entries whose key names a luck upgrade still in content, above level 0 and clamped to the content cap. */
function alignLuckUpgrades(saved: Readonly<Record<string, number>>): Partial<Record<LuckUpgradeId, number>> {
  const upgrades: Partial<Record<LuckUpgradeId, number>> = {}
  for (const [id, level] of Object.entries(saved)) {
    if (!isLuckUpgradeId(id) || level <= 0) continue
    upgrades[id] = Math.min(level, luckUpgradeDef(id).maxLevel)
  }
  return upgrades
}

/** Only the entries whose key names a die still in content, above level 0. Mastery has no cap to clamp to. */
function alignMastery(saved: Readonly<Record<string, number>>): Partial<Record<Id, number>> {
  const mastery: Partial<Record<Id, number>> = {}
  for (const [id, level] of Object.entries(saved)) {
    if (isDieId(id) && level > 0) mastery[id] = level
  }
  return mastery
}

function fail(reason: ParseSaveReason, detail: string): ParseSaveResult {
  return { ok: false, reason, detail }
}

/**
 * Parses save text. Never throws and never mutates what it reads: invalid JSON, a future version
 * and a shape the schema rejects each come back as { ok: false } with a reason and a detail.
 * Older versions are migrated in order, then the result is merged over a fresh initial state so
 * fields the save lacks get defaults, then validated, then aligned to the content tables.
 */
export function parseSave(text: string): ParseSaveResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (error) {
    return fail('invalid-json', error instanceof Error ? error.message : String(error))
  }
  if (!isPlainObject(raw)) return fail('schema', 'save is not a JSON object')
  const version = raw['version']
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return fail('schema', `save version must be an integer from 1, got ${JSON.stringify(version)}`)
  }
  if (version > SAVE_VERSION) {
    return fail('future-version', `save version ${version} is newer than this build's ${SAVE_VERSION}`)
  }

  let migrated: unknown = raw
  for (let from = version; from < SAVE_VERSION; from++) {
    const migrate = migrations[from]
    if (migrate === undefined) return fail('schema', `no migration from save version ${from}`)
    migrated = migrate(migrated)
  }
  // The loop above defines the version a migrated save has reached; a migration that forgot to
  // bump the field must not turn into a misleading schema failure on the version literal.
  if (version < SAVE_VERSION && isPlainObject(migrated)) migrated = { ...migrated, version: SAVE_VERSION }

  // A save that lacks the run total (truncated, or hand-edited) heals to "everything so far was this
  // run", the only default that keeps the purse under it.
  if (isPlainObject(migrated) && !Object.hasOwn(migrated, 'totalEarnedRun') && Object.hasOwn(migrated, 'totalEarned')) {
    migrated = { ...migrated, totalEarnedRun: migrated['totalEarned'] }
  }
  // Likewise a save that lacks lifetime luck heals to "nothing spent yet", the only default that keeps luck under it.
  if (isPlainObject(migrated) && !Object.hasOwn(migrated, 'luckTotal') && Object.hasOwn(migrated, 'luck')) {
    migrated = { ...migrated, luckTotal: migrated['luck'] }
  }
  const seed = isPlainObject(migrated) && typeof migrated['seed'] === 'number' ? migrated['seed'] : 0
  const defaults = toPlain(createInitialState(Number.isFinite(seed) ? seed : 0))
  const result = saveSchema.safeParse(deepMerge(defaults, migrated))
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`)
      .join('; ')
    return fail('schema', detail)
  }
  const save = result.data
  const offer = save.draft.offer !== null && save.draft.offer.every(isCharmId) ? save.draft.offer : null
  const knownId = (id: Id | null): Id | null => (id !== null && isTrophyId(id) ? id : null)
  const state: GameState = {
    version: save.version,
    seed: save.seed,
    rng: save.rng,
    points: save.points,
    totalEarned: save.totalEarned,
    totalEarnedRun: save.totalEarnedRun,
    rolls: save.rolls,
    playMs: save.playMs,
    dice: alignDice(save.dice),
    autoRoll: save.autoRoll,
    lastRoll:
      save.lastRoll === null
        ? null
        : { ...save.lastRoll, hand: save.lastRoll.hand !== null && isComboId(save.lastRoll.hand) ? save.lastRoll.hand : null },
    combos: alignCombos(save.combos),
    charms: save.charms.filter(isCharmId),
    draft: { ...save.draft, offer },
    luck: save.luck,
    luckTotal: save.luckTotal,
    luckUpgrades: alignLuckUpgrades(save.luckUpgrades),
    mastery: alignMastery(save.mastery),
    favour: save.favour,
    prestiges: save.prestiges,
    trophies: save.trophies.filter(isTrophyId),
    newTrophy: knownId(save.newTrophy),
    autoAscend: save.autoAscend,
    autoLevel: save.autoLevel,
    stats: { ...save.stats, hands: alignCombos(save.stats.hands) },
  }
  return { ok: true, state }
}
