# Specification: mtg-hypergeo

STE-style, strict level. No STE dictionary was checked.

## Purpose

The page calculates the chance to get an opening hand that meets a goal in Magic: The Gathering.
The page uses the London mulligan.
The page also shows the chance to meet the least counts of the goal by each turn.
The page is one HTML file. The file works from a disk and from GitHub Pages.

## Users and success measures

The user is a Magic: The Gathering player who builds a deck.
The user knows the deck size and the number of copies of each card group.

- The page gives an exact result for the keep rule in `docs/decisions/0002-mulligan-model.md`.
- The page gives a second check on the exact result with a simulation.
- The user can send the inputs to a different person with one link.

## Terms

- **Group**: a set of cards that the goal counts. Groups do not overlap.
- **Least count**: the smallest number of cards of a group that the goal accepts.
- **Most count**: the largest number of cards of a group that the goal accepts. An empty most count has no limit.
- **Other cards**: the cards of the deck that are in no group.
- **Smallest hand**: the smallest hand size that the user keeps after mulligans.

## Requirements

### Inputs

- **R1** The deck size is a whole number from 7 to 1,000.
  Accepted when: the validation refuses 6 and 1,001, and accepts 60 and 1,000.
- **R2** The user can set 0 to 6 groups. Each group has a name, a number of copies, a least count and a most count.
  Accepted when: the validation refuses 7 groups, a most count below its least count, and copies that add up to more than the deck size.
- **R3** The user sets the smallest hand (0 to 7), free mulligans (0 to 7), on the play or on the draw, and the turns to show (1 to 20).
  The user also sets the seed (0 to 4,294,967,295) and the number of trials (1 to 1,000,000) for the simulation.
  Accepted when: the validation refuses each value outside its range, each value that is not a whole number, and each value that is not a number.
- **R4** If an input has an error, the page shows the error next to that input. The page then shows no result.
  Accepted when: the view model gives the error under the name of the input and gives no result.
- **R5** If a least count is more than the copies of its group, the page shows a warning next to that least count.
  If the least counts add up to more than the smallest hand, the page shows a warning next to the smallest hand.
  If the least counts add up to more than 7, the page shows a warning next to the groups.
  The page shows the result with each of these warnings.
  Accepted when: the validation gives each warning on its input and also gives the inputs.

### Exact results

- **R6** The page calculates the chance that a draw of 7 cards meets the goal, with the multivariate hypergeometric distribution.
  Accepted when: 4 copies in a 60-card deck, with a least count of 1, give 39.95% at 7 cards.
- **R7** The page shows one row for each mulligan. Each row shows the number of mulligans, the hand size, the chance that the draw works, the chance to keep at that row, and the total so far.
  The page also shows the chance that no draw works.
  Accepted when: the keep chances and the chance that no draw works add up to 1 within 1e-12, and exactly as fractions.
- **R8** If the least counts add up to more than the smallest hand, the page stops the mulligans at the sum of the least counts.
  The page then shows a note with the two sizes.
  Accepted when: least counts of 3 and 2 with a smallest hand of 2 give hand sizes 7, 6 and 5, and the note names 5 and 2.
- **R9** The page shows two lines by turn: one with mulligans and one with no mulligan.
  On the play, turn t has t - 1 draws. On the draw, turn t has t draws.
  The last turn is the last turn with at most deck size - 7 draws.
  The by-turn lines use the least counts only.
  Accepted when: a 9-card deck on the play gives 0, 1 and 2 draws, and on the draw gives 1 and 2 draws.
- **R10** The exact results agree with a brute-force count of card subsets on small decks.
  Accepted when: the opening chances, the mulligan chain and the two by-turn lines agree within 1e-12 on 9 decks of 10 to 12 cards.

### Simulation check

- **R11** When the user starts the simulation, the page shuffles and draws real decks. The simulation shares no maths with the exact engine.
  The page shows each exact number, its simulated number, the standard error and a verdict.
  The verdict is "Agrees" if the simulated number is inside 4 standard errors of the exact number.
  If the exact number is 0 or 1, the verdict is "Agrees" only for an equal simulated number.
  The same seed gives the same result for each split of the trials into parts.
  Accepted when: a run of 40,000 trials agrees on each number for 3 decks, and runs in parts of 5,000, 777 and 1 trials give equal results.

### Output

- **R12** The page shows each chance as a percent with two decimals.
  A chance above 0 that rounds to 0.00% shows as "<0.01%". A chance below 1 that rounds to 100.00% shows as ">99.99%".
  Accepted when: 0.39950952 shows as "39.95%", 0.000001 as "<0.01%" and 0.999999 as ">99.99%".
- **R13** The page shows a chart with the two by-turn lines from 0% to 100%.
  The two lines have different dashes and different markers. A legend names the two lines.
  Under that chart, the page shows a second chart with the average copies of each group by turn (R21).
  The second chart uses the same turn axis and one scale in cards, from 0 to a round maximum.
  Each group line has a different colour, dash and marker. A legend names each group as text.
  If 2 to 4 groups show on a wide chart and the line ends do not touch, the page also writes the names at the line ends.
  Each chart has a text description.
  Accepted when: the chart geometry tests pass for one group, six groups, a group with 0 copies and one turn.
  The description of each chart names each line with its first and last values.
- **R14** Under the by-turn chart and table, the page shows the part "How to read these numbers".
  The part has these sections, in this order: "The question", "How the turns work", "The two lines", "What the numbers leave out" and "In short".
  "The two lines" also gives the current chance that no hand works.
  "What the numbers leave out" names the most counts, the hand size, the cards on the bottom and late turns in a small deck.
  The page also shows this note: "These numbers are exact for this keep rule only. A real keep also depends on the matchup, your curve and the exact cards."
  Accepted when: the view model gives the title, the five sections in order, the four items and the live sentence.
  The smoke test finds the heading "How to read these numbers" in headless Chrome.

### Average copies

- **R21** For each turn and each group, the page shows the average copies seen with no mulligan: (7 + draws) × copies ÷ deck size.
  The turns and the draws follow R9.
  The by-turn table shows one column for each group, with two decimals. The column header is the group name as text.
  Under the second chart, the page shows: "This is an average over many games. In one game you see a whole number of copies."
  Accepted when: 24 lands in 60 cards give 2.80 at turn 1 and 4.00 at turn 4 on the play, and 3.20 at turn 1 on the draw.
  The average agrees within 1e-12 with a brute-force average over each card subset of 9 small decks.
  The smoke test finds 2.80 in the first by-turn row.

### Share link

- **R15** The address fragment of the page holds the inputs, in the format of `docs/interface.md`.
  The page keeps the fragment equal to the current valid inputs.
  If a field of a link is bad, the page uses the default value of that field and shows a banner that names the field.
  Accepted when: encode then decode gives the same inputs, and each bad field gives its default and one issue for that field.

### Delivery

- **R16** The build makes one file, `dist/index.html`. The file holds the script and the styles.
  The page makes no network request.
  Accepted when: the smoke test finds no element that loads a file or a URL, no `@import`, no `url(`, and no request in the script.
  The smoke test also opens the file from `file://` in headless Chrome and finds 39.95% in the first row of the opening hand table.

### Performance

- **R17** The exact engine calculates the mulligan chain and the two by-turn lines for 250 cards, 6 groups and 20 turns in less than 150 ms.
  Accepted when: the median of 5 timed runs after a warm-up is less than 150 ms on the machine that runs the tests.
- **R18** The simulation completes 100,000 trials of the default deck in less than 2 s.
  Accepted when: the median of 3 timed runs after a warm-up is less than 2 s on the machine that runs the tests.

### Failure behaviour

- **R19** No input and no link causes an error that stops the page.
  Accepted when: 3,000 random fragments go through the decoder and the validation, and no call throws.
- **R20** The page shows each group name as text only. The page does not read a group name as HTML.
  Accepted when: the name `<img src=x onerror=alert(1)>` shows as text in headless Chrome, and the page has no `img` element.

## Defaults

The page shows this deck on the first load: 60 cards; "Lands" with 24 copies, least 2, most 4; "Key card" with 4 copies, least 1, no most; smallest hand 5; 0 free mulligans; on the play; 10 turns; seed 1; 100,000 trials.

## Open questions

- **Q1** The plan gave no upper limit for the deck size, free mulligans, the seed or the trials. The implementer added the limits in R1 and R3. The owner did not approve these limits yet.
- **Q2** The validation sets no length limit for a group name. The input field and the link decoder stop at 40 characters. Decide if the validation must also refuse a longer name.
- **Q3** The validation sets no upper limit for a least count or a most count. A large value gives a correct result (0% or no limit), but the owner did not decide on a limit.
- **Q4** The current rules text for a free first mulligan in multiplayer games is not verified. The page lets the user set the number, so the maths does not depend on it.
- **Q5** The page shows the average copies with no mulligan only. An average with mulligans needs a rule for the cards that the player keeps (see `docs/decisions/0002-mulligan-model.md`). The owner did not ask for that rule.
