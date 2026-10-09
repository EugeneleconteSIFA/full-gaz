# Technical Architecture

## Stack

Primary recommendation:

- Phaser 3
- TypeScript
- Vite
- ESLint
- Prettier
- Vitest

Initial target:
- browser
- desktop
- mobile browser

---

## Architecture rule

Separate three layers:

### 1. Simulation
Pure game rules.

Examples:
- capture
- damage
- production
- upgrades
- win condition

### 2. Presentation
Phaser rendering.

Examples:
- sprites
- animations
- particles
- camera
- UI

### 3. Input
Keyboard/mouse/touch.

This separation is essential for later multiplayer.

---

## Game loop

Do not put all gameplay logic in Phaser Scene callbacks.

Recommended flow:

```text
Input
  ↓
Commands
  ↓
Game Simulation
  ↓
State changes
  ↓
Rendering
```

For example:

```text
Mouse click
→ AttackCommand
→ CombatSystem
→ target takes damage
→ state updated
→ Phaser renders result
```

---

## Commands

Use explicit actions where practical:

```ts
type GameCommand =
  | MoveCommand
  | AttackCommand
  | CaptureCommand
  | BuyUpgradeCommand
  | UseAbilityCommand;
```

This makes future multiplayer easier.

---

## Multiplayer preparation

Do not implement multiplayer initially.

But avoid architecture that makes multiplayer impossible.

Future target:

```text
Client
  ↓
Input commands
  ↓
Server-authoritative simulation
  ↓
Snapshots/events
  ↓
Clients render state
```

The server should eventually own:
- positions
- combat
- captures
- resources
- production
- match clock
- victory

Never trust the client for authoritative game state.

---

## Physics

Do not introduce a physics engine unless required.

For the first prototype:
- simple collision checks
- circle/rectangle overlap
- simple projectiles if needed

Only add a physics engine if actual gameplay requires it.

---

## Camera

Top-down camera.

Camera should:
- follow local player
- clamp to map bounds
- support mobile
- avoid unnecessary zoom complexity in prototype

---

## Input abstraction

Game logic must not know whether input comes from:
- keyboard
- mouse
- touch

Expose abstract actions:

```ts
moveVector
aimVector
attackPressed
abilityPressed
interactPressed
```

Then map devices onto these actions.

---

## Asset loading

Centralize asset manifests.

Do not scatter raw asset paths across gameplay code.

Use logical keys:

```ts
assets.characters.scout
assets.ui.capture
assets.resources.wood
```

---

## Error handling

Fail visibly during development.

Do not silently swallow:
- missing assets
- invalid data
- undefined IDs
- impossible state transitions

Production error handling can be improved later.
