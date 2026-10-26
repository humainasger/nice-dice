# M4 luck: spend luck, put the draft aside, browse backups, tame the late game

Status: in progress 2026-10-26. Branch `m4-luck`. Same working style as M3: keep `pnpm check` green, no review rounds, tests where they protect saves and formulas.

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
