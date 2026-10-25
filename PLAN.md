# Nice Dice: stack decision and build plan

Status: plan, nothing built yet. Owner: Asger. Written 2026-10-25 from a nine-agent research pass with primary-source checks (versions, licences and prices as of that date).

Goal: a browser dice incremental in the spirit of Idle Dice, built mostly by Claude Code, assets mostly generated or sourced free, playable on a public URL within two weeks, portal-ready within two months.

## 1. Decisions

| # | Decision | Choice | Why | What would flip it |
|---|---|---|---|---|
| D1 | UI stack | TypeScript 7 strict + Vite 8 + React 19 + Zustand 5 + Tailwind 4 + shadcn/ui | Largest training corpus (React 44.7% vs Svelte 7.2% in Stack Overflow 2025), hooks API unchanged since 2019, plain TSX works on TypeScript 7 while Svelte and Vue still need a TypeScript 6 side-install, shadcn gives agents accessible dialogs they otherwise hand-roll badly | If you value a mechanical autofix loop over corpus size, Svelte 5 with its official MCP server and `svelte-autofixer` is a legitimate near-peer |
| D2 | Rendering | DOM, CSS 3D transforms and the Web Animations API. No Phaser, no PixiJS in v1 | A dozen dice is not a canvas problem. Canvas text and no CSS theming are exactly the complaints Idle Dice's Phaser 2 build gets (tiny mobile text, no dark mode) | Add PixiJS 8 inside one React component later for particles only |
| D3 | Numbers | `break_infinity.js` Decimal for every game value from the first formula, behind a one-file wrapper | Idle Dice's own bundle wraps every value in a Decimal and its curves pass 1e308 within hours of late game. Agents write `a * b` and `a > b` everywhere, so "swap later" means rewriting the whole sim | A design that provably caps magnitude, such as fixed-length roguelite runs, could use plain numbers |
| D4 | Game core | Pure TypeScript module with `advance(state, dt, rng)` and `dispatch(command)`, zero React, DOM, `Date.now` or `Math.random` imports, enforced by a test | Lets the agent prove balance headlessly instead of by clicking. This is the single biggest lever for staying in control | None |
| D5 | Theme | Not casino. Dice are the mechanic, the fantasy is yours to pick (workshop, tavern, alchemy, expedition) | PEGI rates simulated casino gambling 18+, CrazyGames requires PEGI 12 compliance, and the casino layer is where Idle Dice players report grind. It is also the most recognisable part of Idle Dice's expression, which is the part copyright protects | None |
| D6 | v1 scope | Roll loop, dice levelling and ascension, poker-hand combos, one draft-on-a-progress-bar layer, one prestige layer, one differentiator (die-face editing), zero minigames | Each extra system is its own balance surface. Without a written cut the agent starts everything | Outside playtest after v1 decides what leaves the parking lot |
| D7 | Hosting | GitHub Pages first via Vite's shipped Actions workflow, then Cloudflare Workers Static Assets once there is a domain or ads | Cloudflare now tells new projects to use Workers, not Pages. Vercel Hobby is non-commercial, GitHub Pages' terms bar running a business | None |
| D8 | Assets | Hand-coded SVG dice, panels and buttons. game-icons.net and Kenney for the icon and audio layer. AI generation only for illustrative art and a few bespoke sounds | Crisp at any DPI, themeable by CSS variables, kilobytes, and unambiguously your copyright. Total AI spend under 60 USD, zero is achievable | A bespoke icon look later via Recraft with a locked custom style |

Resolved during review: four of seven researchers said "start with plain numbers and swap later". The stack critic refuted that against Idle Dice's live bundle, hence D3.

## 2. Stack and libraries

All MIT unless noted. Versions are npm latest on 2026-10-25. Pin exact versions for anything last released before 2025.

| Package | Version | Purpose | Note |
|---|---|---|---|
| typescript | 7.0.2 (Apache-2.0) | Types | Go-native, strict by default, `types: []` default so list `@types/node` for the sim CLI |
| vite + @vitejs/plugin-react | 8.3.5 / 6.1.2 | Build | ESM-only, Rolldown. Skip React Compiler in v1 |
| react, react-dom | 19.3.1 | UI | Function components and hooks only |
| zustand | 5.0.16 | Store | v5 removed the equality argument from `create()`. Use `useShallow` or `createWithEqualityFn`. Selecting a fresh object or array throws "Maximum update depth exceeded" |
| tailwindcss + @tailwindcss/vite | 4.3.3 | Styling | v4 is a rewrite: `@import "tailwindcss"`, no `tailwind.config.js`, renamed utilities. Put the upgrade guide in `.claude/rules/` |
| shadcn, radix-ui | 4.22.1 / 1.8.1 | Panels, dialogs, tooltips, tabs | Focus-trapped dialogs for free |
| break_infinity.js | 2.2.0 | Big numbers to 1e9e15 | 4 kB gzip. Last release 2023, stable not maintained. Pin exactly. Wrap in `src/core/num.ts` |
| @antimatter-dimensions/notations | 3.2.0 | Scientific, engineering, letters formatting | Built for break_infinity. Vendor the source if the 2022 date bothers you, or write a 40-line suffix formatter |
| pure-rand | 8.4.2 | Seeded RNG (xoroshiro128plus) | Inject into the sim, store seed in the save. Prefer over seedrandom (frozen 2019). v8 has no root export; import from pure-rand/generator/xoroshiro128plus and pure-rand/distribution/uniformInt |
| zod | 4.6.7 | Validate save files and content tables at the boundary | |
| lz-string | 1.5.0 | Compress saves, export strings | Stable since 2023, fine |
| idb-keyval | 6.3.0 (Apache-2.0) | IndexedDB wrapper for the save | Pair with `navigator.storage.persist()` |
| motion | 14.6.0 | UI transitions, number tweens | CSS keyframes for the dice themselves |
| lucide-react | 1.61.0 (ISC) | Interface icons | Has a `dices` icon |
| vitest | 5.0.5 | Unit, purity, balance and golden tests | Needs Node 22.12 or newer. Local Node is 22.22.3 |
| fast-check | 4.10.2 | Property tests on formulas | Cost growth monotonic, bulk buy equals summed singles |
| @playwright/test | 1.64.1 (Apache-2.0) | Smoke tests: load, play, reload, save survives | |
| tsx | 4.23.15 | Run the sim CLI | |
| vite-plugin-pwa | 2.0.0 | Installable, offline, and the only durable save on iOS | Use `registerType: 'prompt'`, not autoUpdate, or save before the reload |
| jsfxr | 1.4.1 (Unlicense) | Runtime retro SFX, no asset files | |

Skip, with reasons:

- Profectus and The Modding Tree. Profectus is 35 stars, last commit 2025-12-24, pinned to Vite 5, Vitest 1, PixiJS 6, Node 21. TMT runs on EOL Vue 2.7 from a CDN. Read both for prestige-layer design, copy nothing.
- Phaser 4 and PixiJS 8. Healthy projects, wrong problem. 352 kB and 237 kB gzip for a dozen dice.
- `@3d-dice/dice-box` and three.js dice. Physics rollers that take seconds per roll and ship a 3D engine plus WASM physics. Wrong for a board that rolls ten dice per second.
- decimal.js in the tick loop (accurate, slow), swarm-numberformat (abandoned 2018), GSAP (free since 2025 but proprietary licence, and motion covers the need), howler.js (works, no release since 2023, a 60-line Web Audio pool covers a dozen sounds).
- A Web Worker for the sim. Delta-time catch-up already neutralises Chrome's hidden-tab throttling, and a worker forces serialising state across `postMessage`.

Reference code worth reading, in order: Progress Knight (Unlicense, about 1,300 lines, a complete minimal game), The Modding Tree `js/utils/save.js` and the offline block in `js/game.js`, Antimatter Dimensions `src/core/storage/` (serializer, migrations, away-progress, backup slots), Synergism (modern TypeScript layout, cancellable offline simulation). All MIT or public domain. Trimps and Swarm Simulator are GPL: read only. Kittens Game, Cookie Clicker, Melvor and Idle Dice: never copy code, art, names or balance tables.

## 3. What Idle Dice does, what we borrow, what we change

Verified from the live bundle and the community wiki. Mechanics and formulas are not copyrightable. Art, names, text and the specific UI arrangement are.

Idle Dice's structure: up to 5 regular D6 dice, points per roll = sum(face x die multiplier) x poker-combo multiplier x product of up to 5 multiplier dice (D2 to D100). Dice cost 10, 100, 1k, 10k, 100k with a 1.08 per-level cost coefficient. A die ascends at level 100 (level resets, x100 multiplier) and fills a card bar whose requirement grows 1.15 per card. 52 cards drawn three at a time, prestige resets dice and cards for an additive multiplier, golden cards and "luck" persist, casinos are a third reset, then slots and duels. Auto-roll every 5 s. Offline gain capped at 8 hours. First prestige at roughly 1 to 3 hours of active play.

Borrow the skeleton:

- Roll to points to upgrade, with poker-hand combos as the visible skill layer.
- The three-choice draft on a progress bar. This is the moment players praise most.
- Layered resets that each state exactly what resets and what stays.
- Use the verified constants as the first balance baseline: 1.08 level cost growth, 1.15 draft requirement growth, 2.35 combo upgrade growth, 5 s base interval, 8 h offline cap. Then diverge. Target first soft reset at 30 to 60 minutes, not 1 to 3 hours. Early-game slog is the most cited complaint.

Change:

- v1 differentiator: face editing. Players modify individual die faces (swap a 1 for a 6, add wild, exploding or x2 faces, weighted faces). Idle Dice only levels a scalar per die and hides probability shaping behind a late upgrade. This puts a visible strategic layer on screen from minute one and is dice-native.
- Automation is an early, deliberate purchase. Idle Dice gates auto-draw and auto-ascend behind late achievements, the most repeated complaint.
- Dark mode, no hidden panels, export and import saves, a visible next unlock, readable mobile text. All things Idle Dice 1 never shipped.

Parking lot (after the first outside playtest, one at a time): spatial board with adjacency, fixed-length roguelite runs, player-authored hand types, a non-casino push-your-luck layer, a streak currency, any minigame.

## 4. Architecture rules (these go into CLAUDE.md verbatim)

- `src/core/` is pure TypeScript: state types, `dispatch(state, command)`, `advance(state, dtMs, rng)`, formulas, save and migrations. A purity test greps the folder for `react`, `window`, `document`, `localStorage`, `Date.now`, `new Date`, `Math.random` and fails on any hit. A dependency-direction test enforces content to core to app to ui.
- `src/content/` holds every tunable number as typed tables with stable string ids: dice, faces, upgrades, combos, draft options, prestige, unlocks, achievements. Validated with zod at startup. No numeric literal in a core formula outside content. The owner tunes here without touching logic.
- `src/app/` is the browser shell: fixed 100 ms accumulator loop driven by `requestAnimationFrame` when visible and `setInterval` when hidden (rAF stops entirely in hidden tabs), autosave every 30 s and on `visibilitychange` and `pagehide`, offline catch-up on load.
- `src/ui/` renders and calls `dispatch`. Components select primitives or formatted strings, never the whole store and never a fresh Decimal (Zustand strict equality sees a new reference every tick and re-renders everything). Keep Decimals in the vanilla store, mirror formatted strings into React state at a few Hz.
- All numbers go through one `formatNumber` with a fixed `en-US` locale. Your machine is `da-DK` and would render `1.000,5`.
- Offline: `elapsed = clamp(now - lastUpdate, 0, cap)`. Negative means the clock went back: grant nothing, move `lastUpdate` forward. Run at most 1e5 fixed ticks, apply the expected-value remainder (Idle Dice ships an "avg offline gain per second"), test that EV-offline equals stepped-online within tolerance. Show a "while you were away" modal.
- Saves: `SAVE_VERSION` number, ordered migration map, deep-merge over defaults, zod validation, fixture save from every historical version loaded in a test. A state-shape change means version bump plus migration plus test, no exceptions. Decimals serialise as strings so `Infinity` never becomes `null`.
- Save durability: IndexedDB via idb-keyval plus `navigator.storage.persist()`, rotating backup slots (1, 5, 20, 60 minutes, Antimatter Dimensions' pattern), `try/catch` on every write for `QuotaExceededError`, quarantine an unparseable save under a backup key and show a recovery dialog rather than overwriting it, reject future-version saves without mutating them, export and import strings as a first-class feature with "export first" on import. A Web Locks guard refuses to run a second tab.
- Platform adapter from day one: a `Platform` interface with `gameplayStart`, `gameplayStop`, `loadingStart`, `loadingStop`, `requestAd`, `happytime`, `saveStore`. The web build gets a no-op implementation. CrazyGames' SDK drops in behind it later without touching the game.

## 5. Build plan

Each milestone ends mergeable with tests green, one feature per branch and pull request, fresh Claude Code session per slice started from its plan file. Time box: M0 to M2 in two weekends, playable URL by day 14, M3 to M5 in weeks 3 to 6, M6 in weeks 7 to 8, go or no-go on parking-lot items after the first outside playtest.

| Milestone | Build | Done when | Asger's part |
|---|---|---|---|
| M0 Scaffold and guards | pnpm, Vite, TypeScript strict, Vitest, Tailwind 4, shadcn, purity and layering tests, zod content schema, `num.ts` wrapper, CLAUDE.md, ARCHITECTURE.md, GDD skeleton, empty BALANCE_LOG.md, GitHub Actions deploying to Pages, PWA manifest | `pnpm check` runs typecheck, tests and content validation. An empty page deploys to a public URL | Pick the fantasy and working title (trademark search first), fill GDD sections 1 to 3 including the magnitude table |
| M1 Headless core | One die, one currency, roll command, `advance`, seeded RNG, save and load with `SAVE_VERSION` 1, sim CLI with one bot and two pacing assertions. No UI | `pnpm sim --hours 1` prints time to second die. Balance test passes | Set the first two pacing targets |
| M2 Thin UI | Roll button, auto-roll, number display, autosave, offline modal, export and import, multi-tab guard, mobile viewport (`100dvh`, `touch-action: manipulation`, 44 px targets, hold-to-repeat buy, safe-area insets), reduced-motion switch, dark and light tokens, Playwright reload test | Play 60 s on your phone, reload, progress survives. Install as PWA on iPhone | Playtest minutes 0 to 5 on phone and laptop |
| M3 Content | Five dice, levelling, ascension, upgrades table, unlock conditions, achievements, sim to 8 h | Sim shows no dead content and no income trough over 10 min in the first 8 h | Tune content tables, approve BALANCE_LOG entry |
| M4 Combos and faces | Poker-hand combos with an odds panel, face editing with its own table, the three-choice draft | Sim shows which die and which face dominates. Owner can reach first draft in 10 to 20 min | Decide combo defaults from the odds panel |
| M5 Prestige | One reset layer, "what resets, what stays" dialog, cycle-length assertions | First prestige worthwhile between 30 and 60 min active, cycles shorten | Approve reset rules |
| M6 Polish and release | Style bible, icon pass, illustrative art, SFX, music decision, settings, hotkeys, credits screen, itch.io page with AI disclosure, UI-similarity review against Idle Dice | Public itch page, outside playtest with three people | Art direction, write the itch page |

Working rhythm. You spend 15 to 45 minutes a day: edit GDD targets or content tables, pick the next slice, approve the plan Claude produces in plan mode, read the pull request description with its sim table and screenshot rather than every line, playtest the affected minutes, merge. The agent per slice: explore, write `docs/plans/<slice>.md`, implement, test, run `pnpm check` and `pnpm sim`, update BALANCE_LOG and DECISIONS, open the PR with evidence, run an adversarial review subagent against the plan. Weekly, one cleanup session hunting dead code, duplicate systems and doc drift.

Hooks worth having: a PreToolUse hook that blocks `git push --force`, `git reset --hard` and `rm -rf` outside `node_modules` and `dist`, and blocks edits to `src/core/save.ts` without a matching migration test. A Stop hook that runs `pnpm check` so a turn cannot end red.

Repo layout:

```
CLAUDE.md  ARCHITECTURE.md
docs/GDD.md  docs/DECISIONS.md  docs/BALANCE_LOG.md  docs/ROADMAP.md  docs/plans/{active,done}/
src/core/  src/content/  src/app/  src/ui/
tools/sim/  tests/e2e/
.claude/rules/core-purity.md  .claude/rules/content.md  .claude/rules/tailwind-v4.md  .claude/settings.json
```

GDD sections, every number in 3 to 8 maps to a field in `src/content`: 1 fantasy and references, 2 loops at 30 s, 5 min, one session, one day, 3 currencies with expected magnitude after 1 h, 1 day, 1 month, 4 dice table (base cost, growth, output, unlock), 5 multipliers and stacking rules, 6 manual actions, 7 prestige (trigger, formula, what resets, target cycle length), 8 unlock timeline for active and idle play, 9 offline policy, 10 achievements, 11 save policy, 12 pacing assertions that become `balance.test.ts`, 13 out of scope, 14 open questions. Start the first pass from Anthony Pecorella's idle-math spreadsheets and his "Math of Idle Games" series. Cost growth 1.07 to 1.15 per purchase, x2 milestones at 25, 50, 100 owned, prestige gain as a root or log of lifetime points.

## 6. Asset pipeline

| Asset class | Source | Cost | Note |
|---|---|---|---|
| Dice, pips, panels, buttons, bars, badges | Hand-coded SVG and CSS by Claude Code | 0 | Themeable, crisp, animatable, your copyright |
| Interface icons | lucide-react | 0 | ISC |
| Flavour icons (upgrades, faces, achievements) | game-icons.net (CC BY 3.0, 37 dice icons), Kenney Board Game Icons and UI Pack (CC0) | 0 | One attribution line on the credits screen |
| Bespoke icon set, if the free layer does not cohere | Recraft Basic, custom style trained from 5 to 10 reference icons, native SVG output | 10 USD for one month | Lock one `style_id`, generate the whole set in one session, recolour to the CSS palette |
| Illustrative art (title, backgrounds, draft cards, mascot) | OpenAI image API, `gpt-image-2.5-sunburst` or `gpt-image-2`, transparent PNG, quality pinned to medium | about 0.05 USD per image, 200 images about 11 USD | Fixed prompt template with palette hex codes, one reference image reused through the edits endpoint. Do not let the script default to `xhigh` or `max` |
| Background removal, upscaling | rembg with `-m birefnet-general` (not the default BRIA model, which needs a commercial licence), Upscayl | 0 | rembg 2.0.86 declares Python 3.11 to 3.x and onnxruntime ships 3.14 wheels, so try your Python 3.14 first and fall back to 3.13 if a dependency lacks a wheel. Prefer generating at 1024 to 2048 and displaying at 512 over upscaling |
| SFX | jsfxr at runtime, Kenney Casino Audio and Interface Sounds (CC0), ElevenLabs Starter for a handful of bespoke sounds | 0 to 6 USD | Gate playback behind a user gesture for mobile |
| Music | None or an ambient loop from OpenGameArt or Freesound (Free Cultural Works filter), or one month of Suno Pro | 0 to 10 USD | Not Udio: its Nov 2025 terms give Udio ownership and forbid downloads |
| Fonts | Self-hosted OFL fonts | 0 | Not Google Fonts CDN (LG München I 2022 ruling on IP transmission). Many "game" display fonts are personal-use only |

Skip Midjourney (no API, images public below the 60 USD plan, perpetual licence to Midjourney). Skip local Flux unless you want it as a hobby. Only FLUX.1 schnell and FLUX.2 klein 4B are Apache 2.0, the dev variants carry a non-commercial licence with unresolved ambiguity for monetised games.

Acceptance step before any AI art ships: a one-page style bible (palette, line weight, lighting, perspective), one batch per set, recolour pass, Playwright screenshot baselines, and a stated fallback to all-SVG if the set does not match the hand-coded dice. CrazyGames rejects mixed aesthetics.

Legal: purely AI-generated material is not copyrightable (US Copyright Office Part 2, Jan 2025, and Thaler, cert denied March 2026). Human selection, arrangement and modification are protected. Keep a generation log (model, prompt, date, file). Code, design, data tables and hand-made SVG are the copyright core. Tick the AI disclosure on itch.io and later Steam.

## 7. Distribution path

1. Day one: public GitHub repo, Vite's GitHub Pages workflow with `base: '/<repo>/'`, PWA manifest with 192 and 512 icons. Free, HTTPS, installable.
2. Own domain or ads: Cloudflare Workers Static Assets via `@cloudflare/vite-plugin` and `wrangler deploy` from the same Action. Static requests free and unlimited, no non-commercial clause.
3. After M6: itch.io. Self-serve, ZIP with `index.html`, 500 MB and 1,000 files, `butler` push from CI, fill the AI Disclosure field (Graphics, Sound, Code) honestly.
4. When own-URL and itch telemetry show 10 minutes average session and some day-one return: CrazyGames. Self-serve, non-exclusive, SDK v3 with ads, cloud save (1 MB) and `happytime()`. Basic Launch needs 7 days and 500 plays, auto-ends at 21 days, ads off during it. Revenue share is not published, treat third-party 50 to 70 percent figures as unverified. Requirements: PEGI 12, English, under 20 MB initial download, gameplay in 0 to 1 clicks, no external links except Discord or your site.
5. Skip Kongregate (closed to new games since 2020), Armor Games (pitch-only), Poki (application-only, apply after a CrazyGames full launch).
6. Steam, 6 to 12 months out, only with an audience: Electron plus steamworks.js, 100 USD per app, 21-day wait, 2-week coming-soon page, AI art and audio disclosure in the content survey.

Storage reality the plan must respect: every portal runs the game in a cross-origin iframe, and Chrome partitions storage by top-level site, so own URL, itch and CrazyGames are three separate saves. Safari deletes script-writable storage after seven days without a visit, PWA installs keep their own counter. Export and import strings, the CrazyGames data module behind the `saveStore` seam, and the PWA are not polish, they are the save system.

Analytics: none in v1. If needed later, Umami Cloud Hobby (cookieless, 100K events a month, US and EU servers with no region guarantee) with a one-page privacy policy, 6 to 10 custom events only. PostHog's default persistence writes cookies and needs consent under ePrivacy from Denmark.

## 8. Open questions for Asger

- Q1 Title decided 2026-10-25: Nice Dice, repo nice-dice. The fantasy behind the dice is still open and is needed before M1 names any content. Not casino (D5).
- Q2 Phone or laptop first. Idle Dice is landscape. Recommendation: responsive with a portrait phone layout, since that is where you will playtest.
- Q3 Monetisation intent. Hobby and free changes nothing. Portal ads later means Cloudflare hosting, PEGI 12, a privacy policy and the platform adapter from M0, all already in the plan.
- Q4 The v1 differentiator. Recommendation: face editing. Alternatives in the parking lot.

## 9. Sources

- Idle Dice live build and bundle: https://luts91.github.io/idle-dices/ (offline cap `Math.min(secondsAway, 0x7080)`, Phaser 2.10.1, decimal.js wrapping all values)
- Idle Dice wiki (dice costs, combos, cards, prestige, interest): https://idle-dice.fandom.com/wiki/Dice and https://idle-dice.fandom.com/wiki/Idle_Dice_Tutorial
- Stack Overflow 2025 framework shares: https://survey.stackoverflow.co/2025/technology
- TypeScript 7.0 announcement (Svelte and Vue template checking not yet supported): https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- Zustand v5 migration: https://github.com/pmndrs/zustand/blob/main/docs/reference/migrations/migrating-to-v5.md
- Tailwind v4 upgrade guide: https://tailwindcss.com/docs/upgrade-guide
- Svelte MCP and autofixer: https://svelte.dev/docs/mcp/tools
- Cloudflare "start new projects with Workers": https://developers.cloudflare.com/pages/
- Vite static deploy workflow: https://vite.dev/guide/static-deploy
- Chrome storage partitioning: https://privacysandbox.google.com/cookies/storage-partitioning
- Safari 7-day storage deletion: https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
- Chrome timer throttling: https://developer.chrome.com/blog/timer-throttling-in-chrome-88
- PEGI 18 for simulated gambling: https://pegi.info/what-do-the-labels-mean
- CrazyGames docs (Basic Launch, SDK, requirements): https://docs.crazygames.com/
- Steam onboarding (21-day wait, coming-soon page): https://partner.steamgames.com/doc/gettingstarted/onboarding
- OpenAI image pricing and models: https://developers.openai.com/api/docs/pricing
- Gemini image pricing: https://ai.google.dev/gemini-api/docs/pricing
- Antimatter Dimensions storage code (MIT): https://github.com/IvarK/AntimatterDimensionsSourceCode/tree/master/src/core/storage
- Progress Knight (Unlicense): https://github.com/ihtasham42/progress-knight
- Anthony Pecorella, The Math of Idle Games: https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i
- Example agent-built idle repo with purity test and balance sim: https://github.com/Ryngmarks/Idle-RPG-
- Claude Code best practices (CLAUDE.md size, rules, verification): https://docs.anthropic.com/en/docs/claude-code/best-practices
