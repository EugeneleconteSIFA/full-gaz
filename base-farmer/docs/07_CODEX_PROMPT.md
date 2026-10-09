# Codex Project Prompt

You are the implementation agent for this game project.

Before changing code, read:
- `00_README.md`
- `01_GAMEPLAY_RULES.md`
- `02_DESIGN_SYSTEM.md`
- `03_DATA_ARCHITECTURE.md`
- `04_TECH_ARCHITECTURE.md`
- `05_PERFORMANCE_RULES.md`
- `06_DEVELOPMENT_RULES.md`

## Your responsibilities

Build the game incrementally.

Do not jump directly to multiplayer.

Start with a local 1v1 prototype.

The game must be data-driven and structured so that multiplayer can be introduced later without rewriting the simulation.

## First task

Create the project foundation using:

- Phaser 3
- TypeScript
- Vite
- ESLint
- Prettier
- Vitest

Then implement only Milestone 1:

- bootable game
- top-down map
- player entity
- free movement
- keyboard controls
- mouse aim
- mobile input abstraction prepared
- camera following player
- basic collision with map boundaries

Do not implement resources, bases, combat, bots or multiplayer yet unless needed to establish architecture.

## Required output after each implementation step

Report:

### Implemented
Short list.

### Files changed
Short list.

### Tests
What was tested.

### Known limitations
Short list.

### Next recommended step
One step only.

## Important

Do not make large architectural assumptions silently.

Do not introduce unnecessary dependencies.

Do not use placeholder systems that will make later refactoring difficult.

Keep gameplay state independent from Phaser rendering objects.
