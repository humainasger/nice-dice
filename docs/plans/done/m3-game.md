# M3 game: mechanics that make it a game, and a UI worth looking at

Status: merged 2026-10-26 in humainasger/nice-dice#4.

## Mechanics (content tables plus core)

Points per roll = (sum over owned dice of faceValue x dieMultiplier) x bestCombo x charms x luck x trophies.

1. Poker-hand combos, evaluated on the face pattern (1 to 6, not upgraded values) of all owned dice, two dice or more. Best hand only. Table `combos.ts`: pair x2, two pair x3, three of a kind x4, straight x6 (all owned dice consecutive, three dice or more), full house x8, four of a kind x12, five of a kind x50. Each combo has upgrade levels: multiplier = base x (1 + 0.1 x level); upgrade cost 50 x 2.35^level. Command `upgradeCombo { id }`.
2. Face editing (the v1 differentiator). Each die has `faces: number[6]`, starting 1 to 6. Command `upgradeFace { id }` raises the die's lowest face by 1 (ties: the first), cap 12 per face. Cost: die baseCost x 5 x 1.6^upgradesSoFar. Unlocked when the die is level 10 or more. The die card shows its six faces with the raised ones highlighted.
3. Ascension. At level 100 a die stops levelling and can ascend: command `ascend { id }`: level back to 1, `ascensions + 1`, multiplier x 100 per ascension (so x100^ascensions on top of baseMultiplier x level). Each ascension adds 1 to draft progress. Auto-ascend setting, default on.
4. Charms (the three-choice draft). `draftProgress` rises by 1 per ascension; when it reaches `draftRequirement = ceil(1.15^charmsTaken)` a draft opens: three distinct random charms from `charms.ts` (seeded RNG from state), the player picks one, progress drops by the requirement. Charms are permanent until luck resets them and stack multiplicatively. Table of 14 charms with id, name, flavour, rarity (common, rare, epic with weights 6/3/1), effect `{ target: 'points' | 'combo' | 'autoroll' | 'die:die_1'..'die:die_5' | 'face_cap' , op: 'mul' | 'add', value }`: points x1.25 (common), x1.5 (rare), x2 (epic); a die x3 (common) or x6 (rare); combos +25 percent (rare); auto-roll interval x0.85 (rare) or x0.7 (epic); face cap +2 (epic); draft requirement growth softened (epic). Command `pickCharm { index: 0 | 1 | 2 }`. Rerolling the offer costs nothing but is once per draft (`rerollDraft`).
5. Luck (prestige). Unlocks when `totalEarnedRun >= 1e6`. Preview `luckOnReset = floor(sqrt(totalEarnedRun / 1e6))`. Command `prestige`: adds luckOnReset to `luck`, resets points, dice (die_1 level 1, others unowned, faces back to 1 to 6, ascensions 0), combo levels, charms, draft progress, totalEarnedRun; keeps luck, trophies, stats, settings, auto-roll unlocked. Multiplier 1 + 0.1 x luck. `prestiges` counter.
6. Trophies (achievements). Table `trophies.ts` of 14: first roll, 100 rolls, 1,000 rolls, 10,000 rolls, each die bought (4), first ascension, first charm, first luck, five of a kind, 1e6 total, 1e9 total. Each held trophy gives x1.02 points. Checked after every state change that can complete one; a `newTrophy` field surfaces the latest for a toast.
7. Stats: lifetime rolls, best single roll, hands seen (count per combo), time played (playMs), prestiges.
8. Expected value for offline and the sim must include combos: enumerate all face patterns of the owned dice (6^n, n up to 5) once per relevant state change, memoised by a key of (dice owned, faces, combo levels).

Save: `SAVE_VERSION` 2 with a v1 migration (add faces, ascensions, combos, charms, draft, luck, trophies, stats) and a v2 fixture. The sim bots gain the new commands (greedy: ascend when possible, pick the highest multiplier charm, prestige when luckOnReset >= 2 and at least 20 minutes since the last). Balance windows: keep die_2 at 1 to 3 min; all five dice by 45 min; first luck between 30 and 90 minutes of active play. If the new multipliers blow the windows, retune combo bases or the luck threshold and write the BALANCE_LOG entry.

## Look and feel

Direction: a warm, tactile table at night. Not casino, not neon. Ink background (#0f0e17 dark, #faf7f0 light), ivory dice with ink pips, one amber accent (#f2b134) for points and the primary button, a cool secondary (#7ad3ff) for charms and luck, soft shadows, 16 px radius cards, generous spacing, Geist with tabular numerals, big points number (clamp 2.5rem to 4rem). Motion: 150 to 300 ms, transforms and opacity only, respects reduce motion. Dice tumble on roll (a 3D cube turn or a 400 ms face shuffle), floating "+N" numbers from the dice, a combo callout that is the loudest thing on screen: on any pair or better, the hand name in uppercase with the multiplier after it, "FULL HOUSE 7x", slams in centred over the dice board at clamp(2rem, 9vw, 3.5rem) with overshoot, holds about 700 ms, then fades; colour and size step up with rank (pair muted, two pair and three of a kind foreground, straight and full house cool, four and five of a kind amber with a screen shake); the points gained ride under it as "+1.2K"; the dice that form the hand get a ring in the same colour for the same duration. The multiplier is the hand's current upgraded value, so "FULL HOUSE 9.6x" after two upgrades. Under reduce motion the callout still appears, without the slam and shake, a burst of particles on four or five of a kind and on ascension, a count-up on the points number. Sound through jsfxr (installed, Unlicense): roll, buy, level, combo (pitch rises with hand rank), ascend, charm pick, luck; a mute switch in settings; nothing plays before the first user gesture.

Layout: a tab bar on phones (Table, Combos, Charms, Luck, Trophies) and a two-column desktop layout (table left, the active side panel right). Settings stays in the header. The Table tab holds the points panel, roll controls, dice board and last roll. Every tab shows its next unlock when locked ("Charms open after your first ascension").

## Done when

`pnpm check` and `pnpm test:e2e` green, the game plays through its first luck in the browser, and the deploy is live.

## Build notes

Built 2026-10-25 to 2026-10-26 by four builders (core and content, fx, table, meta) and one verifier. Nothing committed yet; no package added.

What landed

- Content: `combos.ts` (7 hands), `charms.ts` (14), `trophies.ts` (14), `rules.ts` sections for ascension, combo, face, draft, luck and trophy; `validateContent` covers every table.
- Core: the M3 state fields, the eight new commands, exact expected value with hands (patterns enumerated once per dice count and decomposed per face, no state-keyed cache needed), `SAVE_VERSION` 2 with the v1 migration and `tests/fixtures/saves/v2.json`, trophy check after every mutating command and inside `advance`, auto-ascend in `levelDie`, `setAutoAscend` and an `advance` sweep. Sim bots use every new command.
- App: `settings.sound`, `src/app/audio.ts` (jsfxr, eight sounds, silent until the first gesture), `selectors.meta.ts`, the table selectors.
- UI: tab shell (bottom bar on phones, two columns from lg, active tab in `localStorage` under `nice-dice:tab`), points panel with count-up and the breakdown chips, dice board with the callout, floating gains, particles and shake, die cards with faces, ascension and face editing, combos panel, charms, draft dialog, luck, trophies, stats, trophy toast, sound and auto-ascend switches in settings. Every M2 test id kept; `points` now sits on a visually hidden span with the true value while the big number tweens.

Two retunes beyond the brief, both in `docs/BALANCE_LOG.md` (2026-10-25) and both needing the owner's GDD edits: `rules.ascension.costMultiplier` 300 (a die's level cost does not restart from `baseCost` after ascending; without it the game ran away minutes after the first ascension) and `rules.luck.threshold` 1e6 to 1e10 (at 1e6 the first luck landed at 16 min). Sim windows on seeds 1 to 3: die_2 at 1:04 to 1:22, all five dice by 8:22 to 9:23, first ascension and charm at 13:52 to 14:29, first luck at 34:42 to 43:02.

Verification (2026-10-26)

- `pnpm check`: tsc clean, oxlint with only the two pre-existing `src/components/ui` fast-refresh warnings, vitest 22 files, 381 passed, 1 skipped (the fixture generator).
- `pnpm test:e2e`: 10 passed against the dev server (M2 smoke, import, recovery), unchanged tests.
- Headless playthrough (throwaway Playwright script, fresh context): rolled 3 times, levelled die_1, auto-roll switch appeared on and rolled on its own within 5.6 s, bought die_2 (the Company toast fired), rolled to a pair. Table, Combos, Charms, Luck, Trophies and Settings screenshotted at 1280x800 and 390x844 in dark and light themes; zero console errors or warnings on load and after every tab.
- A v1 save in the storage envelope loads through the migration without a recovery dialog (49.94 points, die_1 at level 4, auto-roll on, 14 rolls) and writes back as version 2 after a roll.

Verifier fixes in the screenshots

- The combo callout was centred vertically over the board, which on a phone is about 1900 px tall, so "PAIR 2x" rendered far below the fold while the player tapped Roll; on desktop it sat on the second card's level buttons at 16 px. Now pinned over the first row of dice (`items-start pt-14`), the points gained ride under the hand name (`detail` prop), and the tiers are text-xl to 3xl on phones and 2xl to 5xl from sm, sized so "FOUR OF A KIND 13.2x" fits a 390 px board.
- The floating "+N" spawned at 20 percent of the board's height, over the first card's buttons on phones and across an ivory face on desktop. It now rises from a strip along the board's top edge.
- The trophy toast at `bottom: 1rem` covered the phone tab bar; it now sits above the bar below lg.

Open for the owner

- GDD sections 4, 5, 7 and 10 need rows for the cost multiplier, combos, charms, the draft, the luck threshold and trophies.
- The 8 h sim still runs away (lifetime 1e122 to 1e134, luck summed near 1e17) through `luck = floor(sqrt(run / threshold))` with a prestige every 20 min; reported, not fixed.
- `motion` is not installed, so the count-up is a rAF tween with the same 250 ms and reduce-motion fallback. `src/app/jsfxr.d.ts` carries the ambient types jsfxr lacks.
- Epic charms are drawn amber per this brief; the `rarity-epic` purple token exists unused. The draft dialog cannot be dismissed without picking. The toast shows only the latest trophy when one change awards several.
- The idle bot still earns nothing (auto-roll unlock needs die_1 level 2), unchanged from M1. `selectDieCard` in `src/app/selectors.ts` is unused since `selectDieSlot` replaced it.
- Not verified by the verifier: a full run to the first luck in the browser (the sim puts it at 35 to 43 minutes of play) and the deploy.
