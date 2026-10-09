# Conquest Game — Project Rules

## Mission

Build a fast, readable, replayable territorial-conquest game for PC and mobile.

Core fantasy:

> Capture neutral bases, use the resources they generate to improve your own character, then use those improvements to capture and defend more bases.

The team wins by controlling the most bases when the match ends.

The game must remain understandable in seconds and mechanically focused on conquest.

---

## Current product decisions

- Platforms: desktop + mobile web
- Rendering/game framework: Phaser 3
- Language: TypeScript
- Build tooling: Vite
- Camera: top-down
- Movement: free movement
- Combat: real-time, free aiming and attacking
- Initial playable mode: 1v1
- Future mode: team multiplayer, ultimately 4v4 with bots filling missing players
- Match duration: 7 minutes
- Initial neutral bases: 7
- Bases can change owner during the match
- Base capture is zone-based and fast
- No base leveling
- Character progression is individual
- Resources are received individually by players
- Resources are used to improve the player's character and conquest capabilities
- Final score = number of bases controlled at match end
- Map layout changes between matches
- Initial art direction: stylized cartoon / pixel-inspired visual language; implementation must remain technically lightweight
- Initial prototype must prioritize gameplay over visual polish

---

## Resource terminology

Current resources:

1. Food
2. Wood
3. Stone
4. Metal
5. **Power** — working replacement for "Energy"

The fifth name is intentionally provisional. Do not hard-code the displayed term everywhere. Keep resource IDs separate from display names.

Suggested stable IDs:

- `food`
- `wood`
- `stone`
- `metal`
- `power`

---

## Golden rules

1. Conquest is the primary gameplay loop.
2. Resources exist to improve conquest, not to become a separate management game.
3. Bases are the objective; resources are the means.
4. Character progression is personal, even inside a team.
5. Every mechanic must justify its existence by improving decision-making, action, readability, or replayability.
6. Avoid feature creep.
7. Prefer data-driven systems over hard-coded game rules.
8. Keep simulation deterministic where practical.
9. Keep rendering separate from gameplay state.
10. Mobile controls are a first-class requirement, not a later adaptation.
11. Never introduce a system that cannot be explained simply.
12. Build the smallest playable version before adding content.

---

## Non-goals for the first prototype

Do NOT implement initially:

- persistent accounts
- matchmaking
- cosmetics
- inventory between matches
- crafting trees
- complex buildings
- base leveling
- dozens of resources
- classes with complicated skill trees
- advanced physics
- procedural terrain generation
- online multiplayer
- monetization
- analytics-heavy infrastructure

---

## Source of truth

When documents disagree, use this priority:

1. `00_README.md`
2. `01_GAMEPLAY_RULES.md`
3. `02_DESIGN_SYSTEM.md`
4. `03_DATA_ARCHITECTURE.md`
5. `04_TECH_ARCHITECTURE.md`
6. `05_PERFORMANCE_RULES.md`
7. `06_DEVELOPMENT_RULES.md`

If a decision is ambiguous, do not silently invent a large system. Choose the smallest reversible implementation and document the decision.
