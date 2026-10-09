# Balance

Measured with the bot tournament: `npm run balance` (`BALANCE_SEEDS=<n>` for more seeds per pair).
Normal vs Normal bots, every character pair on every map, sides alternated. With 8 seeds, each character plays 96 non-mirror matches, so differences under ~10 points are noise.

Bots are not humans: they flip bases constantly and never kite. Treat these numbers as a first pass, to be checked with real playtests.

## Changes (D057–D061: abilities, 3D maps, Pépin)

Bot tournament after the special abilities (D057), the redrawn maps (D060) and Pépin at 76 HP (D061), 8 seeds per pair (each character plays 96 non-mirror matches; differences under ~10 points are noise).

| Character | Overall | Prairie | Canyon | Quatre-Coins |
| --------- | ------- | ------- | ------ | ------------ |
| Patatras  | 38%     | 42%     | 38%    | 33%          |
| Pépin     | 49%     | 29%     | 54%    | 63%          |
| Lorgnon   | 42%     | 46%     | 50%    | 29%          |
| Gaston    | 58%     | 67%     | 63%    | 46%          |

Leader at 1:00 wins 65 %, leader at 5:00 wins 81 %, draws 2 %, captures per match 93 (median). Gaston counters Pépin hard (92 % of their duels): his spin throws Pépin out of the zone. To check with human players.

## Changes (Milestone 10)

| Character              | Stat   | Before | After | Why                                                                |
| ---------------------- | ------ | ------ | ----- | ------------------------------------------------------------------ |
| Robuste (`tank`)       | speed  | 75%    | 85%   | won 19% overall; too slow to reach contests                        |
| Rapide (`scout`)       | speed  | 140%   | 130%  | won 72% overall: "fast character dominant" (08_BALANCING_NOTES Q2) |
| Tireur (`shooter`)     | damage | 85%    | 95%   | dropped to 37% once the two above were fixed                       |
| Combattant (`fighter`) | damage | 110%   | 105%  | won 65–69%: best at everything by a little                         |
| Combattant (`fighter`) | HP     | 100%   | 95%   | same                                                               |

## Overall win rate per character (non-mirror)

| Character  | Before (6 seeds) | After (8 seeds) |
| ---------- | ---------------- | --------------- |
| Robuste    | 19%              | 44%             |
| Rapide     | 72%              | 42%             |
| Tireur     | 50%              | 53%             |
| Combattant | 67%              | 56%             |

Per map, after: Robuste is strong on Prairie (75%) and weak on Quatre-Coins (17%); Rapide is the reverse on Quatre-Coins (54%). That matches each character's role (slow tank on the widest map), so it is left as map identity for now.

## Answers to the balancing questions (after tuning)

| Question (08_BALANCING_NOTES)             | Measure                                                      | Reading                           |
| ----------------------------------------- | ------------------------------------------------------------ | --------------------------------- |
| 1. Can the first captured bases snowball? | Leader at 1:00 wins 58%                                      | Mild advantage, no snowball       |
| 2. Is the fast character dominant?        | Rapide 42%                                                   | No longer                         |
| 3. Can a defender hold a base forever?    | 95 captures per match, 3 bases owned at the end (both teams) | No, bases change hands constantly |
| 7. Is the endgame more exciting?          | Leader at 5:00 wins 61%                                      | Matches stay open until the end   |
| 8. Can the losing team still recover?     | Same: 39% of 5:00 leaders lose                               | Yes                               |
| — Side bias                               | Mirror matches: team A wins 51%                              | None                              |
| — Draws                                   | 7% (16% decided by the capture tie-breaker)                  | Tie-breaker matters               |

## Economy (not changed: needs a rule decision)

- **Resources:** about 4 per player per match (median), and 3 upgrade levels bought.
- **First purchase:** median at 2:00, the second production event.
- **Cause:** bases flip so often that few are owned when production runs.

Resources therefore change decisions only a little (question 6). Options, each a rule change rather than a number:

- longer captures (`captureSeconds: 3`, as in 01_GAMEPLAY_RULES);
- a production bonus;
- cheaper level 1.

Check with human playtests first: humans may hold bases longer than bots.

## Playtest round 1 (after Milestone 10)

**Feedback:** "Facile trop dur", "les ressources n'arrivent pas assez vite" (desktop).

**Changes:**

- **Production:** every 30 s / 15 s instead of 60 s / 30 s (D047).
- **Facile:** much weaker behavior (D048).
- **Rapide:** speed back up to 135%; with more upgrades in play it had dropped to 38% (8 seeds).

**Results (Normal vs Normal, 8 seeds):**

| Measure                                | Value                 |
| -------------------------------------- | --------------------- |
| Robuste / Rapide / Tireur / Combattant | 50% / 50% / 51% / 44% |
| Side bias                              | 47%                   |
| Draws                                  | 6%                    |
| Leader at 1:00 wins                    | 52%                   |
| Leader at 5:00 wins                    | 66%                   |
| Resources per player and match         | 8 (was 4)             |
| Upgrade levels per player and match    | 4 (was 3)             |
| First purchase, median                 | 90 s (was 120 s)      |
| Normal vs Facile                       | 24–0                  |

## Playtest round 2: melee (D054)

Only Lorgnon shoots now; the other three fight in melee. First tournament with melee: Lorgnon won 89% (kiting slow melee bots) and Patatras 14%. After tuning (Lorgnon weaker and slower; Patatras faster with a longer reach; Pépin weaker; Gaston and Patatras sturdier; melee bots spot enemies from 6.5 wu):

| Character | Overall (8 seeds) |
| --------- | ----------------- |
| Patatras  | 42%               |
| Pépin     | 53%               |
| Lorgnon   | 49%               |
| Gaston    | 43%               |

The matchups form a rock-paper-scissors loop, each at 71%: Patatras beats Pépin, Pépin beats Lorgnon, Lorgnon beats Patatras.

| Other measure                  | Value      |
| ------------------------------ | ---------- |
| Side bias                      | 43%        |
| Draws                          | 4%         |
| Leader at 1:00 wins            | 55%        |
| Leader at 5:00 wins            | 72%        |
| Deaths per player and match    | 8 (was 12) |
| Resources per player and match | 8          |

## Playtest round 3: every base pays (D055)

**Feedback:** upgrades must come more often.

**Change:** every event (each minute, every 30 s in the endgame), every owned base pays ×1, and the featured resource pays ×3.

**Results (Normal vs Normal, 8 seeds):**

| Measure                             | Before             | After              |
| ----------------------------------- | ------------------ | ------------------ |
| Resources per player and match      | 8                  | 21                 |
| Upgrade levels per player and match | 4                  | 6                  |
| First purchase, median              | 90 s               | 60 s               |
| Patatras / Pépin / Lorgnon / Gaston | 42 / 53 / 49 / 43% | 44 / 44 / 44 / 57% |
| Leader at 1:00 wins                 | 55%                | 68%                |
| Leader at 5:00 wins                 | 72%                | 82%                |

**Reading:** the snowball is stronger, since more bases now means more income at every event. If playtests confirm it, possible levers are a lower ×3 (×2), or a catch-up bonus for the team holding fewer bases.
