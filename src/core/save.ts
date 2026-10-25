// The save format: SAVE_VERSION, the initial state, exact serialisation with every Num as
// N.serialize text, and parseSave, which migrates, deep-merges over defaults, validates with zod
// and never throws on bad input. A state-shape change bumps SAVE_VERSION, adds a migration to the
// ordered map and a fixture in tests/fixtures/saves (see save.migration.test.ts).
//
// Defaults policy: a field the save lacks (at any version) takes the value of a fresh initial
// state, so a save written before a field existed still loads. A truncated save therefore heals
// rather than fails; the invariants below (first die owned, totalEarned >= points, elapsedMs below
// intervalMs, auto-roll enabled only once unlocked) are what the schema does refuse, so that every
// state parseSave accepts is one advance and dispatch keep loadable.
import { z } from 'zod'
import { content, idSchema } from '@/content'
import { rules } from './defs'
import { N } from './num'
import { createRng, restoreRng } from './rng'
import type { DieState, GameState } from './state'

export const SAVE_VERSION = 1

/** One slot per content die, in content order; the first die starts owned at level 1. */
function initialDice(): DieState[] {
  return content.dice.map((def, index) => ({ id: def.id, owned: index === 0, level: index === 0 ? 1 : 0 }))
}

/** A new game. Throws on a non-finite seed (createRng). */
export function createInitialState(seed: number): GameState {
  return {
    version: SAVE_VERSION,
    seed,
    rng: createRng(seed).getState(),
    points: N.zero,
    totalEarned: N.zero,
    rolls: 0,
    playMs: 0,
    dice: initialDice(),
    autoRoll: { unlocked: false, enabled: false, intervalMs: rules.autoRoll.baseIntervalMs, elapsedMs: 0 },
    lastRoll: null,
  }
}

const nonNegativeNum = N.schema.refine((n) => N.gte(n, 0), { message: 'must not be negative' })

const dieStateSchema = z
  .strictObject({ id: idSchema, owned: z.boolean(), level: z.number().int().nonnegative() })
  .refine((die) => (die.owned ? die.level >= 1 : die.level === 0), {
    message: 'an owned die has level >= 1, an unowned die level 0',
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

const saveSchema = z
  .strictObject({
    version: z.literal(SAVE_VERSION),
    seed: z.number(),
    rng: rngSchema,
    points: nonNegativeNum,
    totalEarned: nonNegativeNum,
    rolls: z.number().int().nonnegative(),
    playMs: z.number().nonnegative(),
    dice: diceSchema,
    autoRoll: autoRollSchema,
    lastRoll: z
      .strictObject({
        faces: z.array(z.number().int().positive()),
        gained: nonNegativeNum,
        at: z.number().nonnegative(),
      })
      .nullable(),
  })
  // Points are only ever earned into both or spent from points, so lifetime earnings bound the
  // purse. The two sums are rounded at their own magnitudes (break_infinity keeps 14 digits per
  // add), so the check carries a small tolerance: one point absolute plus one part per million.
  // Tampered or corrupt saves are still refused; a rounding hair never quarantines a real save.
  // Runs only on a save whose fields all parsed, so the Nums are real.
  .refine((save) => N.lte(save.points, N.add(N.mul(save.totalEarned, 1.000001), 1)), { // literal-ok: tolerance of the sanity check, not a balance value
    message: 'must be at least points',
    path: ['totalEarned'],
    when: (payload) => payload.issues.length === 0,
  })

/** The plain JSON shape of a save: a GameState with every Num as N.serialize text. */
export type SaveShape = z.input<typeof saveSchema>

function toPlain(state: GameState): SaveShape {
  return {
    version: SAVE_VERSION,
    seed: state.seed,
    rng: [...state.rng],
    points: N.serialize(state.points),
    totalEarned: N.serialize(state.totalEarned),
    rolls: state.rolls,
    playMs: state.playMs,
    dice: state.dice.map((die) => ({ id: die.id, owned: die.owned, level: die.level })),
    autoRoll: { ...state.autoRoll },
    lastRoll:
      state.lastRoll === null
        ? null
        : { faces: [...state.lastRoll.faces], gained: N.serialize(state.lastRoll.gained), at: state.lastRoll.at },
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

/** Keyed by source version and applied in order up to SAVE_VERSION. Empty while the version is 1. */
export const migrations: Readonly<Record<number, Migration>> = {}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

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

function fail(reason: ParseSaveReason, detail: string): ParseSaveResult {
  return { ok: false, reason, detail }
}

/**
 * Parses save text. Never throws and never mutates what it reads: invalid JSON, a future version
 * and a shape the schema rejects each come back as { ok: false } with a reason and a detail.
 * Older versions are migrated in order, then the result is merged over a fresh initial state so
 * fields the save lacks get defaults, then validated.
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

  const seed = isPlainObject(migrated) && typeof migrated['seed'] === 'number' ? migrated['seed'] : 0
  const defaults = toPlain(createInitialState(Number.isFinite(seed) ? seed : 0))
  const result = saveSchema.safeParse(deepMerge(defaults, migrated))
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`)
      .join('; ')
    return fail('schema', detail)
  }
  return { ok: true, state: { ...result.data, dice: alignDice(result.data.dice) } }
}
