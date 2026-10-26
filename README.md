# Nice Dice

Nice Dice is a browser idle game about a dicewright: carve dice from pine to obsidian, roll them on the bench for points, refine them, chase poker hands and press your luck. In the spirit of Idle Dice, with die-face editing as the twist and a lamp-lit workshop instead of a casino. Built mostly by Claude Code, see `PLAN.md` for the reasoning.

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
- Credits: lucide (ISC) for interface icons, Geist and Fraunces (OFL, self-hosted through Fontsource) for type, jsfxr for the procedural sounds. The dice, panels and the title scene are hand-coded SVG. game-icons.net (CC BY 3.0) and Kenney (CC0) stay the planned sources for any flavour icons or audio that land later; attribution lines are added here as assets land.
