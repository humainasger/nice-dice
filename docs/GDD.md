# Game design document

Status: skeleton, M0, 2026-10-25. Owner: Asger. This is the design of record. Agents propose numbers and label them "proposal"; only the owner removes a "TODO owner" marker. Every number in sections 3 to 8 maps to a field in `src/content` (name the file and key in the row). The section list comes from PLAN.md section 5. PLAN.md section 3 holds the verified Idle Dice facts this document starts from.

Method for the first pass (PLAN.md section 5): start from Anthony Pecorella's idle-math spreadsheets and his "Math of Idle Games" series. Cost growth 1.07 to 1.15 per purchase, x2 milestones at 25, 50, 100 owned, prestige gain as a root or log of lifetime points. Mechanics and formulas are not copyrightable; art, names, text and the specific UI arrangement of Idle Dice are, so none of those are copied.

## 1. Fantasy and references

Purpose: name the fantasy and the working title, and record what we borrow from Idle Dice and what we change, so every later section has a reference point.

Title: Nice Dice, decided 2026-10-25, repo nice-dice. TODO owner: the fantasy behind the dice (Q1 in section 14). Not casino (D5). Candidates from PLAN.md: workshop, tavern, alchemy, expedition.

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

| Id | Name (placeholder) | Base cost (`baseCost`) | Cost growth per level (`costGrowth`) | Output multiplier (`baseMultiplier`) | Unlock (`unlock`) |
|---|---|---|---|---|---|
| `die_1` | First Die | 10 | 1.08 | 1 | `always` |
| `die_2` | Second Die | 100 | 1.08 | 2 | `owned` `die_1`, count 1 |
| `die_3` | Third Die | 1000 | 1.08 | 4 | `owned` `die_2`, count 1 |
| `die_4` | Fourth Die | 10000 | 1.08 | 8 | `owned` `die_3`, count 1 |
| `die_5` | Fifth Die | 35000 | 1.08 | 16 | `owned` `die_4`, count 1 |

Ids and values match `src/content/dice.ts` as of 2026-10-25. All five dice have `sides: 6`. `src/content/content.test.ts` pins these baseline values, so a change here changes that test in the same pull request.

Baseline rules carried from Idle Dice: level cost = base cost x growth ^ level. Ascension at level 100 resets the level and multiplies output by 100 (TODO owner, M3). Output per roll = face value x output multiplier x level scaling (formula TODO owner, M1).

TODO owner: final names (the table ships placeholders), whether unlock needs anything beyond owning the previous die, the level scaling formula, and whether a sixth die or multiplier dice ever enter (section 13 says not in v1).

## 5. Multipliers and stacking rules

Purpose: list every multiplier source and say whether sources add or multiply, so the formula in `src/core` has one unambiguous shape.

| Source | Type | Growth | Content field | Status |
|---|---|---|---|---|
| Die level | per die | TODO | `dice.ts` | TODO owner |
| Ascension | per die, x100 at level 100 baseline | step | TODO | TODO owner |
| Poker-hand combo | per roll | upgrade growth 2.35 baseline | combos table (M4) | TODO owner |
| Face edits | per die, per face | TODO | faces table (M4) | TODO owner |
| Draft picks | global or per die | requirement growth 1.15 baseline | draft table (M4) | TODO owner |
| Prestige | global, additive baseline | root or log of lifetime points | prestige table (M5) | TODO owner |

Stacking rule (proposal): sources of different kinds multiply, sources of the same kind add. TODO owner.

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

## 7. Prestige

Purpose: define the one reset layer in v1: trigger, formula, what resets, what stays, and target cycle length. The "what resets, what stays" dialog in M5 renders this section.

- Trigger: TODO owner (proposal: available once lifetime points cross a threshold, worthwhile per section 12).
- Formula: TODO owner (proposal: root or log of lifetime points, additive global multiplier, PLAN.md section 5).
- Resets: dice levels, ascensions, draft progress and picks, points.
- Stays: prestige currency, face edits (TODO owner), achievements, settings.
- Target cycle length: first prestige worthwhile between 30 and 60 minutes active, cycles shorten after (section 12).

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

TODO owner. Proposal: achievements are cosmetic plus a small global multiplier each, never a gate for automation (section 1, Change). Table lands in M3.

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

- Q1 Title decided 2026-10-25: Nice Dice, repo nice-dice. The fantasy behind the dice is still open and is needed before M1 names any content. Not casino (D5).
- Q2 Phone or laptop first. Idle Dice is landscape. Recommendation: responsive with a portrait phone layout, since that is where you will playtest.
- Q3 Monetisation intent. Hobby and free changes nothing. Portal ads later means Cloudflare hosting, PEGI 12, a privacy policy and the platform adapter from M0, all already in the plan.
- Q4 The v1 differentiator. Recommendation: face editing. Alternatives in the parking lot.
