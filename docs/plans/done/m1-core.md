# M1 core: headless game, save, sim CLI, balance tests

Status: merged 2026-10-25 in humainasger/nice-dice#1.

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

## Build notes (2026-10-25)

All of the above holds: `pnpm check` is green (17 test files, 210 tests, 1 env-gated fixture generator skipped), `pnpm sim --hours 1` prints the eight tables, the windows pass on seeds 1 to 3, `tests/fixtures/saves/v1.json` round-trips field for field, nothing under `src/app`, `src/ui` or `src/components` changed. Nothing is committed yet. What differs from the spec text, and why:

- Content tuned: `die_5.baseCost` 100000 to 35000 (factor 2.86, inside the 3x bound). On the baseline the active bot owned all five dice at 1:17:44 to 1:17:52; now 0:36:04 to 0:36:57, with die_2 to die_4 unchanged and no dead content. Before and after tables are in `docs/BALANCE_LOG.md`. GDD section 4 row `die_5` is owner-edited and still says 100000; it needs the owner's edit, as does the Baseline paragraph in `.claude/rules/content.md`. `src/content/content.test.ts` pins the new table.
- `applyOffline(state, elapsedMs, opts?)`: opts are optional and default to `rules.offline` (tickMs 100, maxTicks 100000) and gained `capMs` (8 h) so the function clamps to the content cap itself (CLAUDE.md rule 7). A NaN or infinite elapsed grants nothing instead of clamping to the cap: that is a broken clock, not a long absence. The app still computes `elapsed = now - lastUpdate` and moves `lastUpdate` forward on a negative delta.
- Two core files beyond the list: `defs.ts` (die lookup by id, the `rules` alias) and `roll.ts` (`performRoll`, `unlockAutoRoll`, shared by dispatch and advance). `roll.ts` is not exported from `src/core/index.ts`, so every state change outside core goes through `dispatch` and `advance`. Extra read helpers kept because the sim uses them: `findDie`, `dieView.unlocked`, `expectedPointsPerSecond`.
- Save schema refuses states play cannot produce, after the review showed an accepted save could turn unloadable after one tick: `autoRoll.intervalMs` is an integer from 1, `elapsedMs < intervalMs`, `enabled` implies `unlocked`, the first content die is owned when listed, die ids are unique, `totalEarned >= points`. No version bump: the shape is unchanged and every save written by play still loads. `deepMerge` matches own keys only; after the migration loop the version field is normalised to `SAVE_VERSION`. The migration loop itself stays untested until the first bump (nothing to run while `SAVE_VERSION` is 1).
- `maxAffordable` saturates at `Number.MAX_SAFE_INTEGER` (a purse past about 1e(3e14) points) instead of looping forever, and `bulkCost(def, level, 1)` returns `levelCost` exactly so a single level is charged what `dieView.nextCost` shows. `advance` clamps each roll's `at` at 0 for hand-built backlogs (the schema already refuses saved ones).
- Sim: the engine lives in `tools/sim/sim.ts` and the report shapes in `tools/sim/report.ts` so `run.ts` is a thin CLI and `balance.test.ts` imports the engine without running it. Bots act once per simulated second on 100 ms ticks (acting every tick is ten times slower and does not move the milestones). The 1e3, 1e6, 1e9 marks are measured on lifetime `totalEarned` because the greedy bot spends as it earns; 1e9 is not reached in 8 h on any content tried. The idle bot earns nothing: it never rolls by hand and auto-roll unlocks at die_1 level 2, which only manual rolls can fund. Design question for the owner (BALANCE_LOG entry has the options), not changed here.
- Documentation drift for the owner, outside this branch's edits: CLAUDE.md rule 1 and ARCHITECTURE.md describe `advance(state, dtMs, rng)` while this spec and the code carry the RNG in state (`advance(state, dtMs)`); GDD section 6 has no row for the auto-roll unlock (die_1 level 2, now `rules.autoRoll.unlock`) and section 9 marks the cap field TODO although `rules.offline.capMs` exists.
