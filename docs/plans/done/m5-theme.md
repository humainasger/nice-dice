# M5 theme: a longer luck sink, the dicewright's workshop, title screen, itch.io build

Status: merged 2026-10-26 in humainasger/nice-dice#6.

## The fantasy (decides every name and the art)

You are a dicewright: a craftsperson in a lamp-lit workshop at night, carving dice from ever finer materials and rolling them on the bench to earn your keep. Not a casino, not a tavern. Points are "points" (the player knows the genre); the workshop supplies the names. Tone: warm, tactile, a little dry. Dice by material in content order: Pine Die, Oak Die, Bone Die, Brass Die, Obsidian Die. Ascension is "refining" in copy ("Refine" button, "Refined x2" badge) while the code keeps `ascend`. Charms stay charms; their names stay workshop objects (cups, felt, chalk, thimble, and so on; keep the existing ids). Luck stays luck. Trophies become "Marks" in copy (a dicewright's maker's marks); ids and the code name stay. Tabs: Bench (was Table), Hands (was Combos), Charms, Luck, Marks. Locked copy examples: "Carve the Oak Die to unlock", "Charms return after your first refinement of this run".

## Late-game luck sink (core)

1. Mastery, per die, unbounded: `masterDie { id }` spends luck for +10 percent output on that die per level, cost `ceil(2 x 1.35^level)` luck. Shown on the die card as a small "Mastery N" badge with a luck-priced button, and in the Luck tab as a per-die row.
2. Fortune's Favour, global, unbounded: `buyFavour` spends luck for +5 percent all points per level, cost `ceil(1.5^level)` luck (level 0 costs 1).
3. Both persist through luck resets. `SAVE_VERSION` 4 with a v3 migration (mastery {}, favour 0) and a v4 fixture. Sim bots buy them after the seven upgrades max out, by income lift per luck. Balance check: with the sinks the 24 h active run stays below 1e80 and the 8 h run inside 1e25 to 1e45; adjust the sink costs if not, log in BALANCE_LOG, and update GDD 7.1.

## Title screen (ui)

4. A title screen on every load, before the bench: a hand-coded SVG scene (no raster): the workbench edge in warm wood tones, a lamp glow (radial gradient) from the top right, one large ivory die mid-tumble with soft shadow, a few shavings, dust motes drifting (CSS, off under reduce motion). Title "Nice Dice" in Fraunces (installed: @fontsource-variable/fraunces, OFL), subtitle "a dicewright's idle game", one primary button "Continue" (or "Start carving" for a new game) and a muted "Settings" link. The screen is where unlockAudio() happens. Phone and desktop layouts. The same scene, cropped, becomes the og:image placeholder later; not now.

## Naming pass (content and copy)

5. Rename in content tables (names and descriptions only, ids unchanged): dice as above with one-line notes per material; trophies renamed as marks with workshop flavour; charm flavour lines checked against the fantasy; luck upgrade names kept (they already fit), descriptions lightly reworded. UI copy: tabs, buttons, locked lines, settings headings, the away modal ("While you were away" stays), the credits line. index.html title and description, the PWA manifest name and description, README first paragraph, GDD section 1 rewritten to this fantasy and sections 7.1 and 10 updated for the new sinks and the mark names.

## itch.io build

6. `pnpm build:itch`: a node script `scripts/build-itch.mjs` that runs `vite build` with base `./` and `VITE_PLATFORM=itch` into `dist-itch/`, strips the service worker registration for that platform (the app skips registerSW when `import.meta.env.VITE_PLATFORM === 'itch'`), and zips the folder to `dist-itch/nice-dice-itch.zip` with index.html at the zip root (use the system `zip`). `dist-itch` gitignored. `docs/ITCH.md`: the upload checklist (HTML project, played in the browser, viewport 1280 x 800 with fullscreen button and mobile friendly, no Kongregate-style embed needed), the AI disclosure answers to pick from with a recommendation (code AI-assisted yes; graphics are hand-coded SVG written with AI assistance, so answer yes for graphics too; sound generated procedurally by jsfxr; no AI text beyond assisted copy), the licence placeholder, the credits to paste, and a note that itch saves are separate from the Pages save and that export and import bridges them.

## Done when

`pnpm check`, `pnpm test:e2e` and `pnpm build:itch` green, the title screen plays into the bench, the names read as one workshop, mastery and favour can be bought from a seeded luck save, and the deploy is live.

## Build notes

Built 2026-10-26 by five builders (core and sim, title screen, naming pass, luck sink UI, itch build) and one verifier. Nothing committed; no package added. The deploy is the one "Done when" item still open.

What landed

- Core: `state.mastery` (per die id, level 0 when absent) and `state.favour`; commands `masterDie { id }` (valid on unowned dice too, the level waits for the die) and `buyFavour`, both no-ops when the luck does not cover the cost; `rules.mastery` { baseCost 2, costGrowth 1.35, step 0.1 } and `rules.favour` { costGrowth 1.5, step 0.05 }; formulas `masteryCost`, `masteryMultiplier`, `favourCost`, `favourMultiplier`; selectors `masteryView(state, id)` and `favourView(state)` returning { level, nextCost, affordable, multiplier }. `multiplierBreakdown` keeps its shape: mastery sits inside `dice` (`effectiveDieMultiplier`), favour inside `luck` (`luckAndUpgradesMultiplier`), so the chips still multiply to the total. `SAVE_VERSION` 4 with `migrateV3` (mastery {}, favour 0), unknown ids and zero levels dropped on load, `tests/fixtures/saves/v4.json`. Sim bots spend luck on the sinks by income lift per luck once the seven upgrades are maxed; the report carries mastery levels and favour. Balance passes at the brief's costs with no retune (8 h lifetime 1.51e41 / 2.95e41 / 2.90e40 on seeds 1 to 3, 24 h 5.94e45 / 4.01e45 / 4.29e45, first hour unchanged); `docs/BALANCE_LOG.md` entry and `docs/balance-report.*` regenerated.
- Title screen: `src/ui/title/WorkbenchScene.tsx` (inline SVG, two crops, CSS motes off under reduce motion) and `TitleScreen.tsx` (Fraunces title, "a dicewright's idle game", Continue or Start carving, Settings link, test ids `title-screen`, `title-continue`, `title-settings`); `ui.titleDismissed` and `dismissTitle()` in the store; `App.tsx` renders the title until dismissed with the recovery dialog above it; `unlockAudio()` runs on the Continue tap and the old window unlock listeners are gone; `@fontsource-variable/fraunces` imported in `index.css` with a `font-display` utility.
- Naming: dice Pine / Oak / Bone / Brass / Obsidian Die with material notes, trophies renamed as marks, charm and luck upgrade copy reworded, `content.test.ts` pins the names and guards casino, tavern, gambl, table and ascen in copy; tabs Bench / Hands / Charms / Luck / Marks (ids unchanged), Refine and Refined xN, Carve for N, "On the bench", Auto-refine, settings headings, chips dice / hand / charms / luck / marks, credits with Fraunces; `index.html` and manifest descriptions, README, GDD sections 1, 4, 7, 7.1 and 10, DECISIONS D18.
- Luck sink UI: DieCard Refine button, Refined and Mastery badges, a Master button (`mastery-buy-<id>`, shown once lifetime luck is above 0); LuckPanel "Without end" group with Fortune's Favour (`favour-buy`) and a Mastery group with one row per owned die (`mastery-<id>`); `src/app/selectors.luck.ts` gains `favourRow`, `masteryRow` and `selectLuckSinkReady`, which also lights the Luck tab dot.
- itch: `scripts/build-itch.mjs` behind `pnpm build:itch` (base `./`, `VITE_PLATFORM=itch`, `dist-itch/` gitignored, zip with index.html at the root, no sw.js in the zip); `startServiceWorker` returns first on itch; `docs/ITCH.md` with the upload checklist, AI disclosure options, licence placeholder, credits and the saves note; `tests/e2e/itch-build.spec.ts` builds, unzips and serves the zip from a nested path inside `pnpm test:e2e`.

Verification (2026-10-26)

- `pnpm check`: tsc clean, oxlint with only the two pre-existing `src/components/ui` fast-refresh warnings, vitest 23 files, 455 passed, 1 skipped (the fixture generator).
- `pnpm test:e2e`: 11 passed against the dev server (smoke, import, recovery, itch build).
- `pnpm build:itch`: 0.40 MB zip, 17 files, index.html at the zip root. Unzipped into a scratch folder and served by `python3 -m http.server` under `/html/777/`, loaded with a throwaway Playwright script at 1280x800: five requests (page, JS, CSS, Fraunces and Geist woff2), all 200, no failed request, no console error or warning, zero service worker registrations, the title rendered, Continue opened the bench, one roll gave 5 points.
- Seeded playthrough (save built with the real core through a tsx script: one prestige, every die carved, Pine Die at level 100 with auto-refine off, luck 40 and luckTotal 40, no mastery or favour; injected into IndexedDB and the mirror). Desktop 1280x800, dark: the title read "Continue"; the bench named Pine, Oak, Bone, Brass and Obsidian Die, the side tabs read Hands / Charms / Luck / Marks over "On the bench", "Refine x100 output" sat on the Pine Die, the header read Luck 40. Master on the Pine card took the die from x100 to x110 per pip, the chips from dice x130 / total x2.33K to x140 / x2.51K, the card gained the Mastery 1 badge and the button went from 2 to 3 luck; the Luck tab read 38 to spend, 40 lifetime, five mastery rows (Pine Die Lv 1); Fortune's Favour took spendable to 37, the luck chip from x5 to x5.25 and the row to "+5% (x1.05)"; Marks listed First Throw, Oak Shavings, Pressed Your Luck and the rest with no "Trophy" wording; the Hands panel reads Hands. Phone 390x844: tabs Bench / Hands / Charms / Luck / Marks, the same buys and numbers. Zero console errors, warnings or page errors; the layout audit (overflow, clipped text, horizontal scroll) clean on every screen. Screenshots of title, bench, Luck and Marks at both sizes in the session scratchpad under `shots-m5/`.

Verifier fixes

- `tests/e2e/helpers.ts`: `continueFromTitle()` taps `title-continue` (disabled until boot settles, so Playwright's wait covers boot) and waits for the title to leave; `openGame()` uses it, as do the smoke reload test and both recovery paths after Restore and Start fresh. Nothing else in the specs changed.
- `src/ui/GameScreen.tsx`: a tab change scrolls to the top. The phone's bottom bar is reachable from any scroll depth, and after tapping Master on a card the Luck tab opened mid-shop and Marks at the page bottom.

Open for the owner

- The 8 h lifetime now sits 3.5 to 4.5 orders below the 1e45 ceiling (up from about 2e37 in M4); untested levers if more headroom is wanted are `mastery.costGrowth` 1.35 to 1.45 or `mastery.step` 0.1 to 0.08, then `favour.costGrowth` (BALANCE_LOG). By 24 h one mastery level costs about 1100 luck and one favour level about 1500 against 300 to 400 luck per reset, so luck piles up between buys.
- The Luck tab dot lights whenever favour or any die's mastery is affordable, which after the seven upgrades is most of the time between resets (favour level 0 costs 1 luck). Drop `selectLuckSinkReady` from the badges line in `GameScreen.tsx` if that nags.
- The Luck tab's Mastery group lists owned dice only, so after a reset the Oak to Obsidian rows vanish until the dice are carved again; the unowned card shows "Mastery N waits for it" instead. Core allows `masterDie` on unowned dice either way.
- Charm names kept as they were (Card Sharp survives with a reworded flavour line); GDD section 14 Q1 still says the fantasy is open; GDD section 4 keeps its "TODO owner: final names" line; PLAN.md, ARCHITECTURE.md and ROADMAP.md still use Combos and trophies as code names. The README commands table lacks `pnpm build:itch`.
- `docs/ITCH.md` leaves three choices to the owner: the AI disclosure option (A recommended), the licence line and the embed mode (Embed in page 1280 x 800 recommended). The itch upload and the Pages deploy were not done. `pnpm build:itch` does not run `tsc -b` (`pnpm check` covers types); the itch build still ships the PWA manifest link, harmless since no worker registers. The Fraunces import is the wght axis only (36 KB); the opsz and SOFT/WONK axes are a one-line import swap in `index.css`.
- Dev only: an HMR update to `src/app/store.ts` resets `ui.titleDismissed`, so the title reappears after such an edit.
