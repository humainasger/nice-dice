# Look and feel toolkit (src/ui/fx, src/app/audio.ts, src/index.css)

Everything a screen builder needs to make Nice Dice look and sound like the brief ("a warm, tactile
table at night") without reading the code. Three layers:

1. `src/index.css`: palette tokens, utilities, keyframes and the reduce-motion collapse.
2. `src/ui/fx`: React pieces that wear those keyframes. Import from `@/ui/fx`.
3. `src/app/audio.ts`: `play(name)` for the eight sounds. Import from `@/app/audio`.

## Palette (Tailwind utilities)

The shadcn variables carry the palette, so existing `bg-card`, `text-muted-foreground`, `ring-ring/50`
and the shadcn components already look right. New game tokens, each defined for light and dark:

| Utility stem | Use |
|---|---|
| `primary` / `primary-foreground` | Amber #f2b134 with ink text: the Roll button, primary actions |
| `secondary` / `secondary-foreground` | Cool #7ad3ff with ink text: charm and luck fills |
| `die`, `die-pip`, `die-edge`, `die-raised` | Ivory die body, ink pips, soft edge stroke, amber for a raised face |
| `amber`, `amber-text` | Amber fill; `amber-text` is the same hue darkened for text on ivory (dark theme: pure amber) |
| `cool`, `cool-text` | Cool fill; `cool-text` reads on ivory |
| `gold` | Particle and five-of-a-kind gold |
| `rarity-common`, `rarity-rare`, `rarity-epic` | Charm rarity text and borders |
| `rank-low`, `rank-mid`, `rank-high`, `rank-top` | Hand rank colours (pair, three of a kind, full house, five of a kind) |

Examples: `bg-die fill-die stroke-die-edge fill-die-pip`, `text-amber-text`, `border-rarity-epic/40`,
`bg-cool/15 text-cool-text`.

Cards: `rounded-xl` is 16 px (`--radius` is 0.7rem). Buttons stay `rounded-lg` (11 px).

Dice: `DieFace.tsx` still paints the die with `fill-primary` and pips with `fill-primary-foreground`,
which is now amber on ink. Switch it to `fill-die stroke-die-edge` and `fill-die-pip` for the ivory
die from the brief, and use `fill-die-raised` for a raised face's highlight.

Points: `text-amber-text` on the points number, light and dark.

## Utilities

| Class | What it does |
|---|---|
| `tabular` | Tabular numerals (`font-variant-numeric` plus `tnum`). Use on every number that changes. |
| `text-points` | The big points number: `clamp(2.5rem, 8vw, 4rem)`, weight 600, tight tracking, tabular |
| `shadow-soft` | The card shadow for both themes |
| `glow-amber`, `glow-cool` | A 1 px tinted ring plus a soft halo: the top hand, an ascended die, a draft offer |
| `die-tumble` | 400 ms 3D cube turn. `die-rolling` (the class DieFace wears for `ROLL_PULSE_MS` 300 ms) uses the same keyframes at 300 ms, so the board already tumbles. Bump `ROLL_PULSE_MS` to 400 and swap the class to get the brief's 400 ms. |
| `die-stage` | `perspective: 600px` for a parent that wants more depth on the tumble (optional; the keyframes carry their own perspective) |
| `float-up` | 900 ms rise of 40 px and fade, `forwards`. Used by the floating numbers. |
| `slam-in` | 250 ms scale 1.4 to 1 with overshoot. Used by the combo callout. |
| `combo-out` | 250 ms opacity fade, the callout's exit |
| `particle` + `particle-gold`, `particle-cool` (and `-alt`, `-ivory`, `particle-square`) | One burst particle, driven by `--dx --dy --size --delay --rot --end-scale` |
| `shake` | 200 ms 4 px shake |

Keyframes: `die-tumble` 400 ms, `float-up` 900 ms, `slam-in` 250 ms, `burst` 700 ms, `shake` 200 ms.
All transforms and opacity. Under `.reduce-motion` on `<html>` (the settings switch, `src/app/theme.ts`)
and `prefers-reduced-motion: reduce`, every animation and transition collapses to one frame, and the
fx components below do not spawn particles or floating numbers at all.

## Components and hooks (`@/ui/fx`)

Every piece fires on a change of a counter prop and never on its first value, so mounting after a
load is quiet. The roll count (`selectRolls`) is the natural counter for anything per roll.

### `<Particles trigger kind? count? className? />`

CSS-only burst of 16 to 24 spans from the centre of the parent. The parent needs `relative`.

- `trigger: number`: a counter, every change fires one burst
- `kind: 'gold' | 'cool'`: gold for hands and ascension, cool for charms and luck (default gold)
- `count`: 16 to 24, default 20
- `PARTICLE_MS` (800): how long a burst stays mounted

```tsx
<div className="relative">
  <DiceBoard />
  <Particles trigger={bigHandCount} kind="gold" />
</div>
```

Fire it on four or five of a kind and on ascension (keep your own counter: increment a state when
`bestHand` is `four_of_a_kind` or better for a new roll, so a pair does not burst).

### `useFloatingNumbers()` and `<FloatingNumber />`

`const { spawn, portal } = useFloatingNumbers()`

- `spawn(text, element, tone?)`: shows `text` rising from the top centre of `element` (any DOM
  element, usually `ref.current`). `tone` is `'amber'` (default), `'cool'` or `'plain'`. Empty text,
  a missing element or reduced motion: nothing happens. At most 12 floaters are alive at once.
- `portal`: a React node, render it once in the component (`{portal}`); it is a portal to
  `document.body`, so where it sits in the tree does not matter.
- `FLOAT_MS` (900) matches the keyframes.

```tsx
const diceRef = useRef<HTMLDivElement>(null)
const { spawn, portal } = useFloatingNumbers()
const rolls = useGameStore(selectRolls)
const gained = useGameStore(selectLastGainedText)
useEffect(() => { if (rolls > 0) spawn(`+${gained}`, diceRef.current) }, [rolls]) // eslint note: gained is read with rolls on purpose
return <div ref={diceRef} className="relative">...{portal}</div>
```

For one source, the declarative form does the bookkeeping:

```tsx
<FloatingNumber text={`+${gained}`} anchor={diceRef} trigger={rolls} />
```

`text`, `anchor: RefObject<Element | null>`, optional `trigger` (counter; without it a change of
`text` fires), optional `tone`.

### `<ComboCallout text rank visibleKey detail? faces? members? className? />`

"FULL HOUSE 9.6x" slams in, holds 900 ms (`CALLOUT_HOLD_MS`), fades 250 ms (`CALLOUT_FADE_MS`) and
unmounts. Absolutely positioned over its parent (make the parent `relative`), `aria-hidden` because
the play card's last-roll row carries the faces and the hand for screen readers.

- `text`: the label; empty never shows
- `rank`: 1 pair, 2 two pair, 3 three of a kind, 4 straight, 5 full house, 6 four of a kind, 7 five
  of a kind. Rank 1 to 2 muted at text-xl (sm: 2xl), 3 to 4 cool at 2xl (sm: 3xl), 5 to 6 amber at
  2xl (sm: 4xl), 7 gold with a glow at 3xl (sm: 5xl). The phone sizes keep "FOUR OF A KIND 13.2x"
  on one line inside a 358 px board.
- `visibleKey`: a counter, every change shows the callout again (the roll count of the roll that
  produced the hand; keep the same key when a roll has no hand, or pass empty text)
- `detail`: optional second line under the hand, the points gained ("+1.2K")
- `faces`, `members`: optional, the rolled sides in content order and the indexes of the dice that
  form the hand (`handMembers` in `src/core`). Given, a `<DiceRow>` of 28 px dice with the members
  ringed in the rank colour sits between the hand and the detail, so a big hand reads as faces plus
  name plus gain in one glance. Pass them from a `useShallow` selector (`selectLastRollFaceList`,
  `selectLastRollMemberList` in `src/app/selectors.ts`)
- `className`: the default centres the callout in its parent; a parent taller than the viewport (five
  die cards stacked on a phone) wants `items-start pt-14` so it sits over the first row of dice

The game wires it in `src/ui/BenchCallout.tsx`, rendered inside the play card's wrapper
(`PlayCard.tsx`) in a zero-height slot at `top-full`, not inside the board: below lg that wrapper is
sticky, so the callout rides with the pinned card and lands over whichever dice are on screen at
any scroll depth; at lg the card is in flow and `lg:pt-32` puts it over the first row's faces.

```tsx
<div className="sticky ... lg:relative">
  <PlayCardBody />
  <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-full h-0">
    <ComboCallout
      text={handText}
      rank={handRank}
      visibleKey={rolls}
      detail={`+${gained}`}
      faces={faces}
      members={members}
      className="items-start pt-14 lg:pt-32"
    />
  </div>
</div>
```

### `<DiceRow faces members? size? tone? rollKey? className? testId? />` (`@/ui/DiceRow`)

Not an fx piece, but the callout's companion: a row of mini `DieFace` tiles in content order, the
`members` indexes ringed (`ring-2`) in `tone`, which is `'muted'` or `'rank-1'` to `'rank-7'` (the
`RANK_RING_CLASS` table in `useRollPulse.ts`). `size` defaults to 28; `rollKey` (the roll count)
makes the faces tumble on a change; `testId` lands on the `<ol>` (the play card passes
`last-roll-faces`).

### `useCountUp(targetText: string): string`

Give it the formatted points string from `selectPointsText`; render what it returns. When the target
changes it counts from the shown value to the new one over 250 ms (`COUNT_UP_MS`) with an ease-out,
keeping the target's decimals and suffix: "12.5K" to "13.1K" passes through "12.8K". When the suffix
changes (999 to 1.00K) or motion is reduced it jumps. Mounts showing the target, no count on load.

```tsx
const points = useCountUp(useGameStore(selectPointsText))
<p data-testid="points" className="text-points text-amber-text">{points}</p>
```

`parseFormatted` and `formatTween` are exported for tests.

### `<ScreenShake trigger className?>children</ScreenShake>`

A div that shakes 4 px for 200 ms (`SHAKE_MS`) when `trigger` changes. Children are never
remounted. Use for five of a kind and prestige; do not shake the whole page on every roll.

### `useReduceMotion()`, `reduceMotionNow()`

`true` when the settings switch or the OS asks for reduced motion. The hook is live; the function
reads once for imperative code.

## Sound (`@/app/audio`)

`play(name, opts?)` with `name` one of `'roll' | 'buy' | 'level' | 'combo' | 'ascend' | 'charm' |
'luck' | 'trophy'` and `opts.rank` (1 to 7) for `combo`, the pitch rises with the rank. Every sound
is under 300 ms, rendered once from hand-tuned jsfxr parameters under a fixed seed, so it is the same
every session.

- Nothing plays before the first user gesture. The module installs a one-time window listener
  (`pointerdown`, `pointerup`, `keydown`, `touchend`) that calls `unlockAudio()`; call
  `unlockAudio()` yourself inside a click handler if you need it earlier, and `installAudioUnlock()`
  if the listeners were removed.
- `play` honours `settings.sound` (store), drops a repeat of the same name inside 50 ms
  (`THROTTLE_MS`), and never throws.
- Call it next to the dispatch that earned it: `send({ type: 'roll' }); play('roll')`,
  `play('buy')` on a successful buy, `play('level')` on a level (one call per click, the throttle
  takes care of Max), `play('combo', { rank })` when the roll had a hand, `play('ascend')`,
  `play('charm')` on pick, `play('luck')` on prestige, `play('trophy')` when `newTrophy` appears.
- `soundDef(name, rank?)` returns the parameters (paste into https://sfxr.me to tune),
  `SOUND_NAMES`, `isAudioUnlocked()`, `resetAudioCache()` for tests and HMR.

### The mute switch

`settings.sound` (default `true`) is in the store next to `theme` and `reduceMotion`, persisted the
same way. `selectSound` is in `src/app/selectors.ts`. In the settings dialog:

```tsx
const sound = useGameStore(selectSound)
<Switch id="sound" data-testid="sound-switch" checked={sound} onCheckedChange={(checked) => setSettings({ sound: checked })} />
```

## Where to wire what (checklist for the screen builders)

- `DieFace`: `fill-die stroke-die-edge` body, `fill-die-pip` pips, `fill-die-raised` on raised faces.
- `PlayCard` (`PointsPanel.tsx`, `RollControls.tsx`, `LastRoll.tsx` hold its pieces): `text-points
  text-amber-text` with `useCountUp`, `play('roll')` in `roll()`, a `DiceRow` for the last roll.
  Keep `points`, `roll-button`, `auto-roll-switch`, `last-roll-faces` and `breakdown-toggle`.
- `PlayCard`: `<BenchCallout>` (the wired `<ComboCallout>`) in the sticky wrapper's `top-full` slot.
- `DiceBoard`: a `relative` wrapper with `<Particles kind="gold">` for four or five of a kind and
  ascension, floating `+N` from the dice on every roll.
- `DieCard`: `play('buy')`, `play('level')`, `play('ascend')`; `<Particles kind="gold">` on ascend.
- Charms and luck panels: `play('charm')`, `play('luck')`, `<Particles kind="cool">`, `glow-cool` on
  the draft offer, `text-rarity-*` for rarity.
- Trophy toast: `play('trophy')` when `newTrophy` is set, `slam-in` on the toast.
- Settings: the sound switch above, next to reduce motion.
