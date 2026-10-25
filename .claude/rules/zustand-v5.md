---
paths:
  - "src/app/**"
  - "src/ui/**"
---

# Zustand v5

Zustand 5 differs from the v4 code in training data. Facts from PLAN.md sections 2 and 4, enforced by a selector guard test in `tests/arch`:

- `create()` no longer takes an equality function. For shallow comparison use `useShallow` from `zustand/react/shallow`, or build the store with `createWithEqualityFn` from `zustand/traditional`.
- A selector that returns a fresh object or array on every call throws "Maximum update depth exceeded", because v5 uses strict equality and sees a new reference each render. `useGameStore(s => ({ a: s.a, b: s.b }))` is forbidden unless wrapped in `useShallow(...)`.
- Never call `useGameStore()` with no selector and never `useGameStore(s => s)`. Either subscribes the component to every tick.
- Select primitives or formatted strings. A fresh Decimal is a new reference every tick and re-renders everything that selected it.
- Keep Decimals in the vanilla store (`createStore` from `zustand/vanilla`) owned by `src/app`. Mirror formatted strings and primitives into the React-facing store at a few Hz, not per tick.
- The `persist` middleware serialises Decimals wrongly (`Infinity` becomes `null`, class instances become plain objects). Do not use it for game state. Saving goes through the app save layer (`src/core/save.ts` for shape and migrations, `src/app` storage for IndexedDB). If a UI-only preference needs `persist`, give it a custom storage that never touches game state.
- `src/app` owns the store and the loop. `src/ui` imports the store hook and calls `dispatch`; it never imports from `src/app` internals beyond the exported hook and actions.
