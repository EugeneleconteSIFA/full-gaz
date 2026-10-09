# Performance Rules

## Target

The game must feel responsive on:
- modern desktop
- mid-range mobile
- mobile browser

The prototype should target:
- 60 FPS where practical
- low input latency
- fast initial loading

---

## Golden performance rule

Do not optimize blindly.

Measure first.

Use profiling tools before making complicated performance changes.

---

## Rendering

Prefer:
- sprite atlases
- texture reuse
- object pooling
- simple shapes
- limited particles

Avoid:
- creating/destroying hundreds of objects every frame
- unnecessary filters
- excessive transparency
- giant textures
- unique textures for every object

---

## Update loop

Do not perform expensive work every frame if it can be event-driven.

Bad:

```ts
every frame:
  scan every base
  scan every player
  recompute all production
```

Better:

```text
capture events → update base state
production timer → production event
death event → respawn timer
```

---

## Object allocation

Avoid frequent allocations inside the main update loop.

Especially avoid:
- temporary arrays
- object literals
- repeated path calculations
- string creation

when these happen at high frequency.

---

## AI

Bots should not run expensive decision-making every frame.

Use decision intervals.

Example:

```text
movement: every frame
combat reaction: high frequency
strategic target selection: every 250–500 ms
```

Tune after profiling.

---

## Mobile

Consider:
- device pixel ratio
- texture memory
- battery usage
- touch responsiveness
- background tab behavior

Do not assume desktop hardware.

---

## Network readiness

When multiplayer arrives:
- do not send every render frame
- send player inputs or compact state updates
- interpolate remote players
- use server authority
- avoid sending redundant state

---

## Performance budgets

Initial practical targets:

- small number of simultaneous active entities
- minimal draw calls where possible
- compressed assets
- no unnecessary external libraries
- first meaningful interaction quickly after load

Exact budgets should be measured and documented after the first playable build.
