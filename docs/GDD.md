# Game design document

Status: skeleton, M0, 2026-10-25. Owner: Asger. This is the design of record. Agents propose numbers and label them "proposal"; only the owner removes a "TODO owner" marker. Every number in sections 3 to 8 maps to a field in `src/content` (name the file and key in the row). The section list comes from PLAN.md section 5. PLAN.md section 3 holds the verified Idle Dice facts this document starts from.

Method for the first pass (PLAN.md section 5): start from Anthony Pecorella's idle-math spreadsheets and his "Math of Idle Games" series. Cost growth 1.07 to 1.15 per purchase, x2 milestones at 25, 50, 100 owned, prestige gain as a root or log of lifetime points. Mechanics and formulas are not copyrightable; art, names, text and the specific UI arrangement of Idle Dice are, so none of those are copied.

## 1. Fantasy and references

Purpose: name the fantasy and the working title, and record what we borrow from Idle Dice and what we change, so every later section has a reference point.

Title: Nice Dice, decided 2026-10-25, repo nice-dice (D15). Fantasy decided 2026-10-26 (D18, `docs/plans/active/m5-theme.md`, closes Q1 of section 14): the player is a dicewright, a craftsperson in a lamp-lit workshop at night who carves dice from ever finer materials and rolls them on the bench to earn their keep. Not a casino, not a tavern (D5). Points stay "points" (the player knows the genre); the workshop supplies every other name. Tone: warm, tactile, a little dry.

- Dice by material in content order: Pine, Oak, Bone, Brass and Obsidian Die (section 4), each with a one-line material note in `src/content/dice.ts`. Buying a die is carving it: "Carve the Oak Die to unlock".
- Ascension is "refining" in copy: the Refine button, the "Refined xN" badge, auto-refine. The code keeps `ascend` and `ascensions`.
- Charms stay charms, named after workshop objects (cups, felt, chalk, thimble, knife); their flavour lines sit in the shop (section 5). Luck stays luck and "press your luck" stays the reset.
- What luck buys once the seven upgrades are maxed: Mastery, per die, and Fortune's Favour, global (section 7.1).
- Trophies are "Marks" in copy, a dicewright's maker's marks, with workshop names (section 10). Ids, code and the save field keep `trophies`.
- Tabs: Bench, Hands, Charms, Luck, Marks (tab ids `table`, `combos`, `charms`, `luck`, `trophies` unchanged, so test ids and the stored tab never move).
- The title screen is the workbench at night: a hand-coded SVG scene with the lamp glow from the top right, one ivory die mid-tumble, shavings and dust motes, "Nice Dice" set in Fraunces (OFL, self-hosted) over the subtitle "a dicewright's idle game". The first tap on it is where audio unlocks.

### Idle Dice baseline (PLAN.md section 3, verified from the live bundle and wiki)

| Constant | Idle Dice | Our first baseline | Where it lands |
|---|---|---|---|
| Regular dice | up to 5 D6 | 5 D6 | `src/content/dice.ts` |
| Points per roll | sum(face x die multiplier) x poker-combo multiplier x product of up to 5 multiplier dice (D2 to D100) | same skeleton without multiplier dice in v1 | core formula, M1 and M4 |
| Dice base costs | 10, 100, 1k, 10k, 100k | same | `dice.ts` base cost, section 4 |
| Level cost growth | 1.08 per level | 1.08 | `dice.ts` growth, section 4 |
| Ascension | at level 100, level resets, x100 multiplier | TODO owner | M3, section 5 |
| Draft requirement growth | 1.15 per card | 1.15 | M4, section 5 |
| Combo upgrade growth | 2.35 | 2.35 | M4, section 5 |
| Cards | 52, drawn three at a time | three-choice draft kept, pool size TODO owner | M4 |
| Prestige | resets dice and cards for an additive multiplier; golden cards and luck persist | one layer, rules TODO owner | M5, section 7 |
| Auto-roll interval | 5 s | 5 s | M2, section 6 |
| Offline cap | 8 h | 8 h | section 9 |
| First prestige | roughly 1 to 3 h active | 30 to 60 min active | section 12 |
| Casinos, slots, duels | third reset and minigames | cut | section 13 |

### Borrow (the skeleton)

- Roll to points to upgrade, with poker-hand combos as the visible skill layer.
- The three-choice draft on a progress bar. The moment players praise most.
- Layered resets that each state exactly what resets and what stays.
- The verified constants above as the first balance baseline, then diverge. Early-game slog is the most cited complaint, so the first soft reset targets 30 to 60 minutes, not 1 to 3 hours.

### Change

- v1 differentiator: face editing. Players modify individual die faces (swap a 1 for a 6, add wild, exploding or x2 faces, weighted faces). A visible strategic layer from minute one, dice-native. Idle Dice only levels a scalar per die and hides probability shaping behind a late upgrade.
- Automation is an early, deliberate purchase. Idle Dice gates auto-draw and auto-ascend behind late achievements, the most repeated complaint.
- Dark mode, no hidden panels, export and import saves, a visible next unlock, readable mobile text.

## 2. Loops

Purpose: describe what the player does and decides at 30 seconds, 5 minutes, one session and one day, so pacing targets have something to measure.

| Horizon | Player does | Player decides | Status |
|---|---|---|---|
| 30 s | roll, watch points, buy a level | which die to level | TODO owner |
| 5 min | afford the second die, first combo, first face edit | face edit versus level | TODO owner |
| One session (20 to 40 min) | reach the first draft, first ascension | draft pick, when to prestige | TODO owner |
| One day | prestige once or twice, offline return | long-term multiplier route | TODO owner |

## 3. Currencies and magnitude

Purpose: list every currency and its expected magnitude at three horizons. This table gates D3 (Decimal everywhere): if every cell provably stays under 1e15 the plain-number alternative reopens; if any column passes 1e308 within a month, Decimal is confirmed. Idle Dice passes 1e308 within hours of late game, so the expectation is Decimal stays.

| Currency | Content field | After 1 h active | After 1 day | After 1 month | Resets on |
|---|---|---|---|---|---|
| Points | TODO | | | | prestige |
| Lifetime points | TODO | | | | never |
| Draft progress | TODO | | | | prestige |
| Prestige currency | TODO | | | | never |

TODO owner: fill the magnitude cells from the M1 sim output and decide whether any further currency exists (a streak or luck currency is in the parking lot, section 13).

## 4. Dice table

Purpose: one row per die with base cost, cost growth, output and unlock. These rows are `src/content/dice.ts` and must match it exactly; a content test checks the shape, the owner checks the numbers.

| Id | Name | Base cost (`baseCost`) | Cost growth per level (`costGrowth`) | Output multiplier (`baseMultiplier`) | Unlock (`unlock`) |
|---|---|---|---|---|---|
| `die_1` | Pine Die | 10 | 1.08 | 1 | `always` |
| `die_2` | Oak Die | 100 | 1.08 | 2 | `owned` `die_1`, count 1 |
| `die_3` | Bone Die | 1000 | 1.08 | 4 | `owned` `die_2`, count 1 |
| `die_4` | Brass Die | 10000 | 1.08 | 8 | `owned` `die_3`, count 1 |
| `die_5` | Obsidian Die | 35000 | 1.08 | 16 | `owned` `die_4`, count 1 |

Ids and values match `src/content/dice.ts` as of 2026-10-25; the material names are the 2026-10-26 naming pass (section 1, D18) and `content.test.ts` pins them too. All five dice have `sides: 6`. `src/content/content.test.ts` pins these baseline values, so a change here changes that test in the same pull request.

Shipped rules (M1 and M3, cost multiplier retuned in M4; the owner delegated the M3 and M4 edits of this section, `docs/plans/active/m4-luck.md` section 3, 2026-10-26):

- Level cost from level L to L + 1 = `baseCost` x `costGrowth` ^ L x `rules.ascension.costMultiplier` ^ ascensions. The cost multiplier is 400 (`src/content/rules.ts`, `ascension.costMultiplier`; 300 from 2026-10-25 to 2026-10-26, see `docs/BALANCE_LOG.md`): a die's cost curve does not restart from `baseCost` after an ascension, each cycle to the cap costs 400 times the last while it pays 100 times more, so a run settles at about 12 ascensions per die instead of running away. Level 0 to 1 is buying the die at `baseCost`.
- Ascension (`rules.ascension.level` 100, `rules.ascension.multiplier` 100): a die at level 100 stops levelling and can ascend, by hand or with auto-ascend (default on): level back to 1, output x100 per ascension compounding, faces kept, and one point of draft progress (section 5). Core: `src/core/ascend.ts`.
- Die multiplier = `baseMultiplier` x level x 100 ^ ascensions x the die's cup charms (section 5) x (1 + 0.1 x mastery level) (section 7.1, M5). Output per roll = sum over owned dice of (printed face value x die multiplier), then the global multipliers of section 5. The printed face starts at 1 to 6 and face editing raises it (section 5).
- A new run after a luck reset starts die_1 at level 1, or at 10 x the Head Start level (section 7.1), the other dice unowned.

Names final as of 2026-10-26 (D18). TODO owner: whether unlock needs anything beyond owning the previous die, and whether a sixth die or multiplier dice ever enter (section 13 says not in v1).

## 5. Multipliers and stacking rules

Purpose: list every multiplier source and say whether sources add or multiply, so the formula in `src/core` has one unambiguous shape.

Shipped formula (`src/core/formulas.ts`, `rollPoints`): points per roll = (sum over owned dice of printed face x die multiplier) x best hand multiplier x points charms x luck x trophies, where die multiplier = `baseMultiplier` x level x 100 ^ ascensions x the die's cup charms, the hand multiplier carries its upgrade level, the Card Sharp charm and the Keen Eye upgrade, and "luck" is (1 + 0.1 x lifetime luck) x Deep Pockets. The owner delegated the M3 and M4 edits of this section (`docs/plans/active/m4-luck.md` section 3, 2026-10-26).

| Source | Type | Growth | Content field | Status |
|---|---|---|---|---|
| Die level | per die | linear: `baseMultiplier` x level | `dice.ts` `baseMultiplier` | shipped M1 |
| Ascension | per die | x100 per ascension, compounding; level costs x400 per ascension (section 4) | `rules.ts` `ascension.multiplier` 100, `ascension.costMultiplier` 400 | shipped M3; cost multiplier 300 to 400 on 2026-10-26 |
| Poker-hand combo | per roll, best hand only, two dice or more | base 2 / 3 / 4 / 6 / 8 / 12 / 50 (pair, two pair, three of a kind, straight, full house, four of a kind, five of a kind); upgrade: base x (1 + 0.1 x level), cost 50 x 2.35 ^ level | `combos.ts` `base`; `rules.ts` `combo.upgradeCost` 50, `combo.costGrowth` 2.35, `combo.step` 0.1 | shipped M3 |
| Face edits | per die, per face | raises the die's lowest face by 1 (first on ties), cap 12 plus 2 per Whittling Knife, cost `baseCost` x 5 x 1.6 ^ upgrades on that die, open from die level 10 | `rules.ts` `face.cap` 12, `face.costFactor` 5, `face.costGrowth` 1.6, `face.unlockLevel` 10 | shipped M3 |
| Charms (draft picks) | global, per die, per hand, auto-roll, face cap or draft growth | draft requirement ceil(1.3 ^ charms taken this run) ascensions; three offered (plus one per Lucky Draw level), one free reroll per draft; rarity weights common 6 / rare 3 / epic 1; table below | `charms.ts`; `rules.ts` `draft.growth` 1.3, `draft.offerSize` 3, `draft.rarityWeights` | shipped M3; growth 1.15 to 1.3 and cup values on 2026-10-26 |
| Luck (prestige) | global, additive in lifetime luck | 1 + 0.1 x lifetime luck; luck earned per reset in section 7 | `rules.ts` `luck.perPoint` 0.1 | shipped M3; lifetime luck drives it since M4 |
| Luck upgrades | global (Deep Pockets x1.2 per level), per hand (Keen Eye +15 percent per level), auto-roll (Quick Hands x0.92 per level) and the run-shaping ones | section 7.1 | `luckUpgrades.ts` | shipped M4 |
| Trophies | global | x1.02 per trophy held, compounding (section 10) | `rules.ts` `trophy.multiplier` 1.02 | shipped M3 |

Stacking rule (shipped): every source multiplies, including sources of the same kind (two Worn Felts are x1.25 x 1.25, a second ascension is another x100). The two additive effects are the face cap (+2 per Whittling Knife) and the draft growth (-0.05 per Second Helping, never below 1). The only sum is the dice themselves: the printed faces times their multipliers add up before the hand multiplier applies.

Charms table, `src/content/charms.ts` (effect values of the five cups retuned 2026-10-26, `docs/BALANCE_LOG.md`):

| Id | Name | Rarity | Effect (`effect`) |
|---|---|---|---|
| `worn_felt` | Worn Felt | common | points x1.25 |
| `chalk_mark` | Chalk Mark | common | points x1.25 |
| `silver_thimble` | Silver Thimble | rare | points x1.5 |
| `golden_pip` | Golden Pip | epic | points x2 |
| `oak_cup` | Oak Cup | common | `die_1` output x2 (was x3) |
| `tin_cup` | Tin Cup | common | `die_2` output x2 (was x3) |
| `clay_cup` | Clay Cup | common | `die_3` output x2 (was x3) |
| `copper_cup` | Copper Cup | rare | `die_4` output x4 (was x6) |
| `ivory_cup` | Ivory Cup | rare | `die_5` output x4 (was x6) |
| `card_sharp` | Card Sharp | rare | every hand multiplier x1.25 |
| `wound_spring` | Wound Spring | rare | auto-roll interval x0.85 |
| `quick_hand` | Quick Hand | epic | auto-roll interval x0.7 |
| `whittling_knife` | Whittling Knife | epic | face cap +2 |
| `second_helping` | Second Helping | epic | draft growth -0.05 |

A cup is only offered while its die is owned. Charms held are left out of the offer while enough others remain, so a run sees every charm before a duplicate. Charms reset on a luck reset except the ones Memory keeps (section 7.1).

TODO owner: whether the hand bases or the charm pool need another pass after the first outside playtest; the stacking rule above is what ships.

## 6. Manual actions

Purpose: list what the player can click, what each costs and what automation exists for it, since automation is an early purchase here (section 1, Change).

| Action | Cost | Automation | Unlock | Status |
|---|---|---|---|---|
| Roll | free | auto-roll every 5 s baseline, interval upgradable | start | TODO owner |
| Level a die | points, growth 1.08 | buy max, hold-to-repeat (M2) | start | TODO owner |
| Buy a die | points | none | afford | TODO owner |
| Ascend a die | reaching level 100 | auto-ascend as an early purchase | M3 | TODO owner |
| Draft pick | progress bar full | auto-pick as an early purchase | M4 | TODO owner |
| Edit a face | TODO | none | M4 | TODO owner |
| Prestige | threshold | none, always a choice | M5 | TODO owner |

## 7. Prestige (luck)

Purpose: define the one reset layer in v1: trigger, formula, what resets, what stays, and target cycle length. The Luck tab renders this section as the reset preview and the luck shop. Shipped in M3 as "luck" and reworked in M4 (`docs/plans/active/m4-luck.md` sections 1 and 2; the owner delegated these edits, 2026-10-26).

- Trigger: the current run has earned `rules.luck.threshold` = 1e10 points (`totalEarnedRun`; `src/content/rules.ts`; the brief's 1e6 was retuned on 2026-10-25, `docs/BALANCE_LOG.md`). Below it the Luck tab shows the threshold and a progress bar.
- Formula: luck on reset = floor(`perDecade` x log10(`totalEarnedRun` / `threshold`)) + 1, with `rules.luck.perDecade` = 10, so the first reset at the threshold gives 1 luck, a run of 1e11 gives 11, 1e12 gives 21: ten more luck per tenfold run, a log curve that cannot run away with the run total (M3 shipped floor(sqrt(run / threshold)), replaced in M4). Core: `luckOnReset` in `src/core/formulas.ts`.
- Two counters: `luck` is spendable in the luck shop (section 7.1); `luckTotal` is lifetime luck earned, spent or not. The points multiplier is 1 + `rules.luck.perPoint` x `luckTotal` with `perPoint` = 0.1, so spending luck never weakens a roll.
- Resets: points, the run total, the dice (die_1 back to level 1 or to the Head Start level, the other four unowned, faces back to 1 to 6, ascensions 0), hand upgrade levels, charms except the ones Memory keeps (up to its level, highest rarity first, pick order on ties), draft progress and the open offer, the last roll; the auto-roll interval is rebuilt from the kept charms and Quick Hands.
- Stays: luck and lifetime luck, every luck upgrade, mastery and Fortune's Favour (section 7.1), trophies (marks), lifetime stats, settings and the auto-roll unlock and switch, auto-ascend (auto-refine), auto-level. Face edits do not survive (they belong to the dice, which reset; the owner's earlier TODO is closed this way, open to reversal).
- Cycle length, active bot on seeds 1 / 2 / 3 after the 2026-10-26 retune: first luck at 0:34:41 / 0:34:12 / 0:41:43 (target 30 to 60 min, section 12), second luck 26 to 34 minutes after the first (target within 60 min), then about every 20 minutes (the bot's cooldown; a player resets when the preview reads well). Lifetime points at 8 h 1.4e37 to 4.0e37 (target 1e25 to 1e45), see `docs/BALANCE_LOG.md`.

### 7.1 Luck upgrades and luck sinks (the luck shop, M4; the sinks, M5)

Purpose: what spendable luck buys. Table `src/content/luckUpgrades.ts`, seven capped rows, permanent across runs; below it the two uncapped sinks of M5. Cost of the next level = ceil(`baseCost` x `costGrowth` ^ level), paid in luck; `src/core/formulas.ts` `luckUpgradeCost` and `luckEffects`, command `buyLuckUpgrade`.

| Id | Name | Max level | Cost per level (luck) | Effect per level (`effect`) |
|---|---|---|---|---|
| `head_start` | Head Start | 5 | 2, 4, 6, 9, 14 | every run starts with die_1 at level 10 x level (50 at the cap) |
| `quick_hands` | Quick Hands | 8 | 1, 2, 3, 4, 6, 8, 12, 18 | auto-roll interval x0.92 (x0.51 at the cap), on top of the charms |
| `deep_pockets` | Deep Pockets | 10 | 1, 2, 2, 3, 4, 6, 8, 11, 15, 21 | all points x1.2 (x6.2 at the cap) |
| `keen_eye` | Keen Eye | 5 | 2, 4, 6, 9, 14 | every hand multiplier x(1 + 0.15 x level) (x1.75 at the cap) |
| `lucky_draw` | Lucky Draw | 2 | 4, 8 | +1 charm in every draft offer (five at the cap) |
| `memory` | Memory | 3 | 5, 10, 20 | one more charm survives a luck reset, highest rarity first |
| `steady_hands` | Steady Hands | 1 | 3 | auto-level: once per simulated second (`rules.luck.autoLevelEveryMs` 1000) buy the cheapest affordable die level, then the next die when affordable; a switch in the Automation sheet on the bench, on once bought (`autoLevel` in the save, command `setAutoLevel`) |

Everything maxed costs 185 luck, about the fifth or sixth reset of an active player. The sim bot buys by income lift per luck right after each reset: Deep Pockets and Quick Hands first, then Keen Eye and Head Start, Memory and Lucky Draw once the resets pay 20 or more.

Luck sinks (M5, `docs/plans/active/m5-theme.md` sections 1 and 2; `rules.mastery` and `rules.favour` in `src/content/rules.ts`; core `masteryCost`, `masteryMultiplier`, `favourCost`, `favourMultiplier` in `src/core/formulas.ts`, commands `masterDie { id }` and `buyFavour`). Both have no cap and survive every luck reset; a cost past the double range is Infinity, so the levels saturate on their own. The sim bot buys them by income lift per luck once every upgrade above is maxed.

| Id | Name in copy | Scope | Cost of the next level (luck) | Effect per level |
|---|---|---|---|---|
| `mastery` | Mastery | per die, `masterDie { id }`, buyable on an unowned die too (the level waits for the die to be carved again) | ceil(2 x 1.35 ^ level): 2, 3, 4, 5, 7, 9, 13, 17, 23, 30, 41, 55, ... | that die's output x(1 + 0.1 x level); rides inside the `dice` factor of the breakdown |
| `favour` | Fortune's Favour | global, `buyFavour` | ceil(1.5 ^ level): 1, 2, 3, 4, 6, 8, 12, 18, 26, 39, 58, 87, ... | all points x(1 + 0.05 x level); rides inside the `luck` factor of the breakdown |

Balance check at these values (active bot, seeds 1 / 2 / 3, 2026-10-26, `docs/BALANCE_LOG.md`): lifetime points at 8 h 1.51e41 / 2.95e41 / 2.90e40 (target 1e25 to 1e45) and at 24 h 5.94e45 / 4.01e45 / 4.29e45 (target below 1e80), first hour unchanged, so no cost retune. Mastery 13 to 18 per die and favour 15 at 8 h on seed 1; 21 to 22 per die and favour 18 at 24 h. By 24 h a mastery level costs about 1100 luck and a favour level about 1500 against 300 to 400 luck per reset, so luck visibly piles up between buys. Shown on the die card as a "Mastery N" badge with a luck-priced button and in the Luck tab as one row per die plus the favour row.

TODO owner: whether the memory-kept charms should include the cups of unowned dice (they do today and apply once the die is rebought), and whether a reset should ever be worth less than one luck (today the threshold always pays 1).

## 8. Unlock timeline

Purpose: when each system first appears for an active player and for an idle player, so there is always a visible next unlock and no dead stretch.

| System | Active player | Idle player | Status |
|---|---|---|---|
| Second die | minute 1 to 3 | TODO | proposal, section 12 |
| First combo noticed | TODO | TODO | TODO owner |
| First face edit | TODO | TODO | TODO owner |
| First draft | 10 to 20 min | TODO | PLAN.md M4 target |
| First ascension | TODO | TODO | TODO owner |
| First prestige | 30 to 60 min | TODO | section 12 |

## 9. Offline policy

Purpose: fix how time away is converted into progress.

- `elapsed = clamp(now - lastUpdate, 0, cap)`. A negative delta means the clock went back: grant nothing, move `lastUpdate` forward.
- Cap: 8 h baseline from Idle Dice. Content field TODO. TODO owner: keep 8 h or raise it; a longer cap favours the once-a-day player.
- Simulation: at most 1e5 fixed 100 ms ticks, then the expected-value remainder for the rest under the cap. A test asserts EV-offline equals stepped-online within tolerance.
- Offline progress earns at the full rate (proposal). TODO owner: full rate or a fraction.
- A "while you were away" modal shows elapsed time and what was earned.

## 10. Achievements

Purpose: list achievements, their conditions and any reward, as a content table.

Shipped in M3 as trophies, `src/content/trophies.ts`, fourteen rows; the owner delegated the M3 and M4 content edits of this section (`docs/plans/active/m4-luck.md` section 3, 2026-10-26). Since M5 they are "Marks" in every piece of copy, a dicewright's maker's marks (section 1, D18): the Marks tab, the mark toast, the names and descriptions below. The ids, `src/core/trophies.ts`, the save field `trophies`, `newTrophy` and every test id keep the code name. Each held mark multiplies every roll by `rules.trophy.multiplier` = 1.02 (`src/content/rules.ts`, `trophy.multiplier`), compounding, so all fourteen give x1.32. Marks never gate automation (section 1, Change) and survive a luck reset. Core checks them after every state change that can complete one; the latest one earned surfaces in `newTrophy` for the toast.

| Id | Name | Description | Condition (`condition`) |
|---|---|---|---|
| `first_roll` | First Throw | Roll a die on the bench once. | `rolls` >= 1 |
| `hundred_rolls` | Warm Hands | Roll 100 times. | `rolls` >= 100 |
| `thousand_rolls` | Journeyman | Roll 1,000 times. | `rolls` >= 1,000 |
| `ten_thousand_rolls` | Groove in the Bench | Roll 10,000 times. The wood remembers. | `rolls` >= 10,000 |
| `second_die` | Oak Shavings | Carve the Oak Die. | `dieOwned` `die_2` |
| `third_die` | Bone Dust | Carve the Bone Die. | `dieOwned` `die_3` |
| `fourth_die` | Brass Filings | Carve the Brass Die. | `dieOwned` `die_4` |
| `fifth_die` | The Whole Set | Carve the Obsidian Die. Five dice on the bench. | `dieOwned` `die_5` |
| `first_ascension` | First Refinement | Refine a die for the first time. | `ascensions` >= 1 (sum over dice, this run) |
| `first_charm` | Hung by the Lamp | Pick your first charm. | `charms` >= 1 held |
| `first_luck` | Pressed Your Luck | Reset for luck for the first time. | `prestiges` >= 1 |
| `five_of_a_kind` | Five Alike | Roll five of a kind. | `hand` `five_kind` rolled once |
| `million` | Earned Your Keep | Earn 1,000,000 points in total. | `totalEarned` >= 1,000,000 (lifetime) |
| `billion` | Set for Life | Earn 1,000,000,000 points in total. | `totalEarned` >= 1,000,000,000 (lifetime) |

The Marks tab shows a progress line per unearned mark ("412 / 1.00K rolls", "Carve the Oak Die", "0 / 1 refinements"). Rolls counted by offline estimation count towards the roll marks. TODO owner: whether later milestones (a luck upgrade maxed, a mastery level, a second prestige, 1e15 lifetime) deserve rows; the multiplier per mark if fourteen feel too few or x1.32 too much.

## 11. Save policy

Purpose: what is saved, how often, and how it survives.

- `SAVE_VERSION` number, ordered migration map, deep-merge over defaults, zod validation, fixture save from every historical version loaded in a test. A state-shape change means version bump plus migration plus test, no exceptions.
- Decimals serialise as strings. The RNG seed is saved.
- Autosave every 30 s and on `visibilitychange` and `pagehide`.
- IndexedDB via idb-keyval plus `navigator.storage.persist()`. Rotating backup slots at 1, 5, 20 and 60 minutes. Unparseable saves are quarantined with a recovery dialog, never overwritten. Future-version saves are rejected without mutation.
- Export and import strings as a first-class feature, "export first" on import. A Web Locks guard refuses a second tab.
- Own URL, itch and CrazyGames are three separate saves because of storage partitioning; export and import is the bridge.

## 12. Pacing assertions

Purpose: targets that become `balance.test.ts` and run against the headless sim. Each row is a test. Proposals until the owner confirms.

| Id | Assertion | Bot | Status |
|---|---|---|---|
| P1 | Second die affordable between minute 1 and 3 of active play | active clicker | proposal |
| P2 | First prestige worthwhile between 30 and 60 minutes active | active clicker | proposal |
| P3 | No income trough longer than 10 min in the first 8 h | greedy buyer | PLAN.md M3 target, TODO owner |
| P4 | First draft reachable in 10 to 20 min active | active clicker | PLAN.md M4 target, TODO owner |

"Worthwhile" needs a definition before P2 can be a test (proposal: the post-prestige run reaches the pre-prestige point total in at most half the time). TODO owner.

## 13. Out of scope for v1

From D5, D6 and the parking lot in PLAN.md section 3.

- Casino theme, casinos, slots, duels, any minigame.
- Multiplier dice (D2 to D100) as a separate system.
- Spatial board with adjacency, fixed-length roguelite runs, player-authored hand types, a non-casino push-your-luck layer, a streak currency. Parking lot: one at a time after the first outside playtest.
- Analytics, accounts, cloud sync beyond export and import.
- Phaser, PixiJS, 3D dice, a Web Worker for the sim (PLAN.md section 2).

## 14. Open questions

From PLAN.md section 8. TODO owner on all four.

- Q1 Decided. Title Nice Dice (2026-10-25); fantasy the dicewright's workshop (2026-10-26, D18): Pine, Oak, Bone, Brass and Obsidian dice, refining, marks.
- Q2 Phone or laptop first. Idle Dice is landscape. Recommendation: responsive with a portrait phone layout, since that is where you will playtest.
- Q3 Monetisation intent. Hobby and free changes nothing. Portal ads later means Cloudflare hosting, PEGI 12, a privacy policy and the platform adapter from M0, all already in the plan.
- Q4 The v1 differentiator. Recommendation: face editing. Alternatives in the parking lot.
