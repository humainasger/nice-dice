# M1 core: headless game, save, sim CLI, balance tests

Status: in progress 2026-10-25. Branch `m1-core`. Owner delegated balance tuning for the first playable demo to the agent; every content change goes in `docs/BALANCE_LOG.md` for review.

Goal: the whole game loop runs headless in `src/core` with a seeded RNG, saves round-trip exactly, and `pnpm sim` reports time-to-milestone so the demo's pacing is measured before any UI exists. Scope is the first playable demo: roll dice for points, own up to five dice, level dice, auto-roll, offline progress. Combos, ascension, the draft and prestige come later (M4, M5).

## State (`src/core/state.ts`)

```ts
type DieState = { id: Id; owned: boolean; level: number }          // level >= 1 when owned, 0 when not
type RollResult = { faces: number[]; gained: Num; at: number }      // faces per owned die in content order; at = state.playMs at the roll
type AutoRoll = { unlocked: boolean; enabled: boolean; intervalMs: number; elapsedMs: number }
type GameState = {
  version: number           // SAVE_VERSION, 1
  seed: number              // original seed, for the sim and bug reports
  rng: readonly number[]    // serialised xoroshiro128plus state; advanced by every roll
  points: Num               // spendable
  totalEarned: Num          // lifetime, drives unlocks and stats
  rolls: number
  playMs: number            // simulated milliseconds advanced (not wall clock); the app owns wall-clock time
  dice: DieState[]          // one per content die, in content order; die_1 starts owned at level 1
  autoRoll: AutoRoll        // baseline intervalMs 5000; unlocked when die_1 reaches level 2; enabled true at unlock
  lastRoll: RollResult | null
}
```

All numbers that can grow are `Num`. `playMs` and `level` are plain numbers. Core never reads the clock: the app passes wall-clock values into commands when needed (none in M1).

## Commands and dispatch (`src/core/commands.ts`)

```ts
type Command =
  | { type: 'roll' }                                   // manual roll, always allowed
  | { type: 'buyDie'; id: Id }                         // next unowned die whose unlock condition holds and whose baseCost is affordable
  | { type: 'levelDie'; id: Id; count: number | 'max' } // buys up to count levels, as many as affordable
  | { type: 'setAutoRoll'; enabled: boolean }          // only when unlocked
  | { type: 'reset'; seed: number }                    // new game
dispatch(state: GameState, command: Command): GameState   // pure; an invalid command returns the same state object
```

## Formulas (`src/core/formulas.ts`), every constant read from `src/content`

- `dieMultiplier(def, level) = def.baseMultiplier * level` (Idle Dice: each level adds the base multiplier).
- `levelCost(def, level) = def.baseCost * def.costGrowth ^ level` is the cost to go from `level` to `level + 1`. Buying the die is level 0 to 1 and costs `def.baseCost` (die_1 starts owned, so its baseCost is never paid).
- `bulkCost(def, level, count)` is the geometric sum, closed form. `maxAffordable(def, level, points)` is the closed-form count (floor of a log), clamped at 0, verified against the sum by a property test.
- `rollPoints(state, faces) = sum over owned dice of faces[i] * dieMultiplier(def_i, level_i)`.
- `expectedPointsPerRoll(state) = 3.5 * sum of multipliers` (used by the offline remainder and the sim report).
- `unlockSatisfied(condition, state)` for the four `UnlockCondition` kinds (`owned` counts dice with `owned` true and level >= count; `prestiges` is always false until M5).

## advance and offline (`src/core/advance.ts`)

- `advance(state, dtMs): GameState`: adds `dtMs` to `playMs`; if auto-roll is unlocked and enabled, accumulates `elapsedMs` and performs one roll per full interval (loop, no cap needed at 100 ms ticks). Rolls use `restoreRng(state.rng)`, `rollDie(6)` per owned die, and store `getState()` back. Returns the same object when nothing changed.
- `applyOffline(state, elapsedMs, opts: { tickMs: 100; maxTicks: 100000 }): { state; summary: { elapsedMs; simulatedMs; estimatedMs; rolls; gained: Num } }`: runs `advance` in fixed ticks up to `maxTicks`, then adds the expected-value remainder for the rest (`expectedPointsPerRoll * remainingRolls`, counted into `rolls`, `points`, `totalEarned`). Negative `elapsedMs` is treated as 0 by the caller; the function clamps too.

## Save (`src/core/save.ts`)

- `SAVE_VERSION = 1`. `createInitialState(seed: number): GameState`.
- `serializeState(state): string` is JSON with every `Num` as `N.serialize` text. `parseSave(text): { ok: true; state } | { ok: false; reason: 'invalid-json' | 'future-version' | 'schema'; detail: string }`. Never throws on bad input, never mutates input.
- Migrations: `migrations: Record<number, (raw: unknown) => unknown>` applied in order from the save's version up to `SAVE_VERSION`, then deep-merged over defaults from `createInitialState`, then validated with a zod schema (`N.schema` for Nums). Future versions are rejected without mutation. `tests/fixtures/saves/v1.json` is a checked-in fixture; a test loads every fixture and asserts it parses and is unchanged by a serialize/parse round trip.
- No compression here (lz-string is an app-layer concern; core may import only break_infinity.js, pure-rand, zod).

## Selectors (`src/core/selectors.ts`)

Pure read helpers for UI and sim, returning plain data: `dieView(state, id) -> { def, owned, level, multiplier: Num, nextCost: Num, affordable: boolean, maxAffordable: number, canBuy: boolean }`, `nextUnlock(state)`, `pointsPerRollExpected(state)`.

## Sim (`tools/sim`)

- `tools/sim/bots.ts`: `active` bot (manual roll once per second while auto-roll is locked, buys and levels greedily, cheapest multiplier-per-point first, checks every 1 s), `idle` bot (never rolls by hand, buys every 30 s).
- `tools/sim/run.ts` CLI: `pnpm sim --strategy active,idle --seeds 1,2,3 --hours 0.25,1,8`. Steps the real `advance` at 100 ms and lets the bot dispatch commands. Prints a table per strategy and seed: time to auto-roll unlock, time to each die bought, time to 1e3, 1e6, 1e9 points, income at the end, and dead content (dice never bought). Writes `docs/balance-report.json` and `docs/balance-report.md` and diffs against the committed JSON (first run creates it).
- `tools/sim/balance.test.ts` (vitest): the two GDD section 12 proposals as window assertions on seeds 1 to 3, active bot: die_2 affordable between minute 1 and 3; all five dice owned within 45 minutes. Plus: an `applyOffline` equivalence test (8 h stepped at 100 ms versus `applyOffline` with maxTicks 1e5 differ by less than 5 percent in points for a state with auto-roll unlocked), and dead-content (every die bought within 2 hours active).
- If the Idle Dice baseline misses a window, tune `src/content/dice.ts` within these bounds: baseCost of die_2 to die_5 by at most a factor of 3 either way, costGrowth between 1.05 and 1.15, and write the before and after sim tables into `docs/BALANCE_LOG.md` with the date and the reason.

## Scripts and config

`package.json`: `"sim": "tsx tools/sim/run.ts"`. `tsconfig.app.json` include gains `tools`. Core purity, layering and literal guards apply to `src/core` as before; `tools/sim` is outside the layer rules but must import core and content only through `@/core` and `@/content` (tsx resolves the alias through `tsconfig` paths).

## Done when

`pnpm check` green, `pnpm sim --hours 1` prints the tables, `balance.test.ts` passes on the committed content, the v1 fixture round-trips, and no UI exists yet.
