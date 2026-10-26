# M4 luck: spend luck, put the draft aside, browse backups, tame the late game

Status: built 2026-10-26 on branch `m4-luck`, not yet merged or deployed. Same working style as M3: keep `pnpm check` green, no review rounds, tests where they protect saves and formulas.

## Mechanics

1. Luck becomes a currency. `luck` is spendable; new `luckTotal` is lifetime luck earned and drives the points multiplier `1 + rules.luck.perPoint x luckTotal`. Luck on reset uses a log curve so it cannot run away: `luckOnReset = floor(rules.luck.perDecade x log10(totalEarnedRun / rules.luck.threshold)) + 1` once the run reaches the threshold (perDecade 10 to start, threshold tuned by the sim).
2. Luck upgrades, table `luckUpgrades.ts` (id, name, description, maxLevel, baseCost, costGrowth, effect). Cost of the next level = ceil(baseCost x costGrowth ^ level). Command `buyLuckUpgrade { id }`. Permanent across runs.
   - head_start: each run starts with die_1 at level 10 per level (max 5), cost 2, growth 1.6.
   - quick_hands: auto-roll interval x0.92 per level (max 8), cost 1, growth 1.5.
   - deep_pockets: all points x1.2 per level (max 10), cost 1, growth 1.4.
   - keen_eye: every combo multiplier +15 percent per level (max 5), cost 2, growth 1.6.
   - lucky_draw: +1 charm in every draft offer per level (max 2), cost 4, growth 2.
   - memory: keep up to one charm per level through a luck reset, highest rarity first (max 3), cost 5, growth 2.
   - steady_hands: auto-level (max 1), cost 3: while on, every simulated second buys the cheapest affordable level across owned dice and buys the next die when affordable. A switch in the dice board header, default on once bought.
3. Late-game tuning with the sim as judge, active bot, seeds 1 to 3: first luck between 30 and 60 min; second luck within 60 min of the first; lifetime total earned at 8 h between 1e25 and 1e45 and at 24 h below 1e80; no stretch longer than 20 min without a purchase in the first 8 h. Levers, in this order of preference: draft requirement growth (1.15 up to 1.3), charm values, ascension multiplier (100 down to no less than 25) and cost multiplier, luck threshold and perDecade. Every change goes to `docs/BALANCE_LOG.md` with before and after, and the GDD sections 4, 5, 7 and 10 get updated to match the shipped content (the owner delegated this).
4. Save `SAVE_VERSION` 3 with a v2 migration (luckTotal = luck, luckUpgrades empty) and a v3 fixture. Sim bots buy luck upgrades greedily by effect per cost after each luck reset.

## App and UI

5. Dismissable draft. App ui gains `draftDismissed`; the draft dialog opens when an offer exists and it is not dismissed; a "Decide later" button dismisses; the Charms tab shows "A draft is waiting" with an "Open draft" button; a new offer clears the dismissal. Ascensions keep filling progress while an offer waits.
6. Backups browser in Settings: a "Backups" section listing every stored copy (timed slots, set-aside copies from reset and import, quarantined copies) with its time, rolls and points, a Restore button per readable copy with a confirm step that first sets the current game aside, and a line explaining what the slots are. Reuse `src/app/recovery.ts`.
7. Luck tab becomes the luck shop: spendable luck and lifetime luck shown separately, the multiplier, the upgrade list with level, next cost, effect text and a Buy button, the reset preview with the new formula, and the existing confirm flow.
8. Polish: the update banner also renders on the locked screen; the away modal says "partly estimated" only when the estimated part is at least one auto-roll interval; the trophy toast queues trophies awarded in the same state change and shows them one after another; the Charms tab headline reads "Charms return after your first ascension of this run" after a luck reset.

## Done when

`pnpm check` and `pnpm test:e2e` green, a seeded save with luck lets the verifier buy an upgrade and see its effect, the draft can be put aside and reopened, a backup restores, and the deploy is live.

## Build notes

Built 2026-10-26 by three builders (core and content with the sim and docs, app and polish, luck UI) and one verifier. Nothing committed yet; no package added.

What landed

- Content: `luckUpgrades.ts` (the seven upgrades of section 2, closed id set, cost = ceil(baseCost x costGrowth ^ level)), `rules.luck.perDecade` 10 and `rules.luck.autoLevelEveryMs` 1000, plus the three retunes of section 3 below. `validateContent` and `src/content/content.test.ts` cover the table.
- Core: `luckTotal`, `luckUpgrades` and `autoLevel` on the state; commands `buyLuckUpgrade { id }` and `setAutoLevel { enabled }`; the log luck formula from the exact serialised mantissa and exponent; every effect wired (`luckEffects`, `luckAndUpgradesMultiplier`, `comboMultiplier`, `autoRollInterval`, `draftOfferSize`, `charmsKept`, `headStartLevel`); `src/core/autoLevel.ts` runs one pass per simulated second inside `advance` (cheapest affordable level across owned dice, then the next die) and never in the offline estimate; `SAVE_VERSION` 3 with the v2 migration (luckTotal = luck, luckUpgrades empty), the `luckTotal >= luck` refusal, unknown ids dropped and levels clamped on load, `tests/fixtures/saves/v3.json`; selectors `luckUpgradeView`, `luckSummary`, `luckPreview` (no multiplier field any more), `multiplierBreakdown.luck` now includes Deep Pockets so the chips still multiply to the total.
- Sim: bots buy luck upgrades greedily by income lift per luck after each reset; the report carries the second luck, the longest purchase gap, luck upgrade levels and the charms; `tools/sim/balance.test.ts` asserts the section 3 targets (seed 1 to 24 h, seeds 2 and 3 to 8 h, about 2.5 minutes).
- App: `ui.draftDismissed` and `ui.trophyQueue` with `dismissDraft`, `reopenDraft`, `shiftTrophy` (every core transition lands through one `commit` that queues each trophy the change awarded; a store subscription clears the dismissal when the offer changes); `src/app/selectors.luck.ts` (shop rows, `describeLuckEffect`, the auto-level and header selectors); `restoreBackup` in `recovery.ts` (set the current game aside, load the copy, credit the time since its stamp silently, save); `isEstimated` and `formatBackupTime` in `selectors.ts`.
- UI: the Luck tab as the shop (spendable and lifetime luck, the multiplier, one row per upgrade with pips, effect line, next cost and Buy, the reset preview on the log formula, derived Resets and Stays lists); the auto-level switch in the dice board header once Steady Hands is owned; "Decide later" on the draft dialog (Escape too), the waiting line and "Open draft" on the Charms tab; the Backups section in Settings with a confirm step per readable copy; the trophy toast queue; the update banner on the locked screen; the away modal's "partly estimated" rule; the Charms headline after a reset.
- Docs: GDD sections 4, 5, 7 (plus 7.1 luck upgrades, kept as a subsection so the section numbers CLAUDE.md and PLAN.md cite stay valid) and 10 rewritten to the shipped content; `docs/BALANCE_LOG.md` entry with the lever sweep; `docs/balance-report.*` regenerated.

Tuning (section 3), active bot, seeds 1 / 2 / 3; the full sweep over the brief's levers is in `docs/BALANCE_LOG.md` (2026-10-26). Changed: `rules.draft.growth` 1.15 to 1.3, the die cup charms x3 / x6 to x2 / x4, `rules.ascension.costMultiplier` 300 to 400. Untouched: the ascension multiplier 100, `luck.threshold` 1e10, `luck.perDecade` 10. "Before" is the M4 mechanics on the M3 numbers; "After" is the shipped content.

| Metric | Before (seed 1 / 2 / 3) | After (seed 1 / 2 / 3) | Target |
|---|---|---|---|
| die_2 affordable | 0:01:04 / 0:01:22 / 0:01:08 | 0:01:04 / 0:01:22 / 0:01:08 | P1: 0:01:00 to 0:03:00, pass |
| die_5 bought (all five owned) | 0:08:59 / 0:08:22 / 0:09:23 | 0:08:59 / 0:08:02 / 0:09:48 | by 0:45:00, pass |
| First ascension and first charm | 0:14:29 / 0:13:52 / 0:14:03 | 0:14:39 / 0:13:07 / 0:14:58 | GDD section 8 first draft 0:10 to 0:20 (proposal), pass |
| First luck | 0:28:44 FAIL / 0:36:51 / 0:30:58 | 0:34:41 / 0:34:12 / 0:41:43 | 0:30:00 to 1:00:00, pass |
| Second luck, after the first | 0:23:50 / 0:33:30 / 0:22:35 | 0:25:45 / 0:33:30 / 0:31:50 | within 1:00:00, pass |
| Longest purchase gap in 8 h | 0:09:37 / 0:09:40 / 0:10:25 | 0:10:48 / 0:10:35 / 0:08:35 | at most 0:20:00, pass |
| Total earned 1.00B | 0:23:54 / 0:31:33 / 0:26:36 | 0:28:19 / 0:28:12 / 0:35:28 | none |
| Total earned at 1 h | 26.3B / 13.0B / 26.0B | 23.2B / 12.8B / 12.7B | none |
| Total earned at 8 h | 1.17e64 FAIL / 1.80e62 FAIL / 6.31e64 FAIL | 3.96e37 / 1.41e37 / 2.10e37 | 1e25 to 1e45, pass |
| Total earned at 24 h (seed 1) | not run | 2.67e41 | below 1e80, pass |
| Income at 8 h (points/s) | 1.32e55 / 1.07e55 / 1.46e48 | 1.65e34 / 9.41e33 / 4.65e31 | none |
| Ascensions per die at 8 h | 21 / 18 / 16 / 13 / 12 (seed 1) | 12 / 12 / 11 / 11 / 11 (seed 1) | none |
| Hand upgrade levels at 8 h | 140 / 140 / 120 | 88 / 88 / 79 | none |
| Charms held at 8 h | 20 / 20 / 19 | 13 / 13 / 13 | none |
| Lifetime luck at 8 h | 8514 / 7845 / 8657 | 3887 / 3708 / 3939 | none |
| Prestiges at 8 h | 23 / 22 / 23 | 22 / 22 / 22 | none |
| Luck upgrade levels at 8 h (content order) | 5 / 8 / 10 / 5 / 2 / 3 / 1 (all maxed) | 5 / 8 / 10 / 5 / 2 / 3 / 1 (all maxed) | none |
| 24 h, seed 1 | not run | lifetime luck 17625, 70 prestiges, ascensions 13 / 13 / 13 / 12 / 12 | none |
| Idle bot (never clicks) | earns nothing | earns nothing | unchanged, see the die_5 entry |

Verification (2026-10-26)

- `pnpm check`: tsc clean, oxlint with only the two pre-existing `src/components/ui` fast-refresh warnings, vitest 23 files, 434 passed, 1 skipped (the fixture generator).
- `pnpm test:e2e`: 10 passed against the dev server (M2 smoke, import, recovery), unchanged tests.
- Seeded playthrough (throwaway Playwright script, fresh contexts, saves built with the real core through a tsx script: one `prestige` dispatch from a run at 3.2e10 gives luck 6 and luckTotal 6, then twelve rolls; a second save with `draft.offer` set). Desktop 1280x800: the Luck tab read 6 to spend and 6 lifetime; buying Deep Pockets took the points chip from luck x1.6 to x1.92 and spendable luck to 5 with lifetime still 6; buying Steady Hands (spendable 2) made the auto-level switch appear on in the dice board header and the first die went from level 1 to 4 within 3.5 s; the switch toggles. The draft save opened its dialog, "Decide later" closed it, the Charms tab showed "A draft is waiting" with "Open draft", which reopened it; a roll kept it closed. Settings listed the seeded 5 min slot (time, rolls, points); Restore asked first, then restored it (result line, the 2 min since its stamp credited silently), the replaced draft game appeared as the newest set-aside row and restoring that brought the draft game and its dialog back. Phone 390x844: the same screens plus a quarantined copy in the list and the confirm step. Screenshots in dark theme at both sizes; zero console errors or warnings throughout.

Verifier fixes

- The header badge and the Stats tile showed spendable luck, so a buy made "Luck 6" read "Luck 2" while the Luck tab said 6 lifetime and the chip kept multiplying by it. Both now show lifetime luck (`selectLuckTotal`; the tile is "Lifetime luck", test id `stat-luck`), and the Luck tab carries the attention dot while some upgrade is affordable (`selectLuckShopReady`), the way the Charms tab does for a waiting draft. The points chip's title names Deep Pockets, since the core folds it into the luck factor.
- The dev server on 5173 had gone away between the e2e run and the playthrough; it was restarted through `.claude/launch.json` (`pnpm dev`).

Open for the owner

- Every luck upgrade is maxed by about the sixth reset (185 luck), so luck has nothing to buy after about an hour of play; a second shop tier or a luck sink is the natural M5 question (BALANCE_LOG open point 2). Config H (points charms 1.2 / 1.4 / 1.75 with cost multiplier 300) is the documented runner-up.
- The sim's second luck lands 26 to 34 minutes after the first because the bot waits 20 minutes between resets; a player who resets at a preview of 2 would reset sooner.
- `restoreBackup` credits the time since the copy's stamp silently and reports it in the result line instead of raising the away modal over Settings. The draft dialog mounts over Settings when an offer appears while Settings is open (pre-existing); "Decide later" works from there.
- `luck-value` is kept as a wrapper around `luck-spendable` for old locators; the level pips render one dot per level and would want a bar above about twelve levels. GDD section 1's baseline table still lists draft growth 1.15 as the first baseline (historical).
- The idle bot still earns nothing (auto-roll unlock needs die_1 level 2), unchanged from M1.
- Not verified: the deploy, and a full run to the first luck in the browser (the sim puts it at 34 to 42 minutes).
