# Gameplay Rules

## 1. Match structure

A match lasts exactly 7 minutes.

### Phase A — Opening conquest
`00:00 → 01:00`

- No resource production.
- All 7 bases start neutral.
- Players immediately move to capture bases.
- Goal: establish territorial control.

### Phase B — Development
`01:00 → 05:00`

- One resource production event occurs every 60 seconds.
- Players receive resources individually according to their team's controlled bases.
- Players spend resources on personal upgrades.
- Bases remain the central objective.

### Phase C — Endgame
`05:00 → 07:00`

- Resource production happens every 30 seconds.
- The faster economy creates a final escalation.
- Players should be encouraged to take risks and attack.
- No new long-term progression system is introduced during endgame.

At `07:00`, the match ends immediately.

Winner:
> Team with the most controlled bases.

Tie-breaker must be explicitly defined before multiplayer release. For prototype, use:
1. bases controlled at the exact end;
2. if still tied, total capture progress at the end;
3. if still tied, draw.

---

## 2. Bases

There are 7 bases per match.

Each base has:

- stable ID
- position
- resource specialization
- owner
- capture state
- visual state

Initial owner:
`neutral`

Possible owners:
- `neutral`
- `teamA`
- `teamB`

A base is not upgraded.

### Capture

Capture is zone-based.

A player enters the capture zone.

If only one team is present:
- capture progress advances toward that team's ownership.

If both teams are present:
- capture is contested
- progress does not advance

If the defending team leaves:
- the attacking team can take the base.

Capture must be fast enough to keep the match active.

Initial target:
- ~3 seconds to capture an uncontested neutral base
- ~3 seconds to flip an enemy base once uncontested

These values are tunable data, not constants buried in gameplay code.

---

## 3. Base production

Each base has exactly one resource specialization.

Example specializations:

- food
- wood
- stone
- metal
- power

At a production event:

1. determine the selected resource;
2. find all bases producing that resource;
3. for each controlled base, award the resource to every player on its team.

Example:

Team A controls 2 wood bases.

At a wood production event:
- Player A1 receives +2 wood
- Player A2 receives +2 wood

Resources are therefore both:
- a team-level consequence of territorial control
- an individual progression resource

Do not create a shared team wallet in the first version.

---

## 4. Resource events

Normal phase:
- one random resource every 60 seconds

Endgame:
- one random resource every 30 seconds

The random selection must be deterministic from the match seed.

Do not use uncontrolled client-side randomness for authoritative gameplay.

The event must be visible to players.

Example:
`WOOD PRODUCTION`

The player should immediately understand:
- which resource was produced
- how much they received
- why they received it

---

## 5. Characters

Initial roster: 4 characters.

### Tank / Robust
Strength:
- high survivability
- good at holding contested areas

Weakness:
- low mobility

### Scout / Fast
Strength:
- high movement speed
- excellent for reaching and flipping bases

Weakness:
- fragile

### Shooter / Ranged
Strength:
- long attack range
- zone control

Weakness:
- vulnerable at close range

### Fighter / Balanced
Strength:
- reliable all-rounder
- good close combat

Weakness:
- no extreme specialization

Each character has one special ability on its own cooldown, serving its role (D057):

- Tank: Carapace — takes much less damage for a few seconds.
- Fast: Bond — instant leap.
- Shooter: Rafale — a fan of projectiles.
- Fighter: Tourbillon — hits all around and pushes enemies out of the zone.

Characters must have clear strengths and weaknesses.

No character should be strictly better.

---

## 6. Personal progression

All progression is individual.

A player chooses how to spend their own resources.

The team cannot directly force a player to spend resources.

This intentional conflict is a core design feature:

> individual optimization vs team objective

Example:
- A fast player may invest everything into mobility.
- Their team may prefer them to invest in combat.
- Both choices can be strategically valid.

Do not add team-wide upgrades until the individual system is proven fun.

---

## 7. Combat

Combat is real-time.

Core actions:
- move
- aim
- attack
- use ability
- interact/capture

No complex RPG stats in prototype.

Suggested baseline:
- HP
- movement speed
- attack damage
- attack range
- attack cooldown
- ability cooldown

Death:
- player temporarily leaves the field
- respawns after a short fixed delay
- exact value is tunable

Death must not remove resources permanently in the first prototype.

---

## 8. Victory

The objective is NOT:
- kills
- resources
- upgrades
- damage dealt

The objective is:

> control the most bases at 7:00.

Kills and resources are only means to that objective.

Every UI element must reinforce this hierarchy.

---

## 9. Map generation

Maps change between matches.

For the first prototype:
- use a controlled set of hand-authored maps
- randomize selected elements
- ensure base distribution remains balanced

Do not implement unrestricted procedural generation before the core gameplay is validated.

Map generator must guarantee:
- 7 valid bases
- reasonable travel distances
- no inaccessible base
- no spawn advantage that is obviously unfair
- navigable terrain

---

## 10. Bots

Bots are later.

Initial bot behavior should be intentionally simple:

1. choose a target base
2. move toward it
3. capture it
4. detect nearby enemy
5. fight or retreat
6. periodically reassess objective

Advanced strategic AI is not required for prototype 1.
