# M6 mobile: low cognitive load on a phone, and the roll shows its dice

Status: in progress 2026-10-26. Branch `m6-mobile`. Owner feedback after playing the live build: the UI must be mobile friendly and low cognitive load, and a roll must show the dice combination, not only the hand name and the gain.

## Principles

One primary action per surface. Details on demand, never by default on a phone. The player should be able to roll, read the result and buy the next level without scrolling or decoding badges. Desktop may show more, phones show less. Keep every existing test id.

## Play card (top of the Bench, sticky on phones under the header)

1. One card replaces the points panel, the roll controls and the bottom "last roll" line: row 1 the points number (text-3xl on phones, text-points on sm and up) with "948K per roll" muted to its right; row 2 a full-width Roll button (56 px tall on phones) with the auto-roll switch and its thin progress bar beside it; row 3 the last roll: the rolled dice as a row of mini faces (new `DiceRow` component, 28 px dice, content order, the dice that form the hand ringed in the hand's colour), then the hand name and multiplier ("FULL HOUSE 7x", muted "no hand" when none) and the gain "+12.3K". Before the first roll the row says "Roll to begin".
2. The multiplier chips collapse to one line: "x271K total" plus a small "details" toggle; expanded by default at lg and up, collapsed on phones; expanding shows the five factor chips. Drop the "Every die is on the bench" sentence.
3. The combo callout keeps slamming in over the bench; its detail line adds the mini faces too, so a big hand reads as faces plus name plus gain in one glance.

## Bench

4. Die cards get a compact mode (default below lg) and a full mode (default at lg and up, and on tap below lg): compact is one row, 72 px tall: face 48 px on the left, then name on one line and "Lv 34 · x7.48K per pip" under it with tiny icon badges for refined count and mastery (lucide icons with the number, tooltips on desktop), then one primary button on the right: "+1 · 54.8K" (or "Buy · 100" for the next die, "Refine" at the cap, "Max" when 10 or more levels are affordable and the player has not pressed +1 in the last few seconds is too clever; keep "+1" primary and show "Max (46)" as the secondary text under it). A chevron expands the card in place to the full layout: the face strip with the raise-lowest-face button, +10 and Max with prices, Master with its luck price, Refine. The level progress bar stays as a 2 px line under the compact row.
5. The bench header loses its two switches. One "Automation" button (sliders icon) opens a sheet (shadcn Dialog) with three rows and one-line explanations: Auto-roll (the same setting as the play card switch; only the play card holds the `auto-roll-switch` test id), Auto-level (needs Steady Hands), Auto-refine at level 100. Test ids `auto-level-switch` and `auto-ascend-switch` live only in this sheet; remove the duplicates from the settings dialog and the dice board.
6. Grid: one column of compact cards on phones, two at sm, three at lg with full cards.

## Everything else

7. Phone type sizes: nothing below 14 px except badges at 12 px; tap targets stay 44 px. The sticky play card must not cover the combo callout or the first die card; test with the callout firing.
8. Hands, Charms, Luck and Marks tabs: check each at 390 px for anything that needs horizontal scroll or wraps badly; fix in place, no redesign.

## Done when

`pnpm check` and `pnpm test:e2e` green; at 390 x 844 the bench shows the play card, the last roll with faces, and at least two compact die cards without scrolling; a tap expands a card; the automation sheet opens; the desktop layout still shows full cards in three columns.
