# Roadmap

Milestones from PLAN.md section 5. Each milestone ends mergeable with tests green, one feature per branch and pull request, fresh Claude Code session per slice started from its plan file in `docs/plans/active/`.

Time box: M0 to M2 in two weekends, playable URL by day 14, M3 to M5 in weeks 3 to 6, M6 in weeks 7 to 8, go or no-go on parking-lot items after the first outside playtest.

| Milestone | Status | Build | Done when | Asger's part |
|---|---|---|---|---|
| M0 Scaffold and guards | complete locally 2026-10-25 (review fixes applied the same day); awaits the first commit, repo creation and the first Pages deploy, plan in `docs/plans/active/m0-scaffold.md` until then | pnpm, Vite, TypeScript strict, Vitest, Tailwind 4, shadcn, purity and layering tests, zod content schema, `num.ts` wrapper, CLAUDE.md, ARCHITECTURE.md, GDD skeleton, empty BALANCE_LOG.md, GitHub Actions deploying to Pages, PWA manifest | `pnpm check` runs typecheck, tests and content validation. An empty page deploys to a public URL | Pick the fantasy and working title (trademark search first), fill GDD sections 1 to 3 including the magnitude table |
| M1 Headless core | not started | One die, one currency, roll command, `advance`, seeded RNG, save and load with `SAVE_VERSION` 1, sim CLI with one bot and two pacing assertions. No UI | `pnpm sim --hours 1` prints time to second die. Balance test passes | Set the first two pacing targets |
| M2 Thin UI | not started | Roll button, auto-roll, number display, autosave, offline modal, export and import, multi-tab guard, mobile viewport (`100dvh`, `touch-action: manipulation`, 44 px targets, hold-to-repeat buy, safe-area insets), reduced-motion switch, dark and light tokens, Playwright reload test | Play 60 s on your phone, reload, progress survives. Install as PWA on iPhone | Playtest minutes 0 to 5 on phone and laptop |
| M3 Content | not started | Five dice, levelling, ascension, upgrades table, unlock conditions, achievements, sim to 8 h | Sim shows no dead content and no income trough over 10 min in the first 8 h | Tune content tables, approve BALANCE_LOG entry |
| M4 Combos and faces | not started | Poker-hand combos with an odds panel, face editing with its own table, the three-choice draft | Sim shows which die and which face dominates. Owner can reach first draft in 10 to 20 min | Decide combo defaults from the odds panel |
| M5 Prestige | not started | One reset layer, "what resets, what stays" dialog, cycle-length assertions | First prestige worthwhile between 30 and 60 min active, cycles shorten | Approve reset rules |
| M6 Polish and release | not started | Style bible, icon pass, illustrative art, SFX, music decision, settings, hotkeys, credits screen, itch.io page with AI disclosure, UI-similarity review against Idle Dice | Public itch page, outside playtest with three people | Art direction, write the itch page |

Working rhythm (PLAN.md section 5): the owner spends 15 to 45 minutes a day editing GDD targets or content tables, picking the next slice, approving the plan, reading the pull request with its sim table and screenshot, playtesting the affected minutes, merging. Weekly, one cleanup session hunting dead code, duplicate systems and doc drift.

Update this table when a milestone starts or ends, with the date.
