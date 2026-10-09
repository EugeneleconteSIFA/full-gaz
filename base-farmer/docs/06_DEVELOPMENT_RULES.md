# Development Rules for Codex

## General

You are working on a game project, not a one-off demo.

Prioritize:
1. correctness
2. simplicity
3. maintainability
4. performance
5. visual polish

Do not reverse this order.

---

## Before coding

Before implementing a new feature:

1. Read the relevant project rules.
2. Identify which gameplay rule it implements.
3. Identify the state it modifies.
4. Identify how it will be tested.
5. Keep the implementation minimal.

If the requested feature conflicts with the rules, flag the conflict instead of silently changing the design.

---

## Definition of Done

A feature is not complete merely because it renders.

A feature is complete when:
- gameplay behavior works
- invalid states are handled
- mobile input is considered
- data is not unnecessarily hard-coded
- tests exist for important pure logic
- no obvious performance regression exists
- code is formatted/linted
- the feature is documented if it changes a rule

---

## Coding style

Use:
- TypeScript strict mode
- small modules
- explicit types
- meaningful names
- pure functions for calculations where practical
- immutable definitions
- controlled mutable runtime state

Avoid:
- `any`
- global mutable state
- giant classes
- giant Phaser scenes
- magic numbers
- duplicated gameplay logic
- deeply nested conditionals

---

## Constants

Bad:

```ts
if (distance < 150) { ... }
```

Better:

```ts
if (distance < GAMEPLAY.captureRadius) { ... }
```

All tuning values should be discoverable.

---

## Testing

Prioritize tests for:

### High value
- capture logic
- contested bases
- resource production
- resource distribution
- upgrade costs
- combat damage
- respawn
- win condition
- match timers
- seeded randomness

### Lower priority
- sprite rendering
- animations
- purely visual UI behavior

---

## Git discipline

Use small commits.

Suggested style:

```text
feat: add base capture system
feat: add resource production
feat: add character selection
fix: prevent capture while contested
refactor: separate simulation from rendering
test: cover production distribution
```

Do not mix unrelated changes in one commit.

---

## Development order

Follow this order unless there is a strong reason not to:

### Milestone 1
- project setup
- Phaser boot
- map
- player movement

### Milestone 2
- aiming
- attack
- health
- death/respawn

### Milestone 3
- 7 bases
- capture
- contested state
- score

### Milestone 4
- 7-minute match
- phase system
- end condition

### Milestone 5
- resources
- random production
- personal wallets

### Milestone 6
- character selection
- 4 characters

### Milestone 7
- personal upgrades

### Milestone 8
- map variation

### Milestone 9
- basic bot

### Milestone 10
- balancing
- mobile controls
- performance pass

Only after these work:
- multiplayer
- 2v2
- 4v4
- matchmaking
- advanced AI

---

## Rule for adding features

Before adding a new mechanic, answer:

1. Does it make conquest more interesting?
2. Does it create a meaningful decision?
3. Can a new player understand it quickly?
4. Can it work on mobile?
5. Is it worth the implementation complexity?

If fewer than 3 answers are "yes", do not add it yet.

---

## Codex behavior

When asked to implement something:

- inspect existing architecture first
- reuse existing systems
- do not rewrite working systems without reason
- do not add dependencies without justification
- do not invent major gameplay rules
- keep changes scoped
- report assumptions
- run relevant tests
- run typecheck/build before declaring completion

When a decision is genuinely ambiguous, choose the smallest reversible implementation and document it in `DECISIONS.md`.

---

## Documentation

Maintain:

```text
README.md
DECISIONS.md
CHANGELOG.md
```

`DECISIONS.md` records important design/architecture decisions and their rationale.

Do not use it as a diary.

---

## Definition of prototype success

The first complete prototype succeeds if a player can:

1. launch a match
2. choose one of 4 characters
3. move freely
4. aim freely
5. attack
6. die and respawn
7. capture a neutral base
8. contest an enemy base
9. see the score
10. receive resources
11. spend resources on a personal upgrade
12. experience the accelerated endgame
13. finish a 7-minute match
14. clearly understand who won and why

Nothing else is required for the first playable prototype.
