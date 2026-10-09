# Decisions

## D001 — Phaser + TypeScript

Status: accepted

Reason:
The game is a browser-first top-down real-time game targeting PC and mobile. Phaser provides the appropriate 2D game primitives while TypeScript provides maintainability.

---

## D002 — 7-minute matches

Status: accepted

Reason:
The game should be quick enough to replay and intense enough that territorial decisions matter.

---

## D003 — 7 bases

Status: accepted

Reason:
Creates enough territorial choice for a small map without overwhelming a first-time player.

---

## D004 — Personal resources

Status: accepted

Reason:
Creates deliberate tension between individual optimization and team success.

---

## D005 — No base upgrades

Status: accepted

Reason:
Bases exist primarily as conquest objectives and resource generators. Development should improve the player's ability to conquer, not create a second base-management game.

---

## D006 — Accelerated endgame

Status: accepted

Reason:
Normal production every 60 seconds from 1:00 to 5:00; production every 30 seconds from 5:00 to 7:00. This creates a natural escalation without adding another ruleset.

---

## D007 — 1v1 before multiplayer

Status: accepted

Reason:
The core loop must be validated before network complexity is introduced.

---

## D008 — Power replaces Energy

Status: provisional

Reason:
"Energy" is considered too generic for the fifth resource. The display name can be changed later without changing the stable resource ID.

---

## D009 — Phaser pinned to 3.x

Status: accepted

Reason:
`npm install phaser` now resolves to 4.x. The project rules specify Phaser 3, so the dependency is `phaser@^3.90.0`. Moving to 4 would be a separate, deliberate decision.

---

## D010 — Fixed-tick simulation with render interpolation

Status: accepted

Reason:
The simulation advances in fixed 1/60 s ticks (`FixedStepClock`), independent of the display refresh rate. This keeps movement deterministic for the same seed and command sequence, and matches how a server-authoritative simulation will run later. Rendering interpolates between the last two ticks so 120 Hz screens stay smooth. After a stall (e.g. a background tab), at most 5 ticks catch up and the rest of the backlog is dropped.

---

## D011 — Commands set persistent intent

Status: accepted

Reason:
`MoveCommand` sets `PlayerState.moveIntent`, which the movement system integrates every tick until a new command changes it. Locally a command is sent every tick, but the same model works when a network client only sends inputs that changed.

---

## D012 — World units and camera framing

Status: accepted

Reason:
Gameplay uses world units (wu); rendering converts them at 32 px/wu. The camera zoom shows ~14 wu along the shorter screen side, so a phone in portrait and a desktop in landscape both see a readable slice of the map. It never zooms out past the map edges.

---

## D013 — Touch controls: floating twin sticks in a UI scene

Status: accepted

Reason:
A touch on the left half of the screen spawns a movement stick where the finger lands; a touch on the right half spawns an aim stick. Floating sticks work for any hand size and orientation without layout tuning. Touch controls live in a separate `UiScene` so they stay in screen space, unaffected by the world camera's zoom; the HUD goes there too. Firing on touch: see D016.

---

## D014 — WASD and ZQSD both bound

Status: accepted

Reason:
Phaser binds key codes, which depend on the keyboard layout. Binding both sets gives QWERTY and AZERTY players the same physical layout without a settings menu. Arrows also work.

---

## D015 — Basic attack is a projectile

Status: accepted

Reason:
A visible projectile reads clearly on a phone and works for every character: range, speed, size, damage and cooldown are character data, so the Shooter (long range) and Fighter (short range) differ by numbers instead of needing separate attack systems. A projectile damages at most one enemy, passes through teammates, and expires at its range or the map edge.

---

## D016 — Touch fires while the aim stick is held

Status: accepted

Reason:
`02_DESIGN_SYSTEM.md` lists a separate attack button. Holding the aim stick fires instead (twin-stick style): aiming and attacking with one thumb means two thumbs cover movement, aim and attack, and the screen stays free for the ability button. Desktop fires while the left mouse button is held. Both are "held" inputs; the cooldown sets the fire rate.

---

## D017 — Respawn delay 5 seconds, tick-based timers

Status: provisional (tune in playtests)

Reason:
5 s off the field is a real cost in a 7-minute match where a base flips in ~3 s, which rewards defending. Timers (attack cooldown, respawn) are stored as absolute ticks (`attackReadyTick`, `respawnAtTick`) so they are exact, serializable and deterministic. The player respawns at their team spawn with full HP, keeping their movement intent.

---

## D018 — Match state is created outside Phaser

Status: accepted

Reason:
`main.ts` builds a `MatchContext` (match state, local player, shared touch state) and starts the match and UI scenes with it at boot. Launching the UI scene from inside `MatchScene.create` left it pending until a later scene-queue pass, so the first touch after loading was ignored. Owning the state outside any scene also matches the future server-authoritative layout.

---

## D019 — Training dummy until bots exist

Status: accepted (temporary)

Reason:
Combat needs a target before bots (Milestone 9). The match includes a team B player, `dummy`, that receives no commands: it stands at its spawn, takes damage, dies and respawns like any player. Remove it from the match setup in `main.ts` when bots arrive.

---

## D020 — Capture: neutralize, then capture

Status: accepted, with a known rule conflict

Reason:
An enemy base is not flipped directly: a team alone in its zone first turns it neutral (`neutralizeSeconds`), then captures it (`captureSeconds`). The intermediate neutral state is visible and gives the defender a window to come back. Other rules:

- Both teams in the zone: contested, progress frozen.
- Empty zone: unfinished progress decays at half the capture speed (`decaySpeedFactor`).
- Owner alone: pushes enemy progress back at full speed.
- A new attacker must first undo another team's progress.
- Team size in the zone does not change speed.
- Only living players count, so killing the defender ends a contest.

**Conflict:** `01_GAMEPLAY_RULES.md` targets ~3 s for both a neutral capture and an enemy flip. With 1.5 s + 1.5 s, the flip takes 3 s but a neutral capture takes 1.5 s. The chosen split was explicitly approved. Setting `captureSeconds: 3` restores the 3 s neutral capture (the flip then takes 4.5 s).

---

## D021 — Meadow layout: dispersed, point-symmetric bases

Status: accepted

Reason:
7 bases spread over the map with no home cluster: 3 on the vertical center line (center, north, south) and 2 pairs off it. Each base close to one spawn has a twin equally close to the other spawn (point symmetry around the map center); a test checks this for every shipped map. Startup validation enforces exactly 7 bases, zones inside the map, no overlapping zones and no spawn inside a zone.

---

## D022 — Owners shown by color and shape

Status: accepted

Reason:
`02_DESIGN_SYSTEM.md` forbids relying on color alone. Team A is a blue circle, team B a red diamond, neutral a grey ring. The same symbols are used on bases and in the score HUD. A contested base also shows a yellow pulsing ring and a cross mark.

---

## D023 — Match clock, phases and end

Status: accepted

Reason:

- **Phases:** match length and the phase schedule (opening 0 s, development 60 s, endgame 300 s, with their production intervals) live in `GAME_CONFIG.match` and are validated at startup. The phase is derived from the tick, never stored.
- **End:** the match ends on the tick that reaches 7:00. The result is decided by the bases at that exact moment, so a capture completed on the final tick counts. The simulation then freezes and ignores all commands.

---

## D024 — Tie-breaker: unfinished capture progress

Status: accepted

Reason:
`01_GAMEPLAY_RULES.md` breaks a base tie with "total capture progress at the end". Defined as the sum of a team's unfinished progress on every base it is neutralizing or capturing at the final tick; values within 1e-6 count as equal (float noise). If still tied, the match is a draw. The result records which rule decided it, and the result screen says so.

---

## D025 — HUD: countdown, phase banners, final countdown

Status: accepted

Reason:

- **Timer:** counts down from 7:00 to 0:00, turns yellow under 30 s and red under 10 s.
- **Phase banners:** each phase start shows a non-blocking banner for ~2 s; the endgame banner says production speeds up and pushes players to attack.
- **Final countdown:** a large 10…1 countdown runs during the last 10 seconds.
- **Result screen:** shows victory, defeat or draw, a one-line reason, and a "Rejouer" button. Replay restarts both scenes with a new seed and drops `?seed` / `?skip` from the URL.

---

## D026 — Player-facing text in French, in one file

Status: accepted

Reason:
All on-screen text lives in `src/config/strings.ts` (French), including plural rules, so wording or language can change without touching gameplay or rendering code.

---

## D027 — `?skip=<seconds>` (development only)

Status: accepted

Reason:
Starts the match clock later (e.g. `?skip=290` to see the endgame) so phases and the end of the match can be tested without waiting 7 minutes. It only exists in dev builds and is validated like `?seed`.

---

## D028 — Base resources: free draw per match

Status: accepted, with a known rule conflict

Reason:
At match start, the seed draws each base's resource independently from the 5 resources. Free draw was chosen explicitly over a symmetric draw.

**Conflict:** `01_GAMEPLAY_RULES.md` §9 asks that "base distribution remains balanced". A free draw can leave a resource with no base, or give one side easier access to a resource. When a produced resource has no controlled base, nobody receives anything and the HUD says so. If playtests show unfair matches, replace `drawBaseResources` with a symmetric draw (twin bases share a resource, all 5 present); the function is the only place to change.

---

## D029 — Production: shuffle bag, fixed schedule, plan known in advance

Status: accepted

Reason:

- **Schedule:** each phase with an interval produces at its start, then every interval until the next phase starts. That gives 8 events: 1:00, 2:00, 3:00, 4:00, then 5:00, 5:30, 6:00, 6:30. Nothing is produced at 7:00, when the match ends.
- **Resource order:** a shuffle bag. Each of the 5 resources comes out once per bag, in an order drawn from the seed, so there are no long streaks and every base eventually produces.
- **Plan known in advance:** the whole plan is drawn at match start, in a fixed RNG order (base resources, then plan), and stored in the match state. That keeps it deterministic and lets the HUD always show the next resource and its countdown, which makes conquest decisions ahead of an event.
- **Payout:** each event pays every player of a team +1 per controlled base of that resource, dead players included. Wallets are personal and never lost.

---

## D030 — Resource names in data, icons drawn

Status: accepted

Reason:
Display names live in `src/data/resources.ts` (Nourriture, Bois, Pierre, Métal, Puissance), separate from the stable IDs. Icons are drawn shapes, not textures (fruit, log, pentagon, ingot, lightning bolt), so they differ by silhouette as well as color and need no assets yet.

---

## D031 — 4 characters defined as multipliers of a baseline

Status: accepted (values provisional, see 08_BALANCING_NOTES.md)

Reason:
`BASELINE` is the 100% reference (100 HP, 6 wu/s, 7 wu range, 20 damage, 0.4 s cooldown). Each character stores its multipliers from the balancing notes and the resolved stats:

| Character | Display name | HP  | Speed (wu/s) | Range (wu) | Damage |
| --------- | ------------ | --- | ------------ | ---------- | ------ |
| `tank`    | Robuste      | 140 | 4.5          | 6.3        | 20     |
| `scout`   | Rapide       | 70  | 8.4          | 6.3        | 18     |
| `shooter` | Tireur       | 75  | 5.7          | 10.5       | 17     |
| `fighter` | Combattant   | 100 | 6            | 7          | 22     |

Cooldown, projectile speed and hitbox are the same for all, so the comparison stays readable. A test checks that no character dominates another on every stat. Abilities are deferred to their own milestone, once the stat differences have been playtested.

---

## D032 — Selection screen, rematch or change character

Status: accepted

Reason:

- **Selection screen:** shows the 4 characters as cards, each with its 3 most defining stats as 1–5 stars (100% = 3 stars, ±20% per star) and a one-line pitch, never a full stat sheet. The last character played is pre-selected (remembered in `localStorage` when available) so one click starts.
- **Readable shapes:** every character has a glyph (shield bar, chevrons, crosshair, cross), shown in the match too, so characters are told apart by shape as well as by team color.
- **After a match:** the result screen offers both "Rejouer" (same character, new seed) and "Changer de perso" (back to selection).
- **Dev shortcut:** `?character=<id>` skips the selection screen in dev builds.

---

## D033 — Dummy character drawn from the seed

Status: accepted (temporary, until bots)

Reason:
The training dummy plays a character drawn from the match seed through a separate salted RNG, so a seed always replays the same matchup and the match RNG sequence (base resources, production plan) does not depend on who plays what.

---

## D034 — Personal upgrades: 5 stats, mixed costs, 3 levels

Status: accepted (values provisional)

Reason:

- **What they boost:** 5 upgrades, each raising a stat the character already has: Vie (max HP), Vitesse, Portée, Dégâts, Cadence (fire rate). No new mechanic (no armor, no capture change).
- **Gain:** each level adds +15% of the character's base stat, 3 levels max. Fire rate +15% divides the cooldown by 1.15.
- **Costs:** mixed, as chosen. Each upgrade has a primary and a secondary resource:
  - level 1 costs 1 primary;
  - level 2 costs 1 primary + 1 secondary;
  - level 3 costs 2 primary + 1 secondary.

  That keeps the chosen 1 / 2 / 3 totals while mixing resources from level 2.

- **Balance between resources:** every resource is primary for exactly one upgrade and secondary for exactly one other (checked by a test).

  | Upgrade | Primary    | Secondary  |
  | ------- | ---------- | ---------- |
  | Vie     | Nourriture | Pierre     |
  | Vitesse | Bois       | Nourriture |
  | Portée  | Pierre     | Bois       |
  | Dégâts  | Métal      | Puissance  |
  | Cadence | Puissance  | Métal      |

- **Stats stored on the player:** the player's effective stats are stored in `PlayerState.stats` and recomputed on purchase; every gameplay system reads them instead of the character definition. Buying Vie also heals by the HP it adds (while alive). Upgrades persist through death.

Known interaction: with the free base-resource draw (D028), a missing resource can lock levels 2–3 of the upgrade that uses it as secondary.

---

## D035 — Buying: any time, always-visible bar

Status: accepted

Reason:

- **When:** purchases go through a `BuyUpgradeCommand`, are instant, and are allowed at any time, even while dead.
- **Bar:** 5 compact buttons (name, level pips, next cost in red when short), lit when affordable, "MAX" when complete. It sits in a bottom row in landscape and a right-edge column in portrait.
- **Keyboard:** hotkeys 1–5 are matched by key code, so they work on AZERTY without Shift. The selection screen now uses `event.code` for the same reason.
- **No stray input:** clicking a button does not fire, and a finger starting on a button does not spawn a joystick.

---

## D036 — 3 hand-authored maps with obstacles

Status: accepted (layouts provisional, to tune with bots)

Reason:

- **Maps:**

  | Map                      | Size  | Character                                                                 |
  | ------------------------ | ----- | ------------------------------------------------------------------------- |
  | Prairie (`meadow`)       | 48×32 | open, 4 rocks and 2 low walls                                             |
  | Canyon (`canyon`)        | 52×30 | central corridor between two long walls; the center base is a choke point |
  | Quatre-Coins (`corners`) | 60×36 | wide, bases in the corners and on the mid-edges                           |

- **Obstacles:** circles (rocks) and axis-aligned rectangles (walls). They block movement (bodies slide out along the surface) and stop projectiles, so cover exists and a shot never reaches someone behind a wall. A capture zone may not overlap an obstacle, and obstacles must be at least 0.8 wu thick so a projectile cannot skip through in one tick.
- **Startup checks on every map:**
  - 7 bases, zones inside the map, no zones overlapping;
  - spawns clear and outside every zone;
  - full point symmetry (spawns, bases, obstacles);
  - every base reachable on foot from both spawns, checked with a grid flood fill for a body of the largest character radius.

---

## D037 — Per-match variant: mirror + symmetric nudge

Status: accepted

Reason:

- **What changes each match:** the seed flips the map horizontally (which side each team starts on) and vertically, then nudges each pair of twin bases by up to 1.5 wu. The twin moves by the mirrored offset, so the layout stays point-symmetric and fair. The center base never moves.
- **Always valid:** a nudge that breaks a layout rule is retried (8 attempts), then dropped, so every variant passes the same checks as the hand-authored map; a test checks 40 seeds per map.
- **Stored in the match state:** the variant is generated with its own salted RNG, so resources and production stay the same for a given seed, and stored in `MatchState.layout`. Every system reads that layout, never the map definition.

---

## D038 — The player picks the map

Status: accepted

Reason:
`01_GAMEPLAY_RULES.md` says maps change between matches; the player was given the choice instead. The selection screen has a map row: "Aléatoire" (drawn from the seed, the default) or one of the 3 maps. The last choice is remembered, and "Rejouer" keeps it ("Aléatoire" draws a new map each time). The opening banner names the map. Keyboard: M cycles the map. Dev: `?map=<id|random>`.

---

## D039 — Bots play through commands, like a human

Status: accepted

Reason:
A `BotController` reads the match state and fills the same `InputState` a human's devices fill, then goes through the same `CommandWriter`. Bots cannot cheat (no direct state writes) and run anywhere the simulation runs, including headless tests and, later, a server. Each bot has its own RNG seeded from the match seed and its id, so a seed replays the same bot decisions.

---

## D040 — Bot behavior: objective first

Status: accepted (tuning provisional)

Reason:
Following `01_GAMEPLAY_RULES.md` §10, kills are only a means:

- **Target choice:** every decision interval, the bot scores each base. A neutral base is worth 1, an enemy base 1.4 (flipping swings the score twice), and its own base under attack 1.6. A base producing the next resource gets +0.4 when the event is under 25 s away. The value halves every 8 s of walking, and the current target gets a +20% stickiness bonus.
- **Fighting:** it shoots the closest enemy in sight within range, after a reaction delay, with aim error, and leads moving targets on Normal and Difficile.
- **Low HP:** below 30% HP it avoids bases near enemies.
- **Upgrades:** it buys in its character's priority order as soon as it can pay.
- **Nothing left to take:** it guards the owned base closest to an enemy.
- **Navigation:** per-match distance fields (Dijkstra on the 0.5 wu walk grid, 8 directions, no corner cutting), one per base. It walks straight when the line is clear, otherwise down the field. Steering updates at 20 Hz and strategy every 0.25–0.6 s, never per frame.

---

## D041 — 3 difficulty levels, same logic

Status: accepted

Reason:
Facile, Normal and Difficile differ only by numbers: decision interval, reaction time, aim error, target leading and noise on base choices. Chosen on the selection screen (key D), remembered, Normal by default. In 30 headless matches per pairing with sides alternated, Difficile beat Facile 30 times and Normal 26 times, and Normal beat Facile 29 times. The training dummy is still available in dev builds with `?opponent=dummy`.

---

## D042 — Swept projectile hits and point-blank shots

Status: accepted (bug fix found through bots)

Reason:
Hits were tested only at a projectile's end-of-tick position, and projectiles spawn 0.7 wu ahead of the shooter. A body standing closer than that, or crossed within one tick, was never hit: two bots on the same base shot each other forever. Hits are now tested along the whole segment travelled in the tick (first body along the way wins), and an enemy between the shooter and the spawn point is hit immediately. Obstacles are thicker than one tick of travel, so walls still stop every shot.

---

## D043 — Balance tuned with a bot tournament

Status: accepted (values provisional until human playtests)

Reason:
`npm run balance` plays every character pair on every map (Normal bots, sides alternated) and reports win rates, side bias, draws, snowball, comebacks and economy. Only numbers were changed: Robuste speed 75%→85%, Rapide speed 140%→130%, Tireur damage 85%→95%, Combattant damage 110%→105% and HP 100%→95%. Overall win rates moved from 19–72% to 42–56%. Details, and the economy finding left for a rule decision, are in `BALANCE.md`.

---

## D044 — Touch aim assist

Status: accepted

Reason:
On the touch aim stick only, the aim snaps to the enemy closest to the stick direction within a 12° cone and the attack range + 1 wu, if no obstacle is in the way. Mouse aim stays exact. It is applied to the input before commands are written, so the simulation never knows which device aimed.

---

## D045 — Compact HUD and vibration on phones

Status: accepted

Reason:

- **Compact HUD:** below 520 px wide, the next production joins the wallet line as icon + clock, the gain message is shortened ("+2 Bois"), and in portrait the phase banner shrinks and centers left of the upgrade column.
- **Vibration:** on touch devices, a short vibration when the local player is hit and when their team captures a base. It is silently skipped when the Vibration API is missing or blocked (iOS Safari has none).

---

## D046 — Performance budgets measured

Status: accepted

Reason:
`npm run perf` measures the simulation and bots headless (about 10 µs per tick with two bots); browser frame costs are recorded in `PERFORMANCE.md`. Per-frame string building in the upgrade bar and the next-production line was removed. Spikes seen only when frames are pushed back to back in a hidden pane are documented as unconfirmed until measured with real frames on a phone.

---

## D047 — Production twice as frequent (playtest)

Status: accepted, with a known rule conflict

Reason:
Playtest feedback: resources came too slowly. Production now runs every 30 s in development and every 15 s in the endgame (16 events instead of 8); the shuffle-bag draw and the ×2 endgame acceleration are unchanged. In bot matches, resources per player rose from ~4 to ~8, upgrade levels from 3 to 4, and the first purchase moved from 2:00 to 1:00–1:30.

**Conflict:** `01_GAMEPLAY_RULES.md` and D006/D029 specify 60 s / 30 s. The values live in `GAME_CONFIG.match.phases`.

---

## D048 — Facile made clearly weaker (playtest)

Status: accepted

Reason:
Playtest feedback: Facile was too hard to beat. Facile keeps the same logic and rules, with weaker behavior settings:

- 22° aim error and a 1 s reaction time;
- poor base choices (noise 1.0);
- fires only within 70% of its range;
- walks at 80% of full stick;
- pauses 2 s after each capture;
- buys at most one upgrade every 40 s.

Measured: Normal now beats Facile 24/24 (Facile ends with no base; it still scores ~5 kills per match), and Facile still captures freely against a passive player (both are tested).

These options are per difficulty in `BOT_DIFFICULTY_SETTINGS` (Normal and Difficile are unchanged). Bots never get faster stats or better rules, only worse behavior.

---

## D049 — "Diorama Vinyl" art direction, drawn in code

Status: accepted

Reason:
The art direction brief (`docs/09_ART_DIRECTION_PROMPT.md`) chose a "vinyl toy diorama" look. No image files exist yet, so the look is drawn with Phaser Graphics and baked once into textures at 2× (`src/rendering/bake.ts`). Sizes follow the planned sprites (body Ø 32 px, building 52 px, zone Ø 160 px), so PNG files can replace the baked textures later without touching gameplay.

- Characters: one silhouette per class (tank square, scout triangle, shooter long bar, fighter circle), neutral body materials, team color and symbol only on the cap and the ground ring. Farm weapons (potato cannon, seed slingshot, hydro-pumper, fork-crossbow), each with its own shot. Walk bob, recoil, hit flash, "poof" on death, pop on respawn — all in code, no frame animations.
- Bases: one building per resource, an owner-colored plinth and flag, a dashed zone ring, hazard stripes while contested; wood and power rotors spin while owned; the building pops when it produces.
- Maps: one biome per map (meadow, canyon, corners = marsh), flat decor never outlined, spawn pads, obstacles whose footprint is exactly their collision shape.
- Palette corrections over the brief: metal is copper `#E8833A` (the brief's `#FFB703` was the contested yellow); resource icons on the ground sit on a dark badge, because every resource color gives less than 3:1 contrast on the biome grounds.
- UI font: Fredoka (Google Fonts), waited for at most 1.5 s at startup, system font otherwise.

---

## D050 — Tilted "brawler" view over a flat simulation

Status: accepted (playtest feedback: "trop 2D, vu du dessus")

Reason:
The simulation stays exactly the same flat top-down 2D (collisions, balance, bots and tests untouched). Only rendering changes (`src/rendering/projection.ts`):

- **Ground:** the ground plane is squashed vertically by `rendering.tilt` = 0.72, so the map leans toward the viewer like Brawl Stars. Flat things (ground, decor, zones, rings, shadows, spawn pads) are drawn with their old top-down code inside a container scaled (1, 0.72).
- **Standing things:** characters, buildings, rocks, walls and projectiles are drawn upright at their feet's screen position and depth-sorted by world y (lower on screen = in front).
  - Walls have a top face and a 22 px front face; vertical walls are split into one-unit slices so depth stays right beside them.
  - Rocks are domes resting on their footprint ellipse.
  - A hedge stands along the back edge and the board has a front edge, so the map reads as a diorama.
- **Bases:** buildings stand 1.1 wu behind their zone center so whoever captures stays visible in the yard; a building fades to 45% while the local player is behind it.
- **Shots:** they fly 18 px above the ground with a ground shadow.
- **Input:** mouse aim and touch sticks are converted from the tilted screen back to world directions, so aiming stays exact (checked in the browser: aim (0.708, 0.706) toward a target at (0.707, 0.707)).

This replaces the "top-down orthographic, no perspective" constraint of `docs/09_ART_DIRECTION_PROMPT.md`, which was revised accordingly.

---

## D051 — Named minion characters

Status: accepted (playtest feedback: "un nom au lieu de leur atout", "un peu de minionnerie")

Reason:

- **Names:** players now see a name, not a role. Patatras (tank, a potato with a cooking-pot helmet), Pépin (scout, a small bean with big goggles and a flying scarf), Lorgnon (shooter, a tall one-eyed bean with a bucket hat and a water tank), Gaston (fighter, the classic farmhand in overalls and a straw hat). The role stays in the data (`role`) for docs and tooling.
- **Drawing:** characters are upright minions drawn in code, 1.35× bigger than their hitbox (the ground ring shows the real footprint). Team color is on one clothing piece carrying the team symbol, plus a ground ring (circle for A, diamond for B).
- **Animation:** pupils are separate and follow the aim; the body mirrors to face left or right; the weapon turns around the hand and goes behind the body when aiming up. They breathe when idle, hop and lean when walking, blink every few seconds, squash and flash when hit, and jump for joy when their team captures the base they stand in (with a confetti burst from the roof).
- **Selection screen:** shows each character standing, front-facing, breathing; the selected one hops.
- **Asset swap:** texture keys follow the brief's naming (`char_<id>_body_<team>`, `char_<id>_weapon`, `char_pupil`, `base_<id>_building`, `base_<id>_rotor`), so drawn art can replace them later.

---

## D052 — Static drawings baked into render textures

Status: accepted

Reason:
Phaser Graphics re-tessellate every frame. With the brawler art, the match measured 15.4 ms per frame, mostly dashed rings and decor. Static drawings (map decor and border, wall slices, rocks, hedge, board edge) are baked once, and the bases' ground marks and flags are re-baked only when the base changes (`CachedGraphics`). The match runs with no live Graphics: 3.0 ms median per frame.

---

## D053 — Render at the device pixel ratio

Status: accepted (playtest: "trop pixelisé sur PC")

Reason:
Phaser's RESIZE mode renders the canvas at CSS resolution; on a Retina screen the browser upscaled the whole picture ×2, and baked textures were then magnified again by the ~3.6× camera.

- **Canvas:** it is now sized in device pixels (`Scale.NONE`, `zoom: 1/DPR`, resized on window resize). The DPR is capped at 2 (`src/rendering/viewport.ts`).
- **Screens:** the UI and selection scenes keep laying out in CSS pixels; their camera zooms by DPR and texts rasterize at DPR.
- **Textures:** baked textures are drawn at 3× (`BAKE_SCALE`) and render textures at 2×, capped at 4096 px per side for mobile GPUs.

---

## D054 — Melee for Patatras, Pépin and Gaston; Lorgnon is the only shooter

Status: accepted (playtest), values tuned with the tournament

Reason:

- **Melee swing:** a melee attack hits, at once, every enemy whose body reaches into an arc in front (within the reach and the arc of the aim), unless a wall is in between. A body touching the attacker is always hit.
- **Damage trade-off:** melee hits much harder than Lorgnon's shots, which are weak but carry far. The Portée upgrade lengthens the melee reach.
- **Bots:** melee bots step in toward a visible enemy within 6.5 wu and hold position once in reach; Lorgnon backs away from a melee enemy closer than 3.5 wu.
- **Weapons and animation:** frying pan (Patatras), rake (Pépin), pitchfork (Gaston), in `src/rendering/weaponArt.ts`. The tool sweeps the arc in 150 ms with a fading crescent trail.

|                    | Patatras   | Pépin      | Lorgnon | Gaston     |
| ------------------ | ---------- | ---------- | ------- | ---------- |
| Attack             | melee 130° | melee 110° | shot    | melee 110° |
| HP                 | 150        | 70         | 75      | 105        |
| Speed (wu/s)       | 5.4        | 7.8        | 5.3     | 6          |
| Damage             | 35         | 17         | 8       | 33         |
| Reach / range (wu) | 1.6        | 1.25       | 9       | 1.6        |
| Cooldown (s)       | 0.65       | 0.45       | 0.42    | 0.5        |

---

## D055 — Every base pays, the featured resource ×3, every minute

Status: accepted (playtest: "les améliorations doivent être plus fréquentes"); replaces the payout of D029 and the schedule of D047

Reason:

- **Schedule:** a production event runs every 60 s in development and every 30 s in the endgame (8 events), back to the timings of `01_GAMEPLAY_RULES.md`.
- **Payout:** at each event, every controlled base pays each player of its team 1 of its own resource; bases of the event's featured ("maxée") resource, still drawn from the shuffle bag and announced in advance, pay ×3 (`GAME_CONFIG.production`).
- **HUD:** it announces "Prochaine : Pierre ×3" and shows the detail received ("+3 Pierre · +1 Bois").

Measured in the tournament (Normal bots, 8 seeds):

- resources per player and match rose from 8 to 21, upgrade levels bought from 4 to 6, and the first purchase now happens at the first event (1:00);
- characters stay within 44–57%;
- the leader at 1:00 now wins 68% (was 55%), since holding more bases pays more at every event. Watch this in playtests (balancing question 1, snowball).

---

## D056 — Score as a mini-map of flags

Status: accepted (playtest: "voir où sur la map je dois aller pour avoir un drapeau")

Reason:
The row of base pips is replaced by a small tilted map at the top center, with each team's base count on either side:

- each base's flag at its real position (owner symbol, yellow ring while contested);
- faint obstacles for orientation;
- a live icon of each opposing character (its own art, facing its aim, hidden while dead);
- a team-colored dot for the local player.

It shows where to go to take a flag, and where the enemy is. The map part is redrawn only when a base changes; icons move every frame. It is 210 px wide on desktop and 132 px on phones.

## D057 — One special ability per character

Status: accepted (docs/01_GAMEPLAY_RULES.md §7 "use ability", abilityId in docs/03)

Reason:
Stat multipliers alone made the four characters feel alike. Each one now has a single ability on its own button and cooldown, chosen for its conquest role:

| Character | Ability    | Effect                                                     | Cooldown |
| --------- | ---------- | ---------------------------------------------------------- | -------- |
| Patatras  | Carapace   | takes 40% of damage for 3 s: holds a contested base        | 10 s     |
| Pépin     | Bond       | instant 4.5 wu leap along the movement (else the aim)      | 6 s      |
| Lorgnon   | Rafale     | 5 projectiles in a 40° fan: clears a zone from afar        | 8 s      |
| Gaston    | Tourbillon | hits all around at 1.5× reach and pushes enemies 3 wu back | 8 s      |

- Held like attack: the ability fires whenever the cooldown allows. A quick tap between two input samples still counts.
- Controls: F on desktop, round button in the bottom-right corner (both), showing the cooldown.
- Leaps and knockbacks move in 0.25 wu steps and stop at walls and the map edge: nothing passes through an obstacle.
- Abilities scale with upgrades (spin reach and damage, volley damage); no upgrade changes the ability itself.
- Normal and hard bots use their ability; easy bots do not.
- Values are first guesses; to be checked in playtests with humans, not only bots.

## D058 — The match world is rendered in three.js (roadmap step 1)

Status: accepted (spike measured on desktop and on the target phone, an iPhone mini)

Reason:
One renderer and one material for characters, buildings and ground gives the single art direction by construction; baking sprites would have to fake it per asset and freeze the animation.

- three.js draws the world on its own canvas; Phaser keeps the HUD on a transparent canvas above it.
- An orthographic camera pitched acos(TILT) ≈ 35° from vertical reproduces `projection.ts` exactly: capture zones, aim and touch sticks are unchanged, and so is the simulation.
- Characters lean back about 30° toward the camera, or the steep pitch shows only the top of their heads.
- Measured with the heavy showcase models (~148 k triangles each), 60 fps in play on desktop and on the iPhone mini; 11 ms per frame with 4 characters and the screen-space outline (17 ms with MSAA instead). The outline replaces MSAA.
- Match versions of the characters (~8 k triangles) are required whatever the phone result (roadmap step 2).

The spike lives on the branch `spike/three-world` as a reference; it is not merged.

## D059 — "Puissance" becomes "Farine" (flour), "Nourriture" becomes "Légumes"

Status: accepted (user delegated the choice, 8 Oct 2026)

Reason:
The fifth resource needed a farm name and a building before modelling (roadmap step 4). Flour from a windmill gives the strongest silhouette of the set (turning sails, already the 2D building) and a cream colour far from team blue/red, the contested yellow and metal's copper. To avoid two "food" resources, food is shown as vegetables (the barn's yard is already a vegetable garden).

- Display names only (`src/data/resources.ts`); the ids `food` and `power` stay (docs/00: ids are stable).
- Icon: a tied flour sack, cream. Building: windmill whose sails turn while the base is owned.
- Upgrade costs are unchanged (flour pays for Cadence, as "power" did).

## D060 — Maps redrawn for the 3D view

Status: accepted (user delegated the choice, 8 Oct 2026)

Reason:
The 3D buildings stand at the back of every zone and the characters are bigger on screen; the maps also lacked cover for the three melee characters and flanks for the fast one. Each map keeps its identity:

- **Prairie**: a walled central plaza open in the middle of each side, rocks screening the spawn lanes, a stone wall splitting each team's near bases from the middle lane.
- **Canyon**: the corridor walls now have a 4-unit gap in the middle (the center base is reachable from the north and south bases), rock pillars inside, an open corridor mouth, fences in the outer lanes.
- **Quatre-Coins**: a little tighter (56 x 34 instead of 60 x 36), four walls boxing a crossroads around the center, rocks between the center and the edge bases.

- Maps are authored as one half plus its point mirror (`mirrored()` in `src/data/maps.ts`), so the symmetry check holds by construction.
- No obstacle stands where a building is drawn (the back half of each zone).
- Measured with the bot tournament (8 seeds per pair): balance is about neutral (leader at 5:00 wins 81 % instead of 82 %, leader at 1:00 65 % instead of 62 %); the gain is structure and readability, to be confirmed by human playtests.
- Combat tests now clear the obstacles explicitly (`clearObstacles`) instead of relying on an open spot of a real map.
- `src/tools/mapReport.run.ts`: per-map report to compare designs (`MAP=<id> BALANCE_SEEDS=<n>`).

## D061 — Pépin: 70 → 76 HP

Status: accepted

Reason:
After the abilities (D057) and the new maps, Pépin won 32 % of his matches on every map, losing most duels to the melee bruisers. +6 HP brings him to 49 %. +12 HP overshot (63 %): his HP is a very sensitive lever. Gaston stays the strongest (58 %) and Patatras the weakest (38 %); a combined fix (Gaston −2 damage, Patatras +10 HP) moved nothing clearly beyond the tournament's ±10-point noise, so it was not kept.

## D062 — Interface identity (roadmap step 7)

Status: accepted (user delegated the choice, 8 Oct 2026)

Reason:
The interface still looked like the first prototype (flat rectangles, one bold font) next to the 3D cast. It now follows one kit (docs/13): Lilita One for display text, chunky slate panels with ink outline, gold main buttons that sink when pressed, gold for selection, team colours for team information only. Selection cards, the score mini-map and the result screen show 3D portraits rendered once from the character models; the result screen shows the player's character in 3D (victory pose or worried).

## D063 — Character look v2: Supercell hero pass

Status: accepted (Patatras validated by the user, then generalised, 9 Oct 2026)

Reason:
The characters looked like pastel figurines. Main causes, measured in the dev bench (`lab.html`): the key light came from behind the characters (faces in shadow), the lit side clipped to white, pastel palettes, soft all-ellipsoid shapes, no gloss, then glassy eyes. The fix stays in the scripts and the shared material (docs/10 §5):

- character material mode (less fill, crisper violet ramp, coloured AO, warm rim, stylised specular), the world keeps its mode; key light moved in front (the world gains lit façades);
- per-part gloss from the build (Gloss UV map), metal highlights tinted by their colour, eyes without material specular;
- cartoon eyes (flat iris, thick limbal ring, one glint, thicker lids);
- hero shape language through new `charkit.Spec` fields and a per-character standing attitude in the animation;
- Gaston moved to `charkit`.

Budgets kept: match models ~12,000 triangles (≈ 390–410 KB each); showcase models 119–150 k triangles.

## D064 — 3D only: the 2D renderer is removed

Status: accepted (roadmap step 9, 9 Oct 2026)

Reason:
The 3D world was validated in full matches on desktop and phone, and the user chose no fallback. Keeping the 2D renderer meant two code paths to maintain for every visual change. Removed: `CharacterRenderer`, `BaseRenderer`, `ProjectileRenderer`, the 2D puppets and their drawn art (`puppet/`, `characterArt`, `characterBodies`, `weaponArt`, `buildingArt`), the first three.js prototype (`gaston3d`, `skin`, `toon`), unused theme values and `?renderer=2d`. Kept, because the 3D path uses them: the painted ground (`MapRenderer.paintGroundCanvas`), the damage numbers (`CombatFx`) and the flat resource icon fallback. The character viewer now shows only the 3D model; the score mini-map shows the 3D portraits.

Models are compressed with meshopt (gltfpack, no quantization: it broke the gloss UVs and the mouth decals). Raw exports stay in `art/out/models/`; see PERFORMANCE.md.

