# Data Architecture

## Core principle

Gameplay must be data-driven.

Do not hard-code:
- character stats
- resource costs
- base production
- capture duration
- cooldowns
- map parameters

in scattered TypeScript files.

Keep tunable game data centralized.

---

## Suggested project structure

```text
src/
  core/
    Game.ts
    Match.ts
    Clock.ts
    Random.ts

  gameplay/
    bases/
      Base.ts
      BaseSystem.ts
      CaptureSystem.ts
    characters/
      Character.ts
      CharacterSystem.ts
      CharacterDefinitions.ts
    combat/
      CombatSystem.ts
      DamageSystem.ts
    resources/
      ResourceSystem.ts
      ResourceDefinitions.ts
      ProductionSystem.ts
    upgrades/
      UpgradeSystem.ts
      UpgradeDefinitions.ts
    bots/
      BotSystem.ts

  world/
    Map.ts
    MapGenerator.ts
    SpawnSystem.ts

  input/
    KeyboardInput.ts
    MouseAim.ts
    TouchInput.ts

  rendering/
    BaseRenderer.ts
    CharacterRenderer.ts
    EffectsRenderer.ts
    UI/

  data/
    characters.ts
    resources.ts
    upgrades.ts
    maps.ts

  config/
    gameConfig.ts

  tests/
```

This is a guideline, not a reason to create unnecessary abstractions.

---

## IDs

Use stable machine IDs.

Example:

```ts
type ResourceId =
  | "food"
  | "wood"
  | "stone"
  | "metal"
  | "power";
```

Display names must be separate:

```ts
{
  id: "power",
  label: "Power",
  icon: "power"
}
```

This makes renaming easy.

---

## Character data

Example:

```ts
interface CharacterDefinition {
  id: string;
  label: string;
  maxHp: number;
  moveSpeed: number;
  attackDamage: number;
  attackRange: number;
  attackCooldown: number;
  abilityId: string;
}
```

Do not store mutable match state in the definition.

Definition = immutable configuration.

Runtime state = mutable match data.

---

## Base data

```ts
interface BaseDefinition {
  id: string;
  resourceId: ResourceId;
  position: { x: number; y: number };
  captureDuration: number;
}
```

Runtime:

```ts
interface BaseState {
  owner: TeamId | "neutral";
  captureProgress: number;
  contested: boolean;
}
```

---

## Player state

```ts
interface PlayerState {
  id: string;
  teamId: TeamId;
  characterId: string;

  position: { x: number; y: number };

  hp: number;

  resources: Record<ResourceId, number>;

  upgrades: string[];
}
```

Keep player state separate from rendering.

---

## Match state

The match state should be serializable.

It should contain:
- match time
- seed
- players
- bases
- production state
- score
- active effects

Avoid putting Phaser objects inside game state.

---

## Determinism

Random systems must use a seeded RNG.

The match seed determines:
- resource event sequence
- map randomization
- randomized base placement where applicable

This makes bugs reproducible.

---

## Save/replay readiness

The first prototype does not need replays.

However, keep game state sufficiently explicit that a replay system could theoretically record:
- seed
- player inputs
- important events

Do not implement replay now.

---

## Validation

Validate data at startup.

Fail fast on:
- duplicate IDs
- missing resources
- invalid costs
- invalid character references
- impossible map definitions
