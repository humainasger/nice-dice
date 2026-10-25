---
paths:
  - "src/**/*.css"
  - "src/**/*.tsx"
---

# Tailwind v4

This project uses Tailwind CSS 4 through `@tailwindcss/vite`. v4 is a rewrite; training data skews to v3. Facts that matter here, from PLAN.md section 2 and the upgrade guide:

- The stylesheet starts with `@import "tailwindcss"`. There are no `@tailwind base`, `@tailwind components` or `@tailwind utilities` directives. A guard test fails on any `@tailwind ` in `src`.
- There is no `tailwind.config.js` or `tailwind.config.ts` and no `postcss.config.*`. Configuration lives in CSS: `@theme`, `@custom-variant`, `@layer`, `@utility`. A guard test fails if a config file appears in the root.
- Renamed utilities: `shadow-sm` is now `shadow-xs`, `shadow` is now `shadow-sm`, `rounded-sm` is now `rounded-xs`, `outline-none` is now `outline-hidden`, `ring` is now `ring-3`.
- Removed utilities: `bg-opacity-*`, `text-opacity-*`, `flex-shrink-*`, `flex-grow-*`. Use the slash opacity modifier (`bg-primary/50`) and `shrink-*`, `grow-*`.
- Dark mode is the `.dark` class via `@custom-variant dark (&:is(.dark *))` in `src/index.css`.
- Use the shadcn CSS variables already defined in `src/index.css`: `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--chart-1` to `--chart-5`, `--radius`, and the `--sidebar-*` set, each with a `-foreground` partner where relevant. They are exposed as utilities (`bg-background`, `text-muted-foreground`, `border-border`, `ring-ring/50`). Do not add raw hex colours in components; add a variable to `:root` and `.dark` in `src/index.css` and map it in `@theme inline`.
- Game-specific tokens (dice faces, rarity colours, bar colours) go in `src/index.css` next to the shadcn set, in both `:root` and `.dark`.
- shadcn components are generated with the `radix-nova` preset. The generated files import `cn` from the `cn` package; hand-written code imports it from `@/lib/utils`, which re-exports it. Regenerate rather than hand-edit when possible.
- Mobile rules from PLAN.md M2: `min-h-dvh` (not `100vh`), `touch-action: manipulation`, 44 px tap targets, safe-area insets, `prefers-reduced-motion` switch.
