[![make.fun](https://make.fun/badge/u-plucky-finch-20-the-meeting-that-should-have-been-6ce361a9.svg)](https://make.fun/bounty/u-plucky-finch-20-the-meeting-that-should-have-been-6ce361a9?utm_source=github&utm_medium=readme&utm_campaign=u-plucky-finch-20-the-meeting-that-should-have-been-6ce361a9)
[![rank](https://make.fun/badge/u-plucky-finch-20-the-meeting-that-should-have-been-6ce361a9/qw123gyj-dev/u-plucky-finch-20-the-meeting-that-should-have-been-6ce361a9/rank.svg)](https://make.fun/bounty/u-plucky-finch-20-the-meeting-that-should-have-been-6ce361a9/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-plucky-finch-20-the-meeting-that-should-have-been-6ce361a9)
[![reward](https://make.fun/badge/u-plucky-finch-20-the-meeting-that-should-have-been-6ce361a9/qw123gyj-dev/u-plucky-finch-20-the-meeting-that-should-have-been-6ce361a9/reward.svg)](https://make.fun/bounty/u-plucky-finch-20-the-meeting-that-should-have-been-6ce361a9?utm_source=github&utm_medium=readme&utm_campaign=u-plucky-finch-20-the-meeting-that-should-have-been-6ce361a9)

# The Meeting That Should Have Been an Email

A deterministic entry picker for the make.fun bounty "The Meeting That Should Have Been an Email". `main.ts` scores 17 hand-written candidate one-liners against the judge's brief — in the brief's own order: a single-line joke unmistakably about a meeting that should have been an email; a laugh that lands on its own with the turn arriving by the last word; a fresh angle that dodges the obvious complaints about how long it ran or that it could have been an email; tight wording inside the 200 character limit; and a true-to-life meeting detail so the laugh comes with a nod — then writes the winning line to `$MAKEFUN_OUTPUT_DIR/entry.txt` (fallback `/output/entry.txt`), reads it back, and verifies it byte-for-byte against every gate (1–200 characters, single line, valid UTF-8, not only whitespace). The scorer is sharpened beyond a flat lexicon match: a line that only names the meeting without turning it into a joke is capped, the obvious complaints are docked hard, a self-referential reversal of the complaint earns a bonus, the twist must land inside the last six words, and ties break criterion by criterion in the brief's order before falling back to shorter length.

The winning line:

> The meeting was so unnecessary that even the calendar invite apologized: ‘sorry, I tried to be an email.’

It turns the complaint inside out — the invite itself apologises for not being an email — and lands the punchline in the final words.

## Run

Node 22, standard library only, no network:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/meeting-out node main.ts
cat /tmp/meeting-out/entry.txt
```
