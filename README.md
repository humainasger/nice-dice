# Nice Dice

Nice Dice is a browser dice incremental in the spirit of Idle Dice: roll, level and ascend dice, chase poker-hand combos, edit die faces. Built mostly by Claude Code, see `PLAN.md` for the reasoning.

Stack: TypeScript 7 strict, Vite 8, React 19, Zustand 5, Tailwind 4, shadcn/ui, break_infinity.js, Vitest, pnpm. Deployed to GitHub Pages as a PWA.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server with HMR |
| `pnpm check` | Typecheck, lint and tests, the same gate CI runs before deploying |
| `pnpm test` | Vitest once, `pnpm test:watch` keeps it running |
| `pnpm validate:content` | Content table validation only |
| `pnpm build` | Production build into `dist/` |
| `pnpm preview` | Serve the production build locally |

## Where things live

- `PLAN.md`: stack decisions, architecture rules and the milestone plan.
- `docs/GDD.md`: game design document, every number maps to a field in `src/content`.
- `ARCHITECTURE.md` and `CLAUDE.md`: layer rules, enforced by the tests in `tests/arch`.
- `src/core` pure simulation, `src/content` tunable tables, `src/app` browser shell, `src/ui` rendering.

## Licence and credits

- Licence: TBD.
- Credits: lucide (ISC) for interface icons, game-icons.net (CC BY 3.0) and Kenney (CC0) for flavour icons and audio. Attribution lines are added here as assets land.
