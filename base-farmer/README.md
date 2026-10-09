# Base Farmer

Top-down territorial-conquest game for desktop and mobile browsers. Capture bases, spend the resources they produce on your character, and hold the most bases when the 7-minute match ends.

The design rules are in [`docs/`](docs/00_README.md). Read them before changing gameplay. Architecture decisions are in [`DECISIONS.md`](DECISIONS.md).

**Status:** V0.18, the full game in 3D: Supercell-style 3D characters (Patatras, Pépin, Lorgnon, Gaston) and world built by scripted Blender pipelines (`art/`), rendered with three.js under a Phaser HUD. Pick a character, a map and a bot difficulty, then play a full 7-minute 1v1 against the bot: capture the 7 bases, collect the resources they produce, spend them on personal upgrades, and see who won at 0:00.

## Run

```bash
npm install
npm run dev
```

Vite prints a local URL and a network URL; open the network URL on a phone on the same Wi-Fi to test touch controls.

Models: Blender writes raw exports to `art/out/models/`; `npm run models:pack` compresses them (meshopt) into `public/models/`, which the game loads.

Add `?seed=<number>` to the URL to replay a specific match seed (the current seed is logged to the console). In dev, `?character=<tank|scout|shooter|fighter>` skips the selection screen, `?map=<meadow|canyon|corners|random>` picks the map, `?opponent=<easy|normal|hard|dummy>` picks the opponent (dummy = passive target), `?fps` shows the frame rate, and `?skip=<seconds>` starts the match later, e.g. `?skip=290` for the endgame or `?skip=410` for the end screen.

## Controls

| Action         | Desktop                                   | Touch                      |
| -------------- | ----------------------------------------- | -------------------------- |
| Move           | WASD / ZQSD / arrows                      | drag on the left half      |
| Aim            | mouse                                     | drag on the right half     |
| Attack         | hold Space (the mouse aims)               | hold the aim stick         |
| Ability        | F                                         | round button, bottom right |
| Capture        | stand in a base's zone                    | same                       |
| Buy upgrade    | keys 1–5 or click the bar                 | tap the bar (right edge)   |
| Pick character | click a card, or 1–4 / arrows, then Enter | tap a card, then Jouer     |

## Scripts

| Command             | Purpose                                              |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | dev server with hot reload                           |
| `npm run build`     | typecheck and production build to `dist/`            |
| `npm test`          | unit tests (Vitest)                                  |
| `npm run typecheck` | TypeScript only                                      |
| `npm run lint`      | ESLint                                               |
| `npm run format`    | Prettier                                             |
| `npm run balance`   | bot-vs-bot balance tournament (BALANCE.md)           |
| `npm run perf`      | headless simulation and bot timings (PERFORMANCE.md) |

## Architecture

Input, simulation and rendering are separate layers. Gameplay never sees a Phaser object or a raw device event.

```text
keyboard / mouse / touch
  → InputState        (src/input)    device-independent actions
  → GameCommand[]     (src/core/commands.ts)
  → stepMatch()       (src/core, src/gameplay)  pure rules, fixed 60 Hz tick
  → MatchState        plain serializable data
  → renderers         (src/rendering)  read state, never write it
```

| Folder          | Contents                                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/core`      | match state, simulation step, commands, fixed-step clock, seeded RNG, local match setup, debug URL params                                                                      |
| `src/gameplay`  | game systems: movement, combat (firing, projectiles, damage), bots, bases (capture, score), match (clock, phases, result), resources (production), upgrades, character ratings |
| `src/world`     | match layout (map variants, validation, reachability), navigation, obstacle geometry, spawning                                                                                 |
| `src/data`      | immutable definitions (characters, maps, resources, upgrades), registry and startup validation                                                                                 |
| `src/config`    | tuning values, key bindings, on-screen text                                                                                                                                    |
| `src/input`     | device adapters (keyboard, mouse, touch, UI buttons) and the command writer                                                                                                    |
| `src/rendering` | Phaser drawing: map, bases, characters, projectiles, HUD, upgrade bar, result screen                                                                                           |
| `src/scenes`    | `SelectScene` (character choice), `MatchScene` (wiring), `UiScene` (touch controls, HUD), `MatchContext` (shared state)                                                        |
| `src/tests`     | unit tests for the pure logic                                                                                                                                                  |
| `src/tools`     | headless measurement runs: balance tournament, performance timings                                                                                                             |

Tuning values live in `src/config/gameConfig.ts` and `src/data/`. Distances are in world units; only `src/rendering/units.ts` converts them to pixels.
