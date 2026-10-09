# Changelog

## V0.18 — The whole game in 3D

- 3D match world (three.js) under the Phaser HUD: characters, bases, buildings, props, lighting per map (Canyon at sunset)
- Supercell-style characters from scripted Blender builds, with attacks, abilities, expressions and victory poses
- New interface: selection screen with live 3D characters, 3D portraits and resource icons, result screen with the winner in 3D, "Comment jouer" panel
- Loading: models compressed from 22.2 to 8.3 MB, loading screen; first match path about 1.8 MB
- The old 2D renderer is removed (`?renderer=2d` is gone)

## V0.17 — Special abilities

- Each character has an ability (F or the round button, bottom right): Carapace (Patatras), Bond (Pépin), Rafale (Lorgnon), Tourbillon (Gaston)
- The selection screen names each ability and describes the selected one
- Normal and hard bots use theirs

## V0.16 — Flag mini-map

- The score shows a mini-map: flags where the bases are, live opponent icons, your position
- Fix: the game failed to start when loaded in a hidden tab (0-sized canvas)

## V0.15 — Faster upgrades

- Production every minute (30 s in the endgame): every owned base pays 1 of its resource, the featured resource pays ×3
- HUD announces the featured resource ("×3") and details the gains

## V0.14 — Playtest round 2

- Sharp rendering: canvas at the device pixel ratio (capped at 2), textures baked at 3×
- Patatras, Pépin and Gaston fight in melee (frying pan, rake, pitchfork) with a swing animation; Lorgnon is the only shooter (low damage, long range)
- Bots step in for melee and kite as Lorgnon; characters retuned with the tournament
- docs/prompts/claude_game_art_skill.md: prompt to build a game-art method for Claude

## V0.13 — Brawler look: tilted view and named minions

- Tilted 3/4 view: squashed ground plane, upright depth-sorted characters, buildings, rocks and walls; back hedge and board edge
- Characters renamed and redrawn as cute minions: Patatras, Pépin, Lorgnon, Gaston
- Character animation: eyes follow the aim, facing, weapon around the hand, breathing, hops, blinking, hit squash, capture cheer
- Buildings redrawn in front elevation (barn, sawmill, quarry, forge, windmill), placed at the back of their zone, see-through when the player is behind
- Confetti when a team captures a base; shots fly above the ground with a shadow
- Front-facing animated portraits on the selection screen
- Mouse aim and touch sticks corrected for the tilt
- docs/09_ART_DIRECTION_PROMPT.md revised for the new direction

## V0.13 — Art direction "Diorama Vinyl"

- New look drawn in code: 4 character silhouettes with farm weapons and their own shots, 5 resource buildings, 3 biomes, spawn pads, shaded obstacles
- Team color on caps, flags and plinths, always with the team symbol
- Code animations: walk bob, recoil, hit flash, death poof, respawn pop, spinning rotors, production pop
- Resource icons on dark badges on the map; metal is now copper; Fredoka font

## V0.12 — Playtest round 1

- Production twice as frequent: every 30 s in development, every 15 s in the endgame (16 events)
- Facile bot much weaker: less accurate, slower to react, hesitant, buys rarely
- Rapide speed 130% → 135% to stay balanced with the richer economy

## V0.11 — Milestone 10: balancing, mobile, performance

- `npm run balance`: bot-vs-bot tournament with balance metrics; character stats tuned (see BALANCE.md)
- Touch aim assist (12° cone, line of sight)
- Compact HUD on narrow screens; phase banner fits beside the upgrade column in portrait
- Vibration on hit and on capture (touch devices)
- `npm run perf` and PERFORMANCE.md: measured budgets; per-frame HUD allocations removed
- Selection screen now shows each character's real specialty (ranked by deviation from 100%)

## V0.10 — Milestone 9: basic bot

- Objective-focused bot opponent: picks bases, walks around obstacles, captures, defends, fights, buys upgrades
- 3 difficulties (Facile, Normal, Difficile) chosen on the selection screen, remembered
- Bot navigation: per-base distance fields on the walk grid, line-of-sight shortcuts
- The bot replaces the training dummy (dev: `?opponent=dummy`, `?opponent=<difficulty>`)
- Fix: projectiles now hit along their whole path; point-blank shots hit

## V0.9 — Milestone 8: map variation

- 3 maps: Prairie, Canyon, Quatre-Coins, all point-symmetric
- Obstacles (rocks, walls) block movement and projectiles
- Per-match variant from the seed: horizontal/vertical mirror and symmetric base nudges
- Map checks at startup and for every variant: symmetry, placement, bases reachable from both spawns
- Map choice on the selection screen ("Aléatoire" or a named map), remembered; map named in the opening banner
- Dev: `?map=<id|random>`

## V0.8 — Milestone 7: personal upgrades

- 5 upgrades (Vie, Vitesse, Portée, Dégâts, Cadence), 3 levels, +15% of the base stat per level
- Mixed costs: 1 primary, then 1 primary + 1 secondary, then 2 primary + 1 secondary
- Buy any time, from an always-visible bar (bottom row / right column) or hotkeys 1–5
- Effective player stats used by movement, combat, damage and respawn
- Fix: number keys on the selection screen now work on AZERTY keyboards

## V0.7 — Milestone 6: characters

- 4 characters (Robuste, Rapide, Tireur, Combattant) from the balancing notes, as multipliers of a baseline
- Character glyphs in the match and on the selection screen
- Selection screen: 4 cards, 3 defining stats as stars, one-line pitch; mouse, touch and keyboard (1–4, arrows, Enter)
- Last character pre-selected
- Result screen: "Rejouer" (same character) or "Changer de perso"
- Training dummy plays a character drawn from the seed
- Dev: `?character=<id>` skips the selection screen

## V0.6 — Milestone 5: resources

- 5 resources (Nourriture, Bois, Pierre, Métal, Puissance) with stable IDs and drawn icons
- Each base produces one resource, drawn from the seed per match (free draw)
- 8 production events per match (1:00–4:00 every 60 s, 5:00–6:30 every 30 s), shuffle-bag order from the seed
- Personal wallets: +1 per controlled base of the produced resource, for every team player
- HUD: wallet, always-visible next production with countdown, gain message after each event
- Resource definitions validated at startup

## V0.5 — Milestone 4: 7-minute match

- Match clock: 7:00 countdown; opening / development / endgame phases from config
- Phase banners, timer warning colors, final 10…1 countdown
- Match ends exactly at 7:00; winner by bases, then unfinished capture progress, then draw
- Simulation frozen after the end
- Result screen (victory / defeat / draw, reason) with a replay button that starts a new seed
- On-screen text in French, centralized in `src/config/strings.ts`
- Dev: `?skip=<seconds>` starts the match later

## V0.4 — Milestone 3: bases, capture, score

- 7 neutral bases per map; meadow layout dispersed and point-symmetric
- Zone capture: enemy bases are neutralized (1.5 s) then captured (1.5 s)
- Contested zones freeze progress; empty zones decay progress at half speed; owners push enemy progress back
- Dead players do not count in a zone
- Base visuals: zone tinted by owner, owner symbol, progress ring, contested ring and mark
- Score HUD: bases per team plus one pip per base, ordered as on the map
- Map validation: base count, zone placement, overlap, spawn clearance

## V0.3 — Milestone 2: combat

- Projectile attack, fired while attack is held, limited by a per-character cooldown
- Character data gains HP, damage, range, cooldown, projectile speed and size
- Health, death at 0 HP, respawn at team spawn with full HP after 5 seconds
- Dead players cannot move, fire or be hit
- Health bars above characters, hit flash, KO / respawn countdown on the HUD
- Touch: holding the aim stick fires; desktop: hold the left mouse button
- Training dummy (team B) to test combat until bots exist
- Fix: the first touch after loading was ignored (UI scene started late)

## V0.2 — Milestone 1: foundation and movement

- Project setup: Phaser 3, TypeScript (strict), Vite, ESLint, Prettier, Vitest
- Bootable game with a hand-authored top-down map (`meadow`)
- Player entity with free movement, clamped to the map boundaries
- Keyboard movement (WASD / ZQSD / arrows) and mouse aim
- Touch twin-stick movement and aim
- Device-independent input actions → commands → fixed-tick simulation → rendering
- Camera follows the player, clamped to the map, with zoom adapted to the screen
- Seeded RNG in match state; `?seed=` query parameter for reproducing a match
- Game data validated at startup

## V0.1 — Initial specification

- Defined core conquest loop
- Defined 7-minute match structure
- Defined 7-base system
- Defined individual resources
- Defined 4 starting characters
- Defined personal progression
- Defined 1v1-first development plan
- Defined Phaser + TypeScript + Vite architecture
- Defined performance and Codex rules
