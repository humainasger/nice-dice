# Decisions

Architecture decision records. One entry per decision, newest at the bottom. Status is accepted, superseded or reversed. When a decision changes, add a new entry and point the old one at it rather than editing history. D1 to D8 are the short form of PLAN.md section 1, which holds the full reasoning and sources.

## D1 UI stack

Date: 2026-10-25. Status: accepted.
Decision: TypeScript 7 strict, Vite 8, React 19, Zustand 5, Tailwind 4, shadcn/ui.
Why: largest training corpus, hooks API stable since 2019, plain TSX works on TypeScript 7 while Svelte and Vue need a TypeScript 6 side-install, shadcn gives accessible dialogs agents otherwise hand-roll badly.
Would flip it: valuing a mechanical autofix loop over corpus size; Svelte 5 with its MCP server and autofixer is a near-peer.

## D2 Rendering

Date: 2026-10-25. Status: accepted.
Decision: DOM, CSS 3D transforms and the Web Animations API. No Phaser, no PixiJS in v1.
Why: a dozen dice is not a canvas problem; canvas text and no CSS theming are exactly the complaints Idle Dice's Phaser build gets.
Would flip it: PixiJS 8 inside one React component later for particles only.

## D3 Numbers

Date: 2026-10-25. Status: accepted.
Decision: break_infinity.js Decimal for every game value from the first formula, behind the one-file wrapper `src/core/num.ts`.
Why: Idle Dice's curves pass 1e308 within hours of late game; agents write `a * b` everywhere, so "swap later" means rewriting the sim. Four of seven researchers said start with plain numbers; the stack critic refuted it against the live bundle.
Would flip it: a design that provably caps magnitude (GDD section 3 magnitude table).

## D4 Game core

Date: 2026-10-25. Status: accepted.
Decision: pure TypeScript module with `advance(state, dt, rng)` and `dispatch(command)`, zero React, DOM, `Date.now` or `Math.random`, enforced by a test.
Why: lets the agent prove balance headlessly instead of by clicking. The single biggest lever for staying in control.
Would flip it: nothing.

## D5 Theme

Date: 2026-10-25. Status: accepted.
Decision: not casino. Dice are the mechanic; the fantasy is the owner's to pick (workshop, tavern, alchemy, expedition).
Why: PEGI rates simulated gambling 18+, CrazyGames requires PEGI 12, the casino layer is where Idle Dice players report grind, and it is the most recognisable part of Idle Dice's protected expression.
Would flip it: nothing.

## D6 v1 scope

Date: 2026-10-25. Status: accepted.
Decision: roll loop, dice levelling and ascension, poker-hand combos, one draft-on-a-progress-bar layer, one prestige layer, one differentiator (die-face editing), zero minigames.
Why: each extra system is its own balance surface; without a written cut the agent starts everything.
Would flip it: the first outside playtest after v1 decides what leaves the parking lot.

## D7 Hosting

Date: 2026-10-25. Status: accepted.
Decision: GitHub Pages first via Vite's Actions workflow, then Cloudflare Workers Static Assets once there is a domain or ads.
Why: Cloudflare tells new projects to use Workers, not Pages; Vercel Hobby is non-commercial; GitHub Pages' terms bar running a business.
Would flip it: nothing.

## D8 Assets

Date: 2026-10-25. Status: accepted.
Decision: hand-coded SVG dice, panels and buttons; game-icons.net and Kenney for icons and audio; AI generation only for illustrative art and a few bespoke sounds.
Why: crisp at any DPI, themeable by CSS variables, kilobytes, unambiguously the owner's copyright. Total AI spend under 60 USD.
Would flip it: a bespoke icon look later via Recraft with a locked custom style.

## D9 TypeScript 7.0.2

Date: 2026-10-25. Status: accepted.
Decision: TypeScript 7.0.2 adopted although the Vite template ships 6.0. `tsc -b` verified on the scaffold. `baseUrl` removed from tsconfig because TS 7 rejects it; the `@/*` alias uses `paths` alone.
Why: TS 7 is the Go-native compiler with strict defaults; plain TSX needs no side-install. `verbatimModuleSyntax` and `erasableSyntaxOnly` follow, so `import type`, no enums, no parameter properties.
Would flip it: a dependency whose types break under TS 7 with no workaround.

## D10 UI kit

Date: 2026-10-25. Status: accepted.
Decision: shadcn radix-nova preset, Geist self-hosted via `@fontsource-variable/geist` (OFL), lucide icons.
Why: focus-trapped dialogs for free; self-hosting avoids the Google Fonts CDN (LG München I 2022 ruling); lucide has a `dices` icon and is ISC.
Would flip it: a bespoke display font for the title only, still self-hosted and OFL.

## D11 PWA update strategy

Date: 2026-10-25. Status: accepted.
Decision: vite-plugin-pwa with `registerType: 'prompt'`. The update prompt UI is deferred to M2; until then registration is auto-injected and a new service worker waits.
Why: `autoUpdate` would reload the page under the player and could lose unsaved progress. The prompt UI needs the save layer to save before reload, which lands in M2.
Would flip it: nothing; the prompt UI is a scheduled task, not a question.

## D12 GitHub Pages base path

Date: 2026-10-25. Status: accepted.
Decision: `vite.config.ts` reads `base` from the `VITE_BASE` environment variable, defaulting to `/`. The deploy workflow sets it to `/<repo>/`, so the repository can be named later without a code change.
Why: the working title is undecided (GDD Q1); hard-coding the repo name would force a rename commit.
Would flip it: moving to Cloudflare Workers with an own domain, where base returns to `/`.

## D13 GitHub Actions pinned to current majors

Date: 2026-10-25. Status: accepted.
Decision: GitHub Actions pinned to current majors because Node 20 runners were removed 2026-09-23; revisit when Vite's static-deploy guide changes. The pins are `actions/checkout@v7`, `actions/setup-node@v7`, `actions/configure-pages@v6`, `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5` and `pnpm/action-setup@v6`, each the major of the release that `gh api repos/<owner>/<repo>/releases/latest` returned on 2026-10-25.
Why: the Vite guide's workflow still shows the Node 20 majors (`checkout@v4`, `setup-node@v4`, `configure-pages@v5`, `upload-pages-artifact@v3`, `deploy-pages@v4`), which fail on a runner without the Node 20 runtime. Major tags move with patch releases, so the workflow keeps working without a commit per release.
Would flip it: GitHub removing the Node 24 runtime in turn, or a policy change to pin full commit SHAs for supply-chain reasons.

## D14 Num results are normalised in the wrapper

Date: 2026-10-25. Status: accepted.
Decision: Num results are normalised in the wrapper because break_infinity's add can return a mantissa just below 1, which broke exact save round trips. Every helper in `src/core/num.ts` that returns a Decimal passes it through one normalise step before handing it back, so `N.serialize` always writes a mantissa in `[1, 10)`.
Why: `N.serialize` writes `<mantissa>e<exponent>` and `N.parse` reads it strictly. A result such as `0.9999999999999999e4` serialises and parses to a Decimal that is not `eq` to the original, so the property test for exact round trips failed on values produced by `add`. Normalising once in the wrapper keeps the fix in the one file that imports `break_infinity.js` (D3).
Would flip it: a break_infinity.js release that normalises its own results, which would make the step redundant but harmless.

## D15 Name check for "Nice Dice" (2026-10-25), decided: keep as working title

Status: decided 2026-10-25, option (a). Asger keeps "Nice Dice" as a working title that is used but not owned: no trademark filing, nothing physical under the name, a qualifier in store listings, and a trademark attorney opinion before any ad-supported distribution. Repo humainasger/nice-dice.

Facts, checked 2026-10-25:

- NICE DICE is a live registered word mark owned by James H. Koplow d/b/a Koplow Games, a US dice manufacturer: USPTO Reg. 1219277 (class 28, "Dice", filed 1982, third renewal 2023-06-08) and EUTM 000899419 (class 28, "Games", registered 2000, runs to 2028-07-29, covers Denmark). No NICE DICE mark exists in classes 9 or 41, at WIPO, or as a Danish national mark. A browser game sits in classes 9 and 41, so there is no direct class clash, but "Games" in class 28 against a dice game is a similarity an EU opponent can argue. We could not register the name ourselves, and merchandise or physical dice under it would be a direct clash.
- Name collisions in games: "Nice Dice: Game of Throws" (Steam, Fishtank Games, paid, planned 2027), "Nice Dice 3D" (Google Play, 100K+ installs, rating 2.6, and App Store), "Nice Dice Roller 3D" (top App Store result), six Google Play apps and about ten itch.io jam games with the name, a live real-money casino game "Nice Dice" by Roxor Gaming, YouTube @NiceDice (Russian board-game channel, 23K subscribers). No "Nice Dice" on CrazyGames, Poki or Kongregate, and no incremental or idle game uses it.
- Handles and domains: GitHub users nicedice and nice-dice taken, nicedice.itch.io taken, nicedice.com (dormant since 2001), nicedice.io (for sale, USD 999) and nicedice.app (parked) taken. Free: repo humainasger/nice-dice, CrazyGames slug nice-dice, nice-dice.com, playnicedice.com, nicedice.game, nicedice.games, nicedice.dk, nice-dice.dk.

Options:

- (a) Keep "Nice Dice" as a working title that can be used but never owned: do not file it, sell nothing physical under it, always pair it with a qualifier in listings (the bare phrase will not rank), and get a one-hour opinion from a Danish trademark attorney before any ad-supported distribution.
- (b) Rename now, before the repo slug, handles and any art exist. A coined word or "Nice Dice" plus a dominant second element would clear class 9/41 and could be filed in Denmark or the EU for a few hundred euros.

Sources: USPTO TSDR serial 73351375; EUIPO TMview EUTM 000899419; WIPO Global Brand Database; https://store.steampowered.com/app/3952370/; https://play.google.com/store/apps/details?id=com.mindolin.nicedice; https://wizardofodds.com/games/nice-dice/; RDAP and Punktum dk whois for the domains.
