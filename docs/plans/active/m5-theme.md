# M5 theme: a longer luck sink, the dicewright's workshop, title screen, itch.io build

Status: in progress 2026-10-26. Branch `m5-theme`. Same working style: `pnpm check` green, no review rounds, tests where they protect saves and formulas.

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
