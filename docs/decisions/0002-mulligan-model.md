# 0002. Mulligan model

STE-style, relaxed level. No STE dictionary was checked.

**Status:** decided (owner, 2026-11-15)

## Question

The London mulligan lets the player choose which cards go to the bottom. The odds depend on when the player
keeps a hand. Which keep rule does the calculator use, and what does the by-turn table show?

## Options

1. Keep if the goal is met. The owner sets one goal for the opening hand.
2. A keep rule for the opening hand, and a different goal for a later turn.
3. One card group only, with the odds for 7, 6, 5 and 4 cards.

## Decision

The calculator uses option 1, with several card groups.

- A goal gives a least count and a most count for each group. An empty most count is no limit.
- After `m` mulligans, the player keeps `7 - max(0, m - free)` cards from a new draw of 7 cards.
- A draw meets the goal if a kept hand of that size exists with each group between its least and most count.
- The player keeps the first draw that meets the goal. If no draw meets it, the player keeps the last draw.
- The by-turn table shows two lines: one with mulligans and one with no mulligan.
- A by-turn value is the chance that the hand and the draws hold at least the least count of each group.
  The most counts apply to the opening hand only.

## Reasons

- Option 1 has few inputs, and each number has an exact answer.
- Option 2 is more flexible, but it has more inputs and more maths to check. The owner did not choose it.
- The line with no mulligan shows what the mulligans gain.

## Facts about the maths

- The closed test for "a kept hand exists" is: each count is at least its least count, the least counts fit
  in the kept size, and `sum of min(count, most) + other` is at least the kept size.
- The closed test is exact only if least ≤ most for each group. A counter-example without that condition:
  least 1, most 0, a draw with 1 copy and 6 other cards, kept size 1. The page refuses most < least.
- If the least counts add up to more than the smallest hand size, a mulligan to that size cannot work. The
  calculator stops at the larger size and shows a note. This is the clamp.
- Because of the clamp, the useful cards of a forced keep always fit in the hand. Thus the shortfall of a
  forced keep is `max(0, least - count)` for each group, and no bottom-order rule is necessary.
- Without the clamp, a fixed bottom order is not the best play. Example: 24 lands (least 3) and 4 pieces
  (least 1), keep 3 cards from 3 lands and 1 piece. Lands first gave 16.3% after 3 draws. To keep the piece
  gave 78.8%. (These two numbers came from a prototype.)
- The draws after the keep come from the `N - 7` cards that the player did not see. The table stops where
  the draws exceed `N - 7`, because the bottom cards return after that.
- The line with no mulligan at 0 draws is not the same number as the opening-hand chance, because it ignores
  the most counts. For 24 lands of 60 with 2 to 4 lands, the values are about 86% and 78%.
- With the clamp, the line with mulligans is never below the line with no mulligan. The last allowed draw is
  a new hand of 7 cards, and the clamp lets the kept cards hold each useful card. Thus the last draw is a
  "yes" exactly when its 7 cards and the later draws hold each least count. That is the no-mulligan event.
- This gives `with = 1 - pReachLast * (1 - noMulligan)`, where `pReachLast` is the chance to get to the
  last allowed draw. The engine uses this identity, and the brute-force oracle confirms it.
- Without the clamp, the line with mulligans can be lower. A 12-card deck with least 3 and least 2, and a
  mulligan to 4 cards, gave 0.9938 against 1.0000 at 3 draws.
- The simulation restates the kept-size rule and the clamp in its own code, and it tries each choice of kept
  cards. It shares no maths with the exact engine. On the default deck, 100,000 trials agreed with all 24
  exact numbers (headless Chrome, seed 1, 2026-11-15).
- The simulation verdict uses 4 standard errors. With 3, about 12% of inputs showed a false alarm across
  the roughly 49 numbers on the page (estimate from the design review).
- Unverified: the current rules text for a free first mulligan in multiplayer. The page lets the owner set
  the number of free mulligans, so the maths does not depend on it.

## Limits of the model

A real keep depends on more than counts: the matchup, the mana curve and the exact cards. The numbers are
exact for this keep rule only. The page says this in plain words.

## Revisit if

- The owner wants a different goal for a later turn (option 2).
- The owner wants "this card or that card" goals, or groups that overlap.
- The exact engine and the simulation disagree on an input.
